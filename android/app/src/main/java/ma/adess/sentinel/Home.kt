package ma.adess.sentinel

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

private class HomeData(val confirmed: List<Event>, val confirmedTotal: Int, val evolutions: List<Event>, val mine: List<Event>, val kevWeek: Int, val marks: List<Marker>, val demo: Event?)

private fun homeData(s: Snapshot, watch: List<String>, now: Long): HomeData {
    val real = s.events.filter { !it.fictif }
    val h72 = now - 72 * 3_600_000L
    val confirmed = real.filter { it.kind == "incident" && it.status == "confirme" && it.recency >= h72 }.sortedByDescending { it.recency }
    val evol = real.filter { it.versions.size > 1 && it.updatedAt >= h72 }.sortedByDescending { it.updatedAt }
    val mine = real.filter { watchMatch(it, watch) && it.recency >= now - 14 * 86_400_000L }.sortedByDescending { priority(it, true).score * 1_000_000_000_000L + it.recency / 1000 }
    val weekAgo = java.time.Instant.ofEpochMilli(now - 7 * 86_400_000L).toString().take(10)
    val kev = real.count { (it.vuln?.kev?.added ?: "") >= weekAgo }
    return HomeData(confirmed.take(6), confirmed.size, evol.take(6), mine.take(6), kev, markersOf(real), s.events.firstOrNull { it.fictif })
}

@Composable
fun HomeScreen(nav: Nav) {
    val s = Repo.snap
    val scope = rememberCoroutineScope()
    if (s == null) {
        Column {
            Wordmark()
            EmptyState(if (Repo.loading) "Chargement des fiches…" else "Première synchronisation", Repo.lastError?.let { "Le serveur est injoignable : $it. Aucune fiche n’est encore en cache." } ?: "Récupération des fiches en cours…")
            Button("Réessayer", Ic.refresh, modifier = Modifier.padding(horizontal = 28.dp)) { scope.launch { Repo.sync() } }
        }
        return
    }
    val watch = Repo.watch.toList()
    val d = remember(s, watch) { homeData(s, watch, System.currentTimeMillis()) }
    val okSources = remember(s) { s.sources.count { it.lastError == null && it.lastSuccess != null } }

    LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { Wordmark(pad = false) }
                SyncPill(s) { scope.launch { Repo.sync() } }
            }
        }
        if (Repo.lastError != null || Repo.fromSeed) item {
            Panel(accent = C.orange) {
                Eyebrow(if (Repo.fromSeed) "Données embarquées" else "Hors connexion", C.orange)
                Spacer(Modifier.height(4.dp))
                Text(
                    (if (Repo.fromSeed) "Vous consultez l’instantané intégré à l’application, collecté le ${dateTime(s.generatedAt)}." else "Dernières fiches synchronisées : données du ${dateTime(s.generatedAt)}.") +
                        (Repo.lastError?.let { " Serveur injoignable : $it." } ?: ""),
                    style = ts(13.0, color = C.dim, lh = 18.5),
                )
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Stat("Incidents confirmés", d.confirmedTotal.toString(), "72 heures", C.green, Modifier.weight(1f)) { nav.tab = 1; nav.incView = 0; nav.filters = FilterSet(status = setOf("confirme")) }
                Stat("Inscriptions KEV", d.kevWeek.toString(), "7 jours", C.orange, Modifier.weight(1f)) { nav.tab = 2; nav.vulnFlags = setOf("kev") }
                Stat("Sources", "$okSources/${s.sources.size}", "joignables", if (okSources == s.sources.size) C.blue else C.yellow, Modifier.weight(1f)) { nav.tab = 4 }
            }
        }
        val une = headlines(s.events.filter { !it.fictif })
        if (une.isNotEmpty()) {
            item { Row(Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) { Text("À la une", style = ts(17.0, FontWeight.SemiBold, C.orange)); Spacer(Modifier.width(8.dp)); Text(une.size.toString(), style = ts(12.0, FontWeight.Medium, C.faint, mono = true)) } }
            items(une, key = { "u" + it.id }) { EventCard(it, nav) }
        }
        item { Button("Briefing des dernières 24 h", Ic.doc, primary = true, modifier = Modifier.fillMaxWidth()) { nav.brief() } }
        item {
            Panel(onClick = { nav.tab = 1; nav.incView = 2 }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Eyebrow("Localisations documentées", C.dim, Modifier.weight(1f))
                    Text("${d.marks.size} pays", style = ts(11.0, color = C.faint, mono = true))
                    Icon(Ic.chevron, null, tint = C.faint, modifier = Modifier.size(16.dp))
                }
                Spacer(Modifier.height(8.dp))
                WorldMap(d.marks, null)
            }
        }

        val maroc = s.events.filter { e -> !e.fictif && e.countries.any { it.code == "MA" } }.sortedByDescending { it.recency }
        item { SectionHead("Maroc", maroc.size, "Incidents") { nav.tab = 1; nav.incView = 0; nav.filters = FilterSet(country = setOf("MA")) } }
        if (maroc.isEmpty()) item { Note("Aucune fiche ne mentionne le Maroc dans les publications collectées (DGSSI, presse marocaine, revendications de rançongiciels).") }
        items(maroc.take(6), key = { "ma" + it.id }) { EventCard(it, nav) }

        item { SectionHead("Nouveaux incidents confirmés", d.confirmedTotal, "Tout voir") { nav.tab = 1; nav.incView = 0; nav.filters = FilterSet(status = setOf("confirme")) } }
        if (d.confirmed.isEmpty()) item { Note("Aucun incident confirmé sur les 72 dernières heures dans les publications collectées.") }
        items(d.confirmed, key = { "c" + it.id }) { EventCard(it, nav) }

        item { SectionHead("Évolutions importantes", d.evolutions.size) }
        if (d.evolutions.isEmpty()) item { Note("Aucune fiche n’a changé de version sur les 72 dernières heures. Les corrections et nouveaux faits apparaîtront ici, avec ce qui a changé.") }
        items(d.evolutions, key = { "e" + it.id }) { EventCard(it, nav) }

        item { SectionHead("Vos technologies suivies", if (watch.isEmpty()) null else d.mine.size, if (watch.isEmpty()) "Configurer" else "Ma veille") { nav.tab = 4 } }
        if (watch.isEmpty()) item { Note("Enregistrez les logiciels, fournisseurs cloud et secteurs que vous surveillez : les alertes qui les concernent remonteront ici en priorité.") }
        else if (d.mine.isEmpty()) item { Note("Aucune fiche récente ne concerne : ${watch.joinToString(", ")}.") }
        items(d.mine, key = { "m" + it.id }) { EventCard(it, nav) }

        d.demo?.let { demo ->
            item { SectionHead("Démonstration") }
            item { Note("Scénario inventé pour montrer la comparaison de versions : un éditeur confirme une intrusion, puis révèle que ses sauvegardes ont été touchées.") }
            item { EventCard(demo, nav) }
        }
    }
}

