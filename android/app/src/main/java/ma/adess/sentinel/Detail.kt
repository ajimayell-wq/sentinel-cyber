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
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp

@Composable
fun DetailScreen(id: String, nav: Nav) {
    val s = Repo.snap
    val e = s?.event(id)
    if (s == null || e == null) {
        Column { TopBar("Fiche", onBack = { nav.pop() }); EmptyState("Fiche introuvable", "Cette fiche ne figure plus dans l’instantané synchronisé.") }
        return
    }
    // Version que l'utilisateur avait vue AVANT d'ouvrir la fiche : sert à « Quoi de neuf depuis ma dernière visite ? »
    val prev = remember(id) { Repo.seen[id] }
    LaunchedEffect(id, e.last.n) { Repo.markSeen(id, e.last.n) }
    var mode by rememberSaveable(id) { mutableStateOf(0) }
    var showNew by rememberSaveable(id) { mutableStateOf(false) }
    val watched = Repo.isWatched(e)
    val followed = id in Repo.followed
    val uri = LocalUriHandler.current
    val open: (String?) -> Unit = { u -> if (!u.isNullOrBlank() && !e.fictif) runCatching { uri.openUri(u) } }
    val claims = e.last.claims
    val conflicts = remember(e) { contradictions(claims) }

    Column(Modifier.fillMaxSize()) {
        TopBar(if (e.kind == "vuln") e.id else typeLabel(e.type), onBack = { nav.pop() }) {
            IconBtn(Ic.star, if (followed) "Ne plus suivre" else "Suivre cette fiche", tint = if (followed) C.yellow else C.faint) { Repo.toggleFollow(id) }
        }
        LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 40.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { Header(e, watched, followed) }
            item { ReadButton(e, open) { mode = 1 } }
            item { Evolution(e, prev, showNew, { showNew = !showNew }, nav, open) }
            item { Dates(e) }
            item { Segmented(listOf("En 30 secondes", "Analyse technique"), mode) { mode = it } }
            if (mode == 0) {
                items(thirtySeconds(e, watched)) { qa ->
                    Panel {
                        Eyebrow(qa.q, C.blue)
                        Spacer(Modifier.height(7.dp))
                        qa.lines.forEach { Text(it, style = ts(14.5, lh = 21.0), modifier = Modifier.padding(bottom = 4.dp)) }
                        qa.note?.let { Text(it, style = ts(11.5, color = C.faint)) }
                    }
                }
                if (conflicts.isNotEmpty()) item { Note("Les sources de cette fiche se contredisent sur ${joinFr(conflicts.map { topicLabel(it.first) })} : voir l’analyse technique.") }
            } else {
                e.vuln?.let { v -> item { VulnBlock(e, v, watched, open) } }
                items(conflicts) { (topic, group) -> Conflict(topic, group, e.fictif, open) }
                e.actor?.let { a -> item { Attribution(a, e.fictif, open) } }
                item { SectionHead("Ce que disent les sources", claims.count { !it.k.startsWith("pub:") }) }
                item { ClaimList(claims, e.fictif, open) }
                item {
                    SectionHead("Chronologie de la fiche", e.versions.size, if (e.versions.size > 1) "Comparer" else null) {
                        if (e.versions.size > 1) nav.compare(id, e.versions[e.versions.size - 2].n, e.last.n)
                    }
                }
                item { Timeline(e, nav) }
                item { SectionHead("Techniques MITRE ATT&CK", e.attack.size) }
                if (e.attack.isEmpty()) item { Note("Aucune technique ATT&CK n’est citée par les sources de cette fiche.") }
                items(e.attack) { tid -> AttackCard(tid, s.attack[tid], open) }
                if (e.defense.isNotEmpty()) {
                    item { SectionHead("Mesures défensives à vérifier", e.defense.size) }
                    item { Panel { e.defense.forEachIndexed { i, d -> Row(Modifier.padding(vertical = 5.dp)) { Text("${i + 1}", style = ts(12.0, FontWeight.Medium, C.blue, mono = true), modifier = Modifier.width(22.dp)); Text(d, style = ts(14.0, lh = 20.0)) } } } }
                }
                item { SectionHead("Publications d’origine", e.pubs.size) }
                item { PubList(e, open) }
            }
        }
    }
}

