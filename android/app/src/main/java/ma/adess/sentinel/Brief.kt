package ma.adess.sentinel

import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// ───────────── Lire l'article ─────────────
private val PUB_RANK = mapOf("officiel" to 4, "editeur" to 3, "recherche" to 2, "donnees" to 1)

/** Publication à ouvrir en priorité : source d'origine (pas une reprise), autorité d'abord, puis la plus ancienne. */
fun articlePub(e: Event): Pub? {
    val ok = e.pubs.filter { it.url.startsWith("http") }
    val orig = ok.filter { it.derivedFrom == null }.ifEmpty { ok }
    return orig.sortedWith(compareByDescending<Pub> { PUB_RANK[it.kind] ?: 0 }.thenBy { it.publishedAt ?: it.collectedAt }).firstOrNull()
}

fun articleUrl(e: Event): String? =
    if (e.fictif) null else articlePub(e)?.url ?: if (e.kind == "vuln") "https://nvd.nist.gov/vuln/detail/${e.id}" else null

@Composable
fun ReadButton(e: Event, open: (String?) -> Unit, onMore: () -> Unit) {
    val url = articleUrl(e)
    if (url != null) {
        val p = articlePub(e)
        val others = e.pubs.size - (if (p != null) 1 else 0)
        Column {
            Button(if (p != null) "Lire l’article · ${p.src}" else "Lire la fiche NVD", Ic.link, primary = true, modifier = Modifier.fillMaxWidth()) { open(url) }
            if (others > 0) {
                val s = if (others > 1) "s" else ""
                Text(
                    "$others autre$s source$s dans l’analyse technique ›", style = ts(12.5, FontWeight.Medium, C.blue),
                    modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onMore).padding(vertical = 8.dp, horizontal = 2.dp),
                )
            }
        }
    }
}

// ───────────── À la une ─────────────
// Sujets des dernières 36 h dont tout le monde parle : nombre de sources, grand éditeur touché, panne mondiale, faille critique exploitée.
// Le statut n'entre pas dans le tri : une panne « signalée » mais couverte partout reste à la une.
private val BIG = Regex("\\b(microsoft|outlook|teams|azure|windows|google|gmail|android|chrome|apple|icloud|iphone|amazon|aws|cloudflare|meta|facebook|instagram|whatsapp|crowdstrike|cisco|fortinet|palo alto|oracle|salesforce|openai|chatgpt|twitter|starlink|visa|mastercard|swift)\\b", RegexOption.IGNORE_CASE)
private val WORLD = Regex("mondial|worldwide|global", RegexOption.IGNORE_CASE)
private val IMPACT = Regex("\\b(millions?|stole|stolen|steals?|breach(ed)?|hacked|ransom\\w*|rançon\\w*|vol (massif )?de données|revendique|piraté\\w*|cyberattaque|cyberattack|payment|leak(ed)?|fuite|outage|panne)\\b", RegexOption.IGNORE_CASE)
private const val H = 3_600_000L
private fun dayMs(d: String): Long? = runCatching { java.time.LocalDate.parse(d.take(10)).atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli() }.getOrNull()

fun headlines(real: List<Event>, now: Long = System.currentTimeMillis()): List<Event> {
    val since = now - 36 * 3_600_000L
    data class S(val e: Event, val score: Int, val key: String)
    // Score : couverture + importance, moins l'âge du sujet (1 point toutes les 8 h depuis sa première publication).
    // Un sujet ancien ne reste à la une que s'il a reçu un nouvel article dans les 12 dernières heures.
    val scored = real.map { e ->
        val v = e.vuln
        val big = BIG.find(e.title)?.value?.lowercase()
        val kevAt = v?.kev?.added?.let { dayMs(it) }
        val score = if (e.kind == "incident" && e.recency >= since) {
            val first = (e.pubs.map { it.publishedAt ?: it.collectedAt } + listOfNotNull(e.disclosedAt, e.firstSeenAt)).minOrNull() ?: now
            val last = e.pubs.maxOfOrNull { it.collectedAt } ?: 0L
            e.sourceCount * 2 + (if (big != null) 3 else 0) + (if (e.type == "panne") 2 else 0) + (if (e.status == "confirme") 1 else 0) + (if (WORLD.containsMatchIn(e.title)) 2 else 0) +
                (if (IMPACT.containsMatchIn(e.title)) 2 else 0) + (if (e.versions.size > 1 && now - last < 12 * H) 2 else 0) - ((now - first) / (8 * H)).toInt()
        } else if (v?.kev != null && kevAt != null && kevAt >= now - 48 * H) {
            3 + (if ((v.cvss ?: 0.0) >= 9) 2 else 0) + (if (v.kev.ransomware == "Known") 2 else 0) + (if (big != null) 2 else 0) - ((now - kevAt) / (12 * H)).toInt()
        } else 0
        val key = if (e.type == "panne" && big != null) "panne:" + big.replace(Regex("outlook|teams|azure|windows"), "microsoft") else e.id
        S(e, score, key)
    }.filter { it.score >= 4 }.sortedWith(compareByDescending<S> { it.score }.thenByDescending { it.e.recency })
    val seen = HashSet<String>()
    return scored.filter { seen.add(it.key) }.map { it.e }.take(5)
}

// ───────────── Briefing texte (à copier ou partager) ─────────────
val BRIEF_P = listOf(24 to "24 h", 72 to "72 h", 168 to "7 jours")