@Composable
private fun Wordmark(pad: Boolean = true) {
    Row(Modifier.padding(if (pad) 16.dp else 0.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(9.dp).clip(RoundedCornerShape(2.dp)).background(C.blue))
        Spacer(Modifier.width(9.dp))
        Text("SENTINEL", style = ts(17.0, FontWeight.Medium, C.text, mono = true, ls = 3.2))
        Spacer(Modifier.width(7.dp))
        Text("CYBER", style = ts(17.0, FontWeight.Normal, C.blue, mono = true, ls = 3.2))
    }
}

@Composable
private fun SyncPill(s: Snapshot, onClick: () -> Unit) {
    val col = when { Repo.syncing -> C.blue; Repo.lastError != null || Repo.fromSeed -> C.orange; else -> C.green }
    val label = when { Repo.syncing -> "Synchronisation…"; else -> "Collecte ${ago(s.generatedAt)}" }
    Row(Modifier.clip(RoundedCornerShape(9.dp)).clickable(onClick = onClick).padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(col))
        Spacer(Modifier.width(7.dp))
        Text(label, style = ts(11.5, color = C.dim, mono = true), maxLines = 1)
        Spacer(Modifier.width(6.dp))
        Icon(Ic.refresh, "Synchroniser", tint = C.faint, modifier = Modifier.size(15.dp))
    }
}

@Composable
private fun Stat(label: String, value: String, sub: String, color: Color, modifier: Modifier, onClick: () -> Unit) {
    Panel(modifier, onClick = onClick) {
        Text(value, style = ts(25.0, FontWeight.Medium, color, mono = true, ls = -0.5), maxLines = 1)
        Spacer(Modifier.height(5.dp))
        Text(label, style = ts(12.0, FontWeight.Medium, C.text, lh = 15.0), maxLines = 2)
        Text(sub, style = ts(11.0, color = C.faint), maxLines = 1)
    }
}

@Composable
fun Note(text: String) {
    Text(text, style = ts(13.0, color = C.dim, lh = 19.0), modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp))
}