@Composable
private fun Header(e: Event, watched: Boolean, followed: Boolean) {
    Column {
        if (e.fictif) {
            FictifBadge()
            Spacer(Modifier.height(6.dp))
            Text("Organisations, groupe, chiffres et liens de cette fiche sont inventés.", style = ts(12.5, color = C.violet, lh = 17.0))
            Spacer(Modifier.height(10.dp))
        }
        Text(e.title.removePrefix("[FICTIF] "), style = ts(21.0, FontWeight.SemiBold, lh = 27.5, ls = -0.2))
        Spacer(Modifier.height(12.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            StatusChip(e.status, long = true)
            if (e.kind != "actu") Box(Modifier.padding(top = 3.dp)) { SeverityMeter(e.severity) }
            if (watched) Pill("Ma veille", C.blue, filled = true)
            if (followed) Pill("Suivi", C.yellow, filled = true)
        }
        e.statusReason?.let { Text(it, style = ts(13.0, color = C.dim, lh = 18.5), modifier = Modifier.padding(top = 9.dp)) }
        if (e.kind != "actu") e.severityReason?.let { Text("Gravité : $it", style = ts(13.0, color = C.dim, lh = 18.5), modifier = Modifier.padding(top = 3.dp)) }
    }
}

@Composable
private fun Evolution(e: Event, prev: Int?, show: Boolean, onToggle: () -> Unit, nav: Nav, open: (String?) -> Unit) {
    val news = remember(e, prev) { whatsNew(e, prev) }
    val base = news.since
    val pending = base != null && news.changes.isNotEmpty()
    Panel(accent = if (pending) C.yellow else C.blue) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Eyebrow("Dernière évolution", C.dim, Modifier.weight(1f))
            Text("v${e.last.n} · ${ago(e.last.at)}", style = ts(11.0, color = C.faint, mono = true))
        }
        Spacer(Modifier.height(6.dp))
        Text(e.last.note, style = ts(14.5, FontWeight.Medium, lh = 20.5))
        Text(dateTime(e.last.at), style = ts(11.5, color = C.faint), modifier = Modifier.padding(top = 2.dp))
        Spacer(Modifier.height(12.dp))
        Button(if (pending) "Quoi de neuf depuis ma dernière visite ? · ${news.changes.size}" else "Quoi de neuf depuis ma dernière visite ?", Ic.spark, primary = pending, modifier = Modifier.fillMaxWidth(), onClick = onToggle)
        if (show) {
            Spacer(Modifier.height(10.dp))
            if (base == null) Note("C’est votre première consultation de cette fiche, qui compte ${e.versions.size} version(s). Les changements publiés après cette visite seront résumés ici.")
            else if (news.changes.isEmpty()) Note("Rien de nouveau : vous aviez déjà consulté la version ${base.n}, du ${dateTime(base.at)}.")
            else {
                Note("Depuis la version ${base.n} du ${dateTime(base.at)}, que vous aviez consultée :")
                news.changes.forEach { ChangeRow(it, e.fictif, open) }
                Spacer(Modifier.height(6.dp))
                Button("Comparer v${base.n} et v${e.last.n}", Ic.compare, modifier = Modifier.fillMaxWidth()) { nav.compare(e.id, base.n, e.last.n) }
            }
        }
    }
}

@Composable
private fun Dates(e: Event) {
    val cells: List<Triple<String, String?, String>> = when (e.kind) {
        "vuln" -> listOf(Triple("Publication CVE", e.disclosedAt?.let { day(it) }, "Non communiquée"), Triple("Inscription KEV", e.vuln?.kev?.added, "Non inscrite"), Triple("Mise à jour", shortDate(e.updatedAt), ""))
        "incident" -> listOf(Triple("Date de l’incident", e.incidentDate?.let { day(it) }, "Non communiquée"), Triple("Divulgation", e.disclosedAt?.let { day(it) }, "Non communiquée"), Triple("Mise à jour", shortDate(e.updatedAt), ""))
        else -> listOf(Triple("Publication", e.disclosedAt?.let { day(it) }, "Non communiquée"), Triple("Première collecte", day(e.firstSeenAt), ""), Triple("Mise à jour", shortDate(e.updatedAt), ""))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        cells.forEach { (label, value, missing) ->
            Column(Modifier.weight(1f).clip(RoundedCornerShape(11.dp)).background(C.surface).border(1.dp, C.line, RoundedCornerShape(11.dp)).padding(horizontal = 10.dp, vertical = 9.dp)) {
                Eyebrow(label)
                Spacer(Modifier.height(4.dp))
                Text(value ?: missing, style = ts(12.5, FontWeight.Medium, if (value == null) C.faint else C.text, mono = true), maxLines = 2)
            }
        }
    }
}

