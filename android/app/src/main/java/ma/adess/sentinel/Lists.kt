@file:OptIn(ExperimentalLayoutApi::class)

package ma.adess.sentinel

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog

/** Carte d'une fiche : type, titre, statut, gravité, sources et dernière évolution visibles d'un coup d'œil. */
@Composable
fun EventCard(e: Event, nav: Nav, modifier: Modifier = Modifier) {
    val watched = Repo.isWatched(e)
    val seen = Repo.seen[e.id]
    val unread = seen != null && seen < e.last.n
    Panel(modifier, onClick = { nav.open(e.id) }, accent = if (e.fictif) C.violet else if (e.severity != "inconnue") sevColor(e.severity) else null) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Eyebrow(if (e.kind == "vuln") e.id else typeLabel(e.type), if (e.kind == "vuln") C.blue else C.dim, Modifier.weight(1f, fill = false))
            if (watched) { Spacer(Modifier.width(8.dp)); Eyebrow("Ma veille", C.blue) }
            if (unread) { Spacer(Modifier.width(8.dp)); Eyebrow("Mise à jour", C.yellow) }
            Spacer(Modifier.weight(1f))
            Text(ago(e.recency), style = ts(11.0, color = C.faint, mono = true), maxLines = 1)
        }
        Spacer(Modifier.height(7.dp))
        if (e.fictif) { FictifBadge(); Spacer(Modifier.height(7.dp)) }
        Text(e.title.removePrefix("[FICTIF] "), style = ts(15.5, FontWeight.SemiBold, lh = 21.0), maxLines = 3, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(10.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            StatusChip(e.status)
            if (e.severity != "inconnue") Box(Modifier.padding(top = 3.dp)) { SeverityMeter(e.severity) }
            e.vuln?.let { v ->
                v.cvss?.let { Pill("CVSS $it", sevColor(e.severity)) }
                v.epss?.let { Pill("EPSS ${pct(it)}") }
                if (v.kev != null) Pill("KEV", C.orange, filled = true)
                if (v.patch == "oui") Pill("Correctif", C.green, filled = true)
            }
            if (e.pubs.isNotEmpty()) Pill(if (e.sourceCount > 1) "${e.sourceCount} sources" else e.pubs.first().src)
            e.countries.take(2).forEach { Pill(it.name) }
        }
        if (e.versions.size > 1) {
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("v${e.last.n}", style = ts(11.0, FontWeight.Medium, C.blue, mono = true))
                Spacer(Modifier.width(7.dp))
                Text(e.last.note, style = ts(12.5, color = C.dim), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
fun PickDialog(title: String, options: List<Pair<String, String>>, selected: Set<String>, onChange: (Set<String>) -> Unit, onClose: () -> Unit) {
    Dialog(onDismissRequest = onClose) {
        val shape = RoundedCornerShape(18.dp)
        Column(Modifier.fillMaxWidth().clip(shape).background(C.raised).border(1.dp, C.line, shape).padding(18.dp)) {
            Text(title, style = ts(17.0, FontWeight.SemiBold))
            Spacer(Modifier.height(10.dp))
            LazyColumn(Modifier.heightIn(max = 420.dp)) {
                items(options) { (key, label) ->
                    val on = key in selected
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable { onChange(if (on) selected - key else selected + key) }.padding(vertical = 11.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(18.dp).clip(RoundedCornerShape(5.dp)).background(if (on) C.blue else C.surface).border(1.dp, if (on) C.blue else C.faint, RoundedCornerShape(5.dp)))
                        Spacer(Modifier.width(12.dp))
                        Text(label, style = ts(14.5, color = if (on) C.text else C.dim))
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button("Tout effacer", modifier = Modifier.weight(1f)) { onChange(emptySet()) }
                Button("Appliquer", primary = true, modifier = Modifier.weight(1f), onClick = onClose)
            }
        }
    }
}

@Composable
fun IncidentsScreen(nav: Nav) {
    val s = Repo.snap
    if (s == null) { EmptyState("Aucune donnée", "Aucune fiche n’a encore été synchronisée. Vérifiez la connexion dans l’onglet Ma veille."); return }
    val f = nav.filters
    val kind = if (nav.incView == 1) "actu" else "incident"
    val base = remember(s, kind) { s.events.filter { it.kind == kind }.sortedByDescending { it.recency } }
    val list = remember(base, f) { base.filter { f.match(it) } }
    var pick by remember { mutableStateOf<String?>(null) }

    Column(Modifier.fillMaxSize()) {
        ScreenHead("Incidents", if (nav.incView == 2) "Localisations documentées par les sources" else "${list.size} fiche(s) · triées par dernière évolution")
        Segmented(listOf("Incidents", "Actualités", "Carte"), nav.incView, Modifier.padding(horizontal = 16.dp)) { nav.incView = it; nav.filters = FilterSet() }
        Spacer(Modifier.height(10.dp))
        if (nav.incView == 2) { MapView(s, nav); return@Column }
        Field(f.query, { nav.filters = f.copy(query = it) }, "Organisation, produit, mot-clé…", Modifier.padding(horizontal = 16.dp).fillMaxWidth())
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            fun lbl(name: String, n: Int) = if (n > 0) "$name · $n" else name
            Chip(lbl("Statut", f.status.size), f.status.isNotEmpty()) { pick = "status" }
            if (kind == "incident") Chip(lbl("Gravité", f.severity.size), f.severity.isNotEmpty()) { pick = "severity" }
            Chip(lbl("Type", f.type.size), f.type.isNotEmpty()) { pick = "type" }
            Chip(lbl("Pays", f.country.size), f.country.isNotEmpty()) { pick = "country" }
            if (kind == "incident") Chip(lbl("Secteur", f.sector.size), f.sector.isNotEmpty()) { pick = "sector" }
            Chip(lbl("Technologie", f.tech.size), f.tech.isNotEmpty()) { pick = "tech" }
            if (f.active > 0) Chip("Réinitialiser", false) { nav.filters = FilterSet() }
        }
        if (list.isEmpty()) EmptyState("Aucune fiche", if (f.active > 0) "Aucune fiche ne correspond à ces filtres." else "Aucune publication de ce type n’a été collectée.")
        else LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(list, key = { it.id }) { EventCard(it, nav) }
        }
    }

    pick?.let { which ->
        val (title, options, current) = when (which) {
            "status" -> Triple("État de confirmation", listOf("confirme", "signale", "revendique", "conteste").map { it to statusLabel(it, true) }, f.status)
            "severity" -> Triple("Niveau de gravité", listOf("critique", "elevee", "moyenne", "faible", "inconnue").map { it to sevLabel(it) }, f.severity)
            "type" -> Triple("Type", base.map { it.type }.distinct().map { it to typeLabel(it) }.sortedBy { it.second }, f.type)
            "country" -> Triple("Pays mentionné", base.flatMap { it.countries }.distinctBy { it.code }.sortedBy { it.name }.map { it.code to it.name }, f.country)
            "sector" -> Triple("Secteur", base.flatMap { it.sectors }.distinct().sorted().map { it to it }, f.sector)
            else -> Triple("Technologie", base.flatMap { it.techs }.groupingBy { it }.eachCount().entries.sortedByDescending { it.value }.take(40).map { it.key to "${it.key} (${it.value})" }, f.tech)
        }
        PickDialog(title, options, current, onChange = { sel ->
            nav.filters = when (which) {
                "status" -> f.copy(status = sel); "severity" -> f.copy(severity = sel); "type" -> f.copy(type = sel)
                "country" -> f.copy(country = sel); "sector" -> f.copy(sector = sel); else -> f.copy(tech = sel)
            }
        }, onClose = { pick = null })
    }
}

@Composable
private fun MapView(s: Snapshot, nav: Nav) {
    val incidents = remember(s) { s.events.filter { it.kind == "incident" && !it.fictif } }
    val marks = remember(s) { markersOf(s.events) }
    var sel by remember { mutableStateOf<String?>(null) }
    val shown = remember(incidents, sel) { incidents.filter { e -> if (sel == null) e.countries.isNotEmpty() else e.countries.any { it.code == sel } }.sortedByDescending { it.recency } }
    val unlocated = incidents.count { it.countries.isEmpty() }
    LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Panel {
                WorldMap(marks, sel) { sel = it }
                Spacer(Modifier.height(8.dp))
                Text("Chaque point est un pays cité par les sources d’un incident ; il ne désigne pas forcément le lieu de l’attaque. $unlocated incident(s) sans localisation documentée ne figurent pas sur la carte.", style = ts(11.5, color = C.faint, lh = 16.0))
            }
        }
        item {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                marks.forEach { m -> Chip("${m.name} · ${m.count}", sel == m.code) { sel = if (sel == m.code) null else m.code } }
            }
        }
        item { SectionHead(marks.firstOrNull { it.code == sel }?.name ?: "Incidents localisés", shown.size) }
        if (shown.isEmpty()) item { EmptyState("Aucune localisation", "Aucun pays n’est mentionné dans les sources des incidents collectés.") }
        items(shown, key = { it.id }) { EventCard(it, nav) }
    }
}