fun briefData(s: Snapshot, watch: List<String>, hours: Int, now: Long = System.currentTimeMillis()): List<Pair<String, List<Event>>> {
    val since = now - hours * 3_600_000L
    val sinceDay = java.time.Instant.ofEpochMilli(since).toString().take(10)
    val real = s.events.filter { !it.fictif }
    val out = mutableListOf(
        "Failles activement exploitées (ajouts KEV)" to real.filter { (it.vuln?.kev?.added ?: "") >= sinceDay }.sortedByDescending { it.vuln?.cvss ?: 0.0 },
        "Incidents confirmés" to real.filter { it.kind == "incident" && it.status == "confirme" && it.recency >= since }.sortedByDescending { it.recency },
        "Revendications (non vérifiées)" to real.filter { it.kind == "incident" && it.status == "revendique" && it.recency >= since }.sortedByDescending { it.recency },
        "Maroc" to real.filter { e -> e.countries.any { it.code == "MA" } && e.recency >= since }.sortedByDescending { it.recency },
    )
    if (watch.isNotEmpty()) out += "Ma veille" to real.filter { watchMatch(it, watch) && it.recency >= since }.sortedByDescending { it.recency }
    out += "Fiches qui ont évolué" to real.filter { it.versions.size > 1 && it.updatedAt >= since }.sortedByDescending { it.updatedAt }
    return out
}

fun briefText(s: Snapshot, watch: List<String>, hours: Int): String {
    val label = BRIEF_P.first { it.first == hours }.second
    val sb = StringBuilder()
    sb.append("SENTINEL CYBER — Briefing des dernières $label\n")
    sb.append("Données collectées le ${dateTime(s.generatedAt)}\n\n")
    for ((t, list) in briefData(s, watch, hours)) {
        if (list.isEmpty()) continue
        sb.append("■ $t (${list.size})\n")
        for (e in list.take(10)) {
            val v = e.vuln
            val title = if (v != null) "${v.cve} — ${e.title}" else e.title
            val extra = if (v != null) {
                listOfNotNull(v.cvss?.let { "CVSS $it" }, if (v.kev?.ransomware == "Known") "utilisée par des rançongiciels" else null, if (v.patch == "oui") "correctif disponible" else null).joinToString(" · ")
            } else {
                listOfNotNull(statusLabel(e.status, false), e.countries.take(3).joinToString(", ") { it.name }.ifBlank { null }, articlePub(e)?.src).joinToString(" · ")
            }
            sb.append("• $title${if (extra.isNotBlank()) " ($extra)" else ""}\n")
            articleUrl(e)?.let { sb.append("  $it\n") }
        }
        if (list.size > 10) sb.append("  … et ${list.size - 10} autre(s)\n")
        sb.append("\n")
    }
    sb.append("Statuts établis à partir des sources publiques : à vérifier dans les publications d’origine.")
    return sb.toString()
}

@Composable
fun BriefScreen(nav: Nav) {
    val s = Repo.snap
    val ctx = LocalContext.current
    val clip = LocalClipboardManager.current
    var sel by rememberSaveable { mutableStateOf(0) }
    Column(Modifier.fillMaxSize()) {
        TopBar("Briefing", onBack = { nav.pop() })
        if (s == null) {
            EmptyState("Aucune donnée", "Synchronisez d’abord les fiches.")
        } else {
            val hours = BRIEF_P[sel].first
            val label = BRIEF_P[sel].second
            val watch = Repo.watch.toList()
            val data = remember(s, watch, hours) { briefData(s, watch, hours) }
            val n = { p: String -> data.firstOrNull { it.first.startsWith(p) }?.second?.size ?: 0 }
            LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 40.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                item { Text("Données collectées le ${dateTime(s.generatedAt)}", style = ts(12.5, color = C.dim)) }
                item { Segmented(BRIEF_P.map { it.second }, sel) { sel = it } }
                item {
                    Panel(accent = C.blue) {
                        Eyebrow("En bref", C.blue)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "${n("Failles")} faille(s) exploitée(s) ajoutée(s) au catalogue KEV, ${n("Incidents")} incident(s) confirmé(s), ${n("Revendications")} revendication(s) et ${n("Maroc")} fiche(s) sur le Maroc ces dernières $label.",
                            style = ts(14.0, lh = 20.0),
                        )
                        Spacer(Modifier.height(12.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Button("Copier", Ic.doc, primary = true, modifier = Modifier.weight(1f)) {
                                clip.setText(AnnotatedString(briefText(s, watch, hours)))
                                Toast.makeText(ctx, "Briefing copié : collez-le dans un mail ou WhatsApp.", Toast.LENGTH_SHORT).show()
                            }
                            Button("Partager", Ic.link, modifier = Modifier.weight(1f)) {
                                val i = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_SUBJECT, "Briefing SENTINEL CYBER")
                                    putExtra(Intent.EXTRA_TEXT, briefText(s, watch, hours))
                                }
                                runCatching { ctx.startActivity(Intent.createChooser(i, "Partager le briefing").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                            }
                        }
                    }
                }
                if (data.all { it.second.isEmpty() }) item { Note("Rien de nouveau dans les publications collectées ces dernières $label.") }
                for ((t, list) in data) {
                    if (list.isEmpty()) continue
                    item(key = "h$t") { SectionHead(t, list.size) }
                    items(list.take(8), key = { "$t/${it.id}" }) { EventCard(it, nav) }
                    if (list.size > 8) item(key = "m$t") { Note("… et ${list.size - 8} autre(s), incluses dans le texte copié.") }
                }
            }
        }
    }
}