@Composable
private fun RowScope.Metric(label: String, value: String, sub: String, color: Color) {
    Column(Modifier.weight(1f).clip(RoundedCornerShape(11.dp)).background(C.raised).padding(11.dp)) {
        Eyebrow(label)
        Spacer(Modifier.height(4.dp))
        Text(value, style = ts(19.0, FontWeight.Medium, color, mono = true), maxLines = 1)
        Text(sub, style = ts(11.5, color = C.dim, lh = 15.5), maxLines = 2)
    }
}

@Composable
private fun VulnBlock(e: Event, v: Vuln, watched: Boolean, open: (String?) -> Unit) {
    Panel {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Metric("CVSS ${v.cvssVersion ?: ""}".trim(), v.cvss?.toString() ?: "—", v.cvssSev?.let { "${it.lowercase()} · ${if (v.cvssSource == "nvd@nist.gov") "NVD" else v.cvssSource ?: ""}" } ?: "Score non publié", sevColor(e.severity))
            Metric("EPSS", v.epss?.let { pct(it) } ?: "—", v.epssPct?.let { "${(it * 100).toInt()}ᵉ centile · ${v.epssDate ?: ""}" } ?: "Score non disponible", C.blue)
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Metric("CISA KEV", if (v.kev != null) "Inscrite" else "Absente", v.kev?.let { "depuis le ${it.added ?: "date non communiquée"}" } ?: "Pas d’exploitation documentée par la CISA", if (v.kev != null) C.orange else C.faint)
            Metric("Correctif", if (v.patch == "oui") "Référencé" else "Non documenté", if (v.patch == "oui") "Référence « Patch » dans NVD" else "Aucune référence de correctif dans NVD", if (v.patch == "oui") C.green else C.faint)
        }
        Spacer(Modifier.height(12.dp))
        Eyebrow("Versions touchées")
        Spacer(Modifier.height(4.dp))
        if (v.versions.isEmpty()) Text("Non précisées par NVD à ce jour.", style = ts(13.0, color = C.faint))
        v.versions.forEach { Text(it, style = ts(12.5, mono = true, lh = 18.0)) }
        v.kev?.let { k ->
            Spacer(Modifier.height(10.dp))
            Eyebrow("Rançongiciels")
            Text(if (k.ransomware == "Known") "Usage connu dans des campagnes de rançongiciel (CISA)." else "Pas d’usage connu par des rançongiciels à ce jour (CISA).", style = ts(13.0, lh = 18.5), modifier = Modifier.padding(top = 3.dp))
            k.due?.let { Text("Échéance fixée aux agences fédérales américaines : $it.", style = ts(12.0, color = C.dim), modifier = Modifier.padding(top = 2.dp)) }
        }
        Spacer(Modifier.height(12.dp))
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(11.dp)).background(C.blueDeep.copy(alpha = 0.55f)).padding(12.dp)) {
            Eyebrow("Priorité défensive", C.blue)
            Text(priority(e, watched).sentence, style = ts(14.0, FontWeight.Medium, lh = 20.0), modifier = Modifier.padding(top = 4.dp))
        }
        v.patchUrl?.let { u -> Spacer(Modifier.height(10.dp)); Button(if (v.patch == "oui") "Ouvrir la référence du correctif" else "Ouvrir l’avis de l’éditeur", Ic.link, modifier = Modifier.fillMaxWidth()) { open(u) } }
    }
}

