package ma.adess.sentinel

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Dépôt local. L'instantané du serveur est mis en cache dans un fichier : les dernières fiches
 * synchronisées restent lisibles hors connexion. La liste de surveillance ne quitte jamais le téléphone.
 */
object Repo {
    private lateinit var app: Context
    private var ready = false

    var snap by mutableStateOf<Snapshot?>(null)
        private set
    var syncing by mutableStateOf(false)
        private set
    var lastSync by mutableStateOf<Long?>(null)
        private set
    var lastError by mutableStateOf<String?>(null)
        private set
    var fromSeed by mutableStateOf(false)
        private set

    val watch = mutableStateListOf<String>()
    val followed = mutableStateListOf<String>()
    val seen = mutableStateMapOf<String, Int>()
    var server by mutableStateOf(BuildConfig.DEFAULT_SERVER)
        private set
    var rules by mutableStateOf(Rules(patch = true, exploit = true, scope = true))
        private set

    private val prefs get() = app.getSharedPreferences("sentinel", Context.MODE_PRIVATE)
    private val cache get() = File(app.filesDir, "snapshot.json")

    @Synchronized
    fun init(ctx: Context) {
        if (ready) return
        app = ctx.applicationContext
        val p = prefs
        // L'ancienne adresse GitLab Pages n'est plus mise à jour : elle est remplacée par celle des données GitHub.
        server = p.getString("server", null)?.takeIf { it.isNotBlank() && !it.contains("gitlab.io") } ?: BuildConfig.DEFAULT_SERVER
        rules = Rules(p.getBoolean("r_patch", true), p.getBoolean("r_exploit", true), p.getBoolean("r_scope", true))
        lastSync = p.getLong("lastSync", 0L).takeIf { it > 0 }
        runCatching { JSONArray(p.getString("watch", "[\"Maroc\"]")).let { a -> for (i in 0 until a.length()) watch += a.getString(i) } }
        runCatching { JSONArray(p.getString("followed", "[]")).let { a -> for (i in 0 until a.length()) followed += a.getString(i) } }
        runCatching { JSONObject(p.getString("seen", "{}") ?: "{}").let { o -> for (k in o.keys()) seen[k] = o.getInt(k) } }
        ready = true
        // Au premier plan, l'instantané (quelques Mo) est lu hors du fil principal ; en tâche de fond, il est lu tout de suite.
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) kotlin.concurrent.thread { load() } else load()
    }

    var loading by mutableStateOf(true)
        private set

    /** 1) dernier instantané synchronisé ; 2) à défaut, instantané embarqué dans l'APK lors de sa compilation. */
    private fun load() {
        val cached = runCatching { if (cache.exists()) parseSnapshot(cache.readText()) else null }.getOrNull()
        val seed = if (cached == null) runCatching { parseSnapshot(app.assets.open("seed.json").bufferedReader().use { it.readText() }) }.getOrNull() else null
        if (snap == null) { snap = cached ?: seed; fromSeed = cached == null && seed != null }
        loading = false
    }

    fun isWatched(e: Event): Boolean = watchMatch(e, watch)

    fun addWatch(term: String) { val t = term.trim(); if (t.length >= 2 && watch.none { it.equals(t, true) }) { watch += t; saveLists() } }
    fun removeWatch(term: String) { watch.remove(term); saveLists() }
    fun toggleFollow(id: String) { if (!followed.remove(id)) followed += id; saveLists() }
    private fun saveLists() = prefs.edit().putString("watch", JSONArray(watch.toList()).toString()).putString("followed", JSONArray(followed.toList()).toString()).apply()

    fun markSeen(id: String, n: Int) {
        if (seen[id] == n) return
        seen[id] = n
        prefs.edit().putString("seen", JSONObject(seen.toMap()).toString()).apply()
    }

    fun updateRules(r: Rules) { rules = r; prefs.edit().putBoolean("r_patch", r.patch).putBoolean("r_exploit", r.exploit).putBoolean("r_scope", r.scope).apply() }
    fun updateServer(url: String) { server = url.trim().trimEnd('/').ifBlank { BuildConfig.DEFAULT_SERVER }; prefs.edit().putString("server", server).apply() }

    private fun http(url: String, body: String? = null, timeout: Int = 25000): String {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 12000; c.readTimeout = timeout; c.instanceFollowRedirects = false
            c.setRequestProperty("Accept", "application/json")
            if (body != null) { c.requestMethod = "POST"; c.doOutput = true; c.setRequestProperty("Content-Type", "application/json"); c.outputStream.use { it.write(body.toByteArray()) } }
            val code = c.responseCode
            if (code in 300..399) throw IOException("accès refusé : le serveur renvoie vers une page de connexion")
            if (code !in 200..299) throw IOException("HTTP $code")
            return c.inputStream.bufferedReader().use { it.readText() }
        } finally { c.disconnect() }
    }

    /** Télécharge l'instantané, le met en cache et émet les alertes correspondant aux règles de l'utilisateur. */
    suspend fun sync(notify: Boolean = true): Boolean {
        if (syncing) return false
        syncing = true
        try {
            val text = withContext(Dispatchers.IO) { http("$server/snapshot.json") }
            val fresh = withContext(Dispatchers.Default) { parseSnapshot(text) }
            if (fresh.events.isEmpty() && fresh.sources.isEmpty()) throw IOException("instantané vide")
            withContext(Dispatchers.IO) { cache.writeText(text) }
            val old = snap
            val wasSeed = fromSeed
            snap = fresh; fromSeed = false; lastError = null
            val now = System.currentTimeMillis()
            lastSync = now
            prefs.edit().putLong("lastSync", now).apply()
            if (notify && old != null && !wasSeed) Notifier.show(app, computeAlerts(old, fresh, watch.toList(), followed.toSet(), rules))
            return true
        } catch (e: Exception) {
            lastError = e.message ?: e.javaClass.simpleName
            return false
        } finally { syncing = false }
    }

    /** Assistant : le serveur répond s'il dispose d'un modèle de langage, sinon la recherche locale prend le relais. */
    suspend fun ask(question: String): Answer? {
        val s = snap ?: return null
        val remote = withContext(Dispatchers.IO) {
            runCatching {
                val o = JSONObject(http("$server/assistant", JSONObject().put("question", question).put("watch", JSONArray(watch.toList())).toString(), 60000))
                val ids = Regex("\\[([\\w-]+)]").findAll(o.getString("answer")).map { it.groupValues[1] }.distinct().toList()
                Answer(o.getString("answer"), ids.mapNotNull { s.event(it) }, "réponse rédigée par l’assistant du serveur à partir des fiches indexées", false)
            }.getOrNull()
        }
        return remote ?: withContext(Dispatchers.Default) { localAnswer(question, s, watch.toList()) }
    }
}

