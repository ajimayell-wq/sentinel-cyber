@file:OptIn(ExperimentalLayoutApi::class)

package ma.adess.sentinel

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun WatchScreen(nav: Nav) {
    val s = Repo.snap
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var term by rememberSaveable { mutableStateOf("") }
    var serverField by rememberSaveable { mutableStateOf(Repo.server) }
    var msg by remember { mutableStateOf<String?>(null) }
    var notifOk by remember { mutableStateOf(Notifier.allowed(ctx)) }
    val perm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { notifOk = it }
    val saver = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri ->
        val snap = Repo.snap
        if (uri != null && snap != null) scope.launch {
            val ok = withContext(Dispatchers.IO) { runCatching { ctx.contentResolver.openOutputStream(uri)?.use { Briefing.write(it, snap, Repo.watch.toList()) } }.isSuccess }
            msg = if (ok) "Briefing enregistré." else "Le briefing n’a pas pu être enregistré."
        }
    }
    val watch = Repo.watch.toList()
    val suggestions = remember(s, watch) {
        val all = s?.events.orEmpty()
        val techs = all.flatMap { it.techs }.groupingBy { it }.eachCount().entries.sortedByDescending { it.value }.map { it.key }
        val sectors = all.flatMap { it.sectors }.distinct()
        (techs.take(14) + sectors.take(4)).filter { c -> watch.none { it.equals(c, true) } }.take(14)
    }
    val rules = Repo.rules
    fun setRules(r: Rules) {
        Repo.updateRules(r)
        if (!notifOk && Build.VERSION.SDK_INT >= 33) perm.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    Column(Modifier.fillMaxSize()) {
        ScreenHead("Ma veille", "Votre périmètre reste sur ce téléphone")
        LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { SectionHead("Liste de surveillance", watch.size) }
            item {
                Panel {
                    Text("Logiciels, fournisseurs cloud, systèmes et secteurs. Une fiche est signalée « Ma veille » dès qu’un de ces termes y figure.", style = ts(13.0, color = C.dim, lh = 18.5))
                    Spacer(Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Field(term, { term = it }, "Ajouter : Fortinet, AWS, Santé…", Modifier.weight(1f), icon = Ic.plus, onDone = { Repo.addWatch(term); term = "" })
                        Spacer(Modifier.width(8.dp))
                        Button("Ajouter", primary = true) { Repo.addWatch(term); term = "" }
                    }
                    if (watch.isNotEmpty()) {
                        Spacer(Modifier.height(12.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            watch.forEach { w ->
                                Row(Modifier.clip(RoundedCornerShape(9.dp)).background(C.blueDeep).clickable { Repo.removeWatch(w) }.padding(start = 11.dp, end = 8.dp, top = 7.dp, bottom = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text(w, style = ts(13.0, FontWeight.Medium))
                                    Spacer(Modifier.width(7.dp))
                                    Icon(Ic.close, "Retirer $w", tint = C.dim, modifier = Modifier.size(14.dp))
                                }
                            }
                        }
                    }
                    if (suggestions.isNotEmpty()) {
                        Spacer(Modifier.height(12.dp))
                        Eyebrow("Cités dans les fiches actuelles")
                        Spacer(Modifier.height(7.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            suggestions.forEach { c -> Chip("+ $c", false) { Repo.addWatch(c) } }
                        }
                    }
                }
            }

            item { SectionHead("Alertes") }
            item {
                Panel {
                    Text("Pour les fiches de votre liste et celles que vous suivez (étoile). Les changements d’un même incident sont regroupés en une seule notification.", style = ts(13.0, color = C.dim, lh = 18.5))
                    RuleRow("Un correctif paraît", "Un correctif devient référencé pour une vulnérabilité suivie.", rules.patch) { setRules(rules.copy(patch = it)) }
                    RuleRow("Une exploitation est confirmée", "Inscription au catalogue CISA KEV ou passage au statut confirmé.", rules.exploit) { setRules(rules.copy(exploit = it)) }
                    RuleRow("Le périmètre d’un incident change", "Nouvelle fiche dans votre périmètre, versions, pays, secteurs ou ampleur modifiés.", rules.scope) { setRules(rules.copy(scope = it)) }
                    Spacer(Modifier.height(10.dp))
                    if (notifOk) Text("Notifications autorisées · vérification toutes les 30 minutes environ.", style = ts(12.0, color = C.green))
                    else Button("Autoriser les notifications", Ic.bell, modifier = Modifier.fillMaxWidth()) { if (Build.VERSION.SDK_INT >= 33) perm.launch(Manifest.permission.POST_NOTIFICATIONS) }
                    if (Repo.followed.isNotEmpty()) Text("${Repo.followed.size} fiche(s) suivie(s) individuellement.", style = ts(12.0, color = C.faint), modifier = Modifier.padding(top = 4.dp))
                }
            }

            item { SectionHead("Briefing") }
            item {
                Panel {
                    Text("Document PDF sourcé : votre périmètre, les incidents confirmés, les vulnérabilités exploitées, la date de génération et les incertitudes encore ouvertes.", style = ts(13.0, color = C.dim, lh = 18.5))
                    Spacer(Modifier.height(10.dp))
                    Button("Exporter le briefing en PDF", Ic.doc, primary = true, modifier = Modifier.fillMaxWidth()) {
                        msg = null
                        saver.launch("sentinel-briefing-${java.time.LocalDate.now()}.pdf")
                    }
                    msg?.let { Text(it, style = ts(12.5, color = C.green), modifier = Modifier.padding(top = 8.dp)) }
                }
            }

            item { SectionHead("État des sources", s?.sources?.size) }
            if (s == null) item { Note("Aucun instantané synchronisé.") }
            else {
                item { Note("Dernière collecte du serveur : ${dateTime(s.generatedAt)}. Une source en défaut reste affichée avec la date de ses dernières données.") }
                items(s.sources, key = { it.id }) { SourceRow(it) }
            }

            item { SectionHead("Serveur") }
            item {
                Panel {
                    Text("Adresse de l’API ou de son miroir statique. Voir le guide d’installation du serveur.", style = ts(13.0, color = C.dim, lh = 18.5))
                    Spacer(Modifier.height(10.dp))
                    Field(serverField, { serverField = it }, "https://exemple.fr/api", Modifier.fillMaxWidth(), icon = Ic.link, onDone = { Repo.updateServer(serverField); scope.launch { Repo.sync() } })
                    Spacer(Modifier.height(10.dp))
                    Button(if (Repo.syncing) "Synchronisation…" else "Enregistrer et synchroniser", Ic.refresh, modifier = Modifier.fillMaxWidth()) { Repo.updateServer(serverField); serverField = Repo.server; scope.launch { Repo.sync() } }
                    Spacer(Modifier.height(10.dp))
                    Text("Dernière synchronisation réussie : ${Repo.lastSync?.let { dateTime(it) } ?: "jamais"}" + if (Repo.fromSeed) " · données embarquées dans l’application" else "", style = ts(12.0, color = C.dim, lh = 17.0))
                    Repo.lastError?.let { Text("Dernière tentative en échec : $it", style = ts(12.0, color = C.orange, lh = 17.0), modifier = Modifier.padding(top = 3.dp)) }
                }
            }

            item { SectionHead("Méthode") }
            item {
                Note("Les fiches sont construites automatiquement à partir des publications des sources listées ci-dessus. Statut, type, pays et secteurs sont déduits du texte des sources par des règles : ils peuvent être incomplets ou erronés et doivent être vérifiés dans les publications d’origine. Une information absente est indiquée comme telle, jamais devinée. Version ${BuildConfig.VERSION_NAME}.")
            }
        }
    }
}

@Composable
private fun RuleRow(title: String, sub: String, on: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(top = 13.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 12.dp)) {
            Text(title, style = ts(14.5, FontWeight.Medium))
            Text(sub, style = ts(12.0, color = C.faint, lh = 16.5), modifier = Modifier.padding(top = 2.dp))
        }
        Toggle(on, onChange)
    }
}