@Composable
private fun Conflict(topic: String, group: List<Claim>, fictif: Boolean, open: (String?) -> Unit) {
    Panel(accent = C.orange) {
        Eyebrow("Sources en désaccord", C.orange)
        Text("Les sources divergent sur ${topicLabel(topic)}", style = ts(15.5, FontWeight.SemiBold, lh = 21.0), modifier = Modifier.padding(top = 4.dp, bottom = 10.dp))
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            group.forEach { c ->
                val shape = RoundedCornerShape(11.dp)
                Column(Modifier.width(236.dp).clip(shape).background(C.raised).border(1.dp, statusColor(c.st).copy(alpha = 0.4f), shape).padding(12.dp)) {
                    Text(c.src, style = ts(12.0, FontWeight.Medium, C.blue, lh = 16.0), maxLines = 2)
                    Spacer(Modifier.height(8.dp))
                    Text(c.v, style = ts(15.0, FontWeight.Medium, lh = 20.5))
                    Spacer(Modifier.height(9.dp))
                    StatusChip(c.st)
                    Spacer(Modifier.height(10.dp))
                    Eyebrow("Ce qui l’étaye")
                    Text(c.basis ?: "Élément à l’appui non précisé par la source.", style = ts(12.5, color = C.dim, lh = 17.5), modifier = Modifier.padding(top = 3.dp))
                    SourceLine("Ouvrir la source", c.url, fictif, open)
                }
            }
        }
    }
}

@Composable
private fun Attribution(a: Actor, fictif: Boolean, open: (String?) -> Unit) {
    Panel(accent = C.violet) {
        Eyebrow("Attribution — évaluée séparément du statut", C.violet)
        Text(a.name, style = ts(16.0, FontWeight.SemiBold), modifier = Modifier.padding(top = 5.dp))
        Text("Niveau de confiance : ${a.confidence}.", style = ts(13.5, lh = 19.0), modifier = Modifier.padding(top = 3.dp))
        Text("La mention d’un groupe par une source ne vaut pas attribution établie.", style = ts(12.0, color = C.faint, lh = 16.5), modifier = Modifier.padding(top = 3.dp))
        SourceLine("Source : ${a.source}", a.url, fictif, open)
    }
}

@Composable
fun SourceLine(text: String, url: String?, fictif: Boolean, open: (String?) -> Unit) {
    val live = !url.isNullOrBlank() && !fictif
    Row(Modifier.padding(top = 5.dp).clip(RoundedCornerShape(6.dp)).clickable(enabled = live) { open(url) }, verticalAlignment = Alignment.CenterVertically) {
        Text(text + if (fictif) " (lien fictif)" else "", style = ts(12.0, color = if (live) C.blue else C.faint, lh = 16.0), modifier = Modifier.weight(1f, fill = false))
        if (live) { Spacer(Modifier.width(5.dp)); Icon(Ic.link, null, tint = C.blue, modifier = Modifier.size(13.dp)) }
    }
}

@Composable
private fun ClaimList(claims: List<Claim>, fictif: Boolean, open: (String?) -> Unit) {
    val facts = claims.filter { !it.k.startsWith("pub:") }
    if (facts.isEmpty()) { Note("Aucun fait structuré n’a pu être extrait : consultez les publications d’origine ci-dessous."); return }
    Panel {
        facts.forEachIndexed { i, c ->
            if (i > 0) Box(Modifier.fillMaxWidth().padding(vertical = 9.dp).height(1.dp).background(C.line))
            Row {
                Box(Modifier.padding(top = 4.dp)) { StatusMark(c.st, 9) }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Eyebrow(c.label, C.dim)
                    Text(c.v, style = ts(14.5, lh = 20.5), modifier = Modifier.padding(top = 3.dp))
                    SourceLine("${statusLabel(c.st, true)} · ${c.src}", c.url, fictif, open)
                }
            }
        }
    }
}

@Composable
private fun Timeline(e: Event, nav: Nav) {
    Column {
        e.versions.asReversed().forEachIndexed { i, v ->
            val latest = i == 0
            Row(Modifier.fillMaxWidth().drawBehind {
                val x = 7.dp.toPx()
                drawLine(C.line, Offset(x, if (latest) 10.dp.toPx() else 0f), Offset(x, if (v.n == e.versions.first().n) 10.dp.toPx() else size.height), 2f)
            }) {
                Box(Modifier.padding(top = 4.dp).size(15.dp).clip(CircleShape).background(C.bg).border(2.dp, if (latest) C.blue else C.faint, CircleShape))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f).padding(bottom = 16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("v${v.n}", style = ts(12.5, FontWeight.Medium, if (latest) C.blue else C.dim, mono = true))
                        Spacer(Modifier.width(8.dp))
                        Text(dateTime(v.at), style = ts(12.0, color = C.faint, mono = true))
                    }
                    Text(v.note, style = ts(14.0, lh = 20.0), modifier = Modifier.padding(top = 3.dp))
                    val before = e.versions.lastOrNull { it.n < v.n }
                    if (before != null) Text("Voir ce qui a changé depuis v${before.n}", style = ts(12.5, FontWeight.Medium, C.blue), modifier = Modifier.padding(top = 4.dp).clip(RoundedCornerShape(6.dp)).clickable { nav.compare(e.id, before.n, v.n) }.padding(vertical = 3.dp))
                }
            }
        }
    }
}