object Notifier {
    private const val CHANNEL = "veille"

    fun allowed(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /** Une notification par fiche : les changements d'un même incident sont regroupés. */
    @SuppressLint("MissingPermission")
    fun show(ctx: Context, alerts: List<Alert>) {
        if (alerts.isEmpty() || !allowed(ctx)) return
        val nm = NotificationManagerCompat.from(ctx)
        nm.createNotificationChannel(NotificationChannelCompat.Builder(CHANNEL, NotificationManagerCompat.IMPORTANCE_DEFAULT).setName("Alertes de veille").build())
        for (a in alerts.take(8)) {
            val intent = Intent(ctx, MainActivity::class.java).putExtra("event", a.eventId).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val pi = PendingIntent.getActivity(ctx, a.eventId.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val style = NotificationCompat.InboxStyle()
            a.lines.forEach { style.addLine(it) }
            val n = NotificationCompat.Builder(ctx, CHANNEL).setSmallIcon(R.drawable.ic_notif).setContentTitle(a.title).setContentText(a.lines.first())
                .setStyle(style).setContentIntent(pi).setAutoCancel(true).setGroup("sentinel").build()
            nm.notify(a.eventId.hashCode(), n)
        }
    }
}

class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        Repo.init(applicationContext)
        return if (Repo.sync(notify = true)) Result.success() else Result.retry()
    }

    companion object {
        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<SyncWorker>(30, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("sentinel-sync", ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