@Composable
private fun SourceRow(src: Source) {
    val ok = src.lastError == null && src.lastSuccess != null
    val col = when { ok -> C.green; src.lastSuccess != null -> C.orange; else -> C.red }
    Panel {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(col))
            Spacer(Modifier.width(9.dp))
            Text(src.name, style = ts(14.5, FontWeight.Medium), modifier = Modifier.weight(1f))
            Eyebrow(if (ok) "Flux actif" else "Indisponible", col)
        }
        Text("${kindLabel(src.kind)} · ${src.org}", style = ts(12.0, color = C.faint), modifier = Modifier.padding(top = 3.dp, start = 17.dp))
        Text("Dernière collecte réussie : ${src.lastSuccess?.let { dateTime(it) } ?: "aucune"}", style = ts(12.0, color = C.dim, mono = true, lh = 17.0), modifier = Modifier.padding(top = 5.dp, start = 17.dp))
        Text("Donnée la plus récente : ${src.lastItemAt?.let { dateTime(it) } ?: "date non communiquée"}", style = ts(12.0, color = C.dim, mono = true, lh = 17.0), modifier = Modifier.padding(start = 17.dp))
        src.lastError?.let { Text("Dernière tentative (${src.lastAttempt?.let { t -> dateTime(t) } ?: "date inconnue"}) : $it", style = ts(12.0, color = C.orange, lh = 17.0), modifier = Modifier.padding(top = 3.dp, start = 17.dp)) }
    }
}