@Composable
private fun AttackCard(id: String, t: Technique?, open: (String?) -> Unit) {
    Panel(onClick = { open(t?.url ?: "https://attack.mitre.org/techniques/${id.replace('.', '/')}/") }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Pill(id, C.blue, filled = true)
            Spacer(Modifier.width(9.dp))
            Text(t?.name ?: "Technique citée par les sources", style = ts(14.5, FontWeight.SemiBold), modifier = Modifier.weight(1f))
        }
        if (t == null) { Text("Fiche technique non embarquée : consultez MITRE ATT&CK.", style = ts(12.5, color = C.dim), modifier = Modifier.padding(top = 6.dp)); return@Panel }
        Text(t.tactic, style = ts(12.0, color = C.faint), modifier = Modifier.padding(top = 4.dp, bottom = 6.dp))
        listOf("Détection" to t.detect, "Durcissement" to t.harden, "Remédiation" to t.remediate).forEach { (k, v) ->
            Eyebrow(k, C.dim, Modifier.padding(top = 6.dp))
            Text(v, style = ts(13.5, lh = 19.0), modifier = Modifier.padding(top = 2.dp))
        }
    }
}

@Composable
private fun PubList(e: Event, open: (String?) -> Unit) {
    if (e.pubs.isEmpty()) { Note("Aucune publication rattachée : cette fiche provient uniquement des bases NVD, CISA KEV et EPSS."); return }
    val byId = e.pubs.associateBy { it.id }
    val origins = e.pubs.mapNotNull { it.derivedFrom }.groupingBy { it }.eachCount().filter { it.value >= 1 }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        origins.forEach { (origin, n) ->
            byId[origin]?.let { o -> Text("$n publication(s) de cette fiche reprennent une même source initiale : ${o.src}. Elles ne constituent pas une confirmation indépendante.", style = ts(12.5, color = C.yellow, lh = 17.5)) }
        }
        e.pubs.forEach { p ->
            Panel(onClick = { open(p.url) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Eyebrow(p.src, C.blue, Modifier.weight(1f, fill = false))
                    Spacer(Modifier.width(8.dp))
                    Eyebrow(kindLabel(p.kind))
                }
                Text(p.title, style = ts(14.5, FontWeight.Medium, lh = 20.0), modifier = Modifier.padding(top = 5.dp))
                p.derivedFrom?.let { d -> byId[d]?.let { o -> Text("↳ Reprend : ${o.src}", style = ts(12.0, color = C.yellow), modifier = Modifier.padding(top = 4.dp)) } }
                val published = p.publishedAt?.let { "Publié le ${dateTime(it)}" } ?: "Date de publication non communiquée par la source"
                val delay = collectDelay(p)?.let { " · dans l’application $it après" } ?: " · collecté le ${dateTime(p.collectedAt)}"
                Text(published + delay, style = ts(11.5, color = C.faint, lh = 16.0), modifier = Modifier.padding(top = 5.dp))
                if (e.fictif) Text("Lien fictif, non ouvrable.", style = ts(11.5, color = C.violet), modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}

@Composable
fun ChangeRow(c: Change, fictif: Boolean, open: (String?) -> Unit) {
    val (sym, col, word) = when (c.op) { "add" -> Triple("+", C.green, "Ajout"); "del" -> Triple("−", C.red, "Retrait"); else -> Triple("~", C.yellow, "Correction") }
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Box(Modifier.size(24.dp).clip(RoundedCornerShape(6.dp)).background(col.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) { Text(sym, style = ts(15.0, FontWeight.SemiBold, col, mono = true)) }
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Eyebrow("$word · ${c.label}", col)
            c.before?.let { Text(it, style = ts(13.5, color = C.faint, lh = 19.0).copy(textDecoration = TextDecoration.LineThrough), modifier = Modifier.padding(top = 3.dp)) }
            c.after?.let { Text(it, style = ts(14.5, FontWeight.Medium, lh = 20.5), modifier = Modifier.padding(top = 3.dp)) }
            val sb = c.stBefore
            val sa = c.stAfter
            if (c.op == "mod" && sb != null && sa != null && sb != sa) Text("Statut : ${statusLabel(sb)} → ${statusLabel(sa)}", style = ts(12.0, color = statusColor(sa)), modifier = Modifier.padding(top = 3.dp))
            c.basis?.let { if (c.op != "del") Text("Étayé par : $it", style = ts(12.0, color = C.dim, lh = 16.5), modifier = Modifier.padding(top = 3.dp)) }
            SourceLine("Source : ${c.src}", c.url, fictif, open)
        }
    }
}

/** Comparaison de deux versions d'une fiche : ce qui a été ajouté, corrigé ou retiré, avec la source de chaque modification. */
@Composable
fun CompareScreen(id: String, a0: Int, b0: Int, nav: Nav) {
    val e = Repo.snap?.event(id)
    if (e == null) { Column { TopBar("Comparer", onBack = { nav.pop() }); EmptyState("Fiche introuvable", "") }; return }
    var a by rememberSaveable(id) { mutableStateOf(a0) }
    var b by rememberSaveable(id) { mutableStateOf(b0) }
    val va = e.versions.firstOrNull { it.n == a } ?: e.versions.first()
    val vb = e.versions.firstOrNull { it.n == b } ?: e.last
    val changes = remember(va, vb) { diff(va.claims, vb.claims) }
    val uri = LocalUriHandler.current
    val open: (String?) -> Unit = { u -> if (!u.isNullOrBlank() && !e.fictif) runCatching { uri.openUri(u) } }
    val kept = vb.claims.size - changes.count { it.op != "del" }

    Column(Modifier.fillMaxSize()) {
        TopBar("Comparer les versions", onBack = { nav.pop() })
        LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 40.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                if (e.fictif) { FictifBadge(); Spacer(Modifier.height(8.dp)) }
                Text(e.title.removePrefix("[FICTIF] "), style = ts(17.0, FontWeight.SemiBold, lh = 23.0))
            }
            item { VersionPicker("Version de départ", e.versions, va.n) { a = it } }
            item { VersionPicker("Version d’arrivée", e.versions, vb.n) { b = it } }
            item {
                Panel(accent = C.blue) {
                    Text("v${va.n}  →  v${vb.n}", style = ts(19.0, FontWeight.Medium, C.text, mono = true))
                    Text("${dateTime(va.at)}  →  ${dateTime(vb.at)}", style = ts(11.5, color = C.faint, mono = true), modifier = Modifier.padding(top = 3.dp))
                    Spacer(Modifier.height(10.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Pill("+ ${changes.count { it.op == "add" }} ajout(s)", C.green, filled = true)
                        Pill("~ ${changes.count { it.op == "mod" }} correction(s)", C.yellow, filled = true)
                        Pill("− ${changes.count { it.op == "del" }} retrait(s)", C.red, filled = true)
                        Pill("$kept inchangé(s)")
                    }
                }
            }
            if (va.n == vb.n) item { Note("Choisissez deux versions différentes pour voir ce qui a changé.") }
            else if (changes.isEmpty()) item { Note("Aucune différence entre ces deux versions.") }
            item { if (changes.isNotEmpty()) Panel { changes.sortedBy { when (it.op) { "mod" -> 0; "add" -> 1; else -> 2 } }.forEachIndexed { i, c ->
                if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(C.line))
                ChangeRow(c, e.fictif, open)
            } } }
            if (e.fictif && changes.any { it.k == "sauvegardes" } && e.defense.isNotEmpty()) {
                item { SectionHead("Vérifications défensives associées") }
                item { Panel { e.defense.take(3).forEach { Text("• $it", style = ts(13.5, lh = 19.5), modifier = Modifier.padding(vertical = 3.dp)) } } }
            }
        }
    }
}

@Composable
private fun VersionPicker(label: String, versions: List<Version>, selected: Int, onSelect: (Int) -> Unit) {
    Column {
        Eyebrow(label)
        Spacer(Modifier.height(6.dp))
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            versions.forEach { v -> Chip("v${v.n} · ${shortDate(v.at)}", v.n == selected) { onSelect(v.n) } }
        }
    }
}