@Composable
fun VulnsScreen(nav: Nav) {
    val s = Repo.snap
    if (s == null) { EmptyState("Aucune donnée", "Aucune fiche n’a encore été synchronisée."); return }
    val watch = Repo.watch.toList()
    val flags = nav.vulnFlags
    val q = nav.vulnQuery
    val list = remember(s, watch, flags, q) {
        s.events.filter { it.kind == "vuln" }.filter { e ->
            val v = e.vuln
            ("kev" !in flags || v?.kev != null) && ("patch" !in flags || v?.patch == "oui") && ("ransom" !in flags || v?.kev?.ransomware == "Known") &&
                ("veille" !in flags || watchMatch(e, watch)) && (q.isBlank() || e.hay.contains(q.trim().lowercase()))
        }.sortedWith(compareByDescending<Event> { priority(it, watchMatch(it, watch)).score }.thenByDescending { it.vuln?.kev?.added ?: "" }.thenByDescending { it.recency })
    }
    Column(Modifier.fillMaxSize()) {
        ScreenHead("Vulnérabilités", "${list.size} fiche(s) · triées par priorité défensive")
        Field(q, { nav.vulnQuery = it }, "CVE, éditeur, produit…", Modifier.padding(horizontal = 16.dp).fillMaxWidth())
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            fun flip(k: String) { nav.vulnFlags = if (k in flags) flags - k else flags + k }
            Chip("Ma veille", "veille" in flags) { flip("veille") }
            Chip("Exploitée (KEV)", "kev" in flags) { flip("kev") }
            Chip("Correctif référencé", "patch" in flags) { flip("patch") }
            Chip("Rançongiciel", "ransom" in flags) { flip("ransom") }
        }
        if (list.isEmpty()) EmptyState("Aucune vulnérabilité", if ("veille" in flags && watch.isEmpty()) "Votre liste de surveillance est vide : ajoutez des produits dans l’onglet Ma veille." else "Aucune fiche ne correspond à ces critères.")
        else LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(list, key = { it.id }) { e ->
                Column {
                    EventCard(e, nav)
                    Text(priority(e, watchMatch(e, watch)).sentence, style = ts(12.0, color = C.dim, lh = 17.0), modifier = Modifier.padding(start = 15.dp, end = 8.dp, top = 6.dp, bottom = 4.dp))
                }
            }
        }
    }
}
