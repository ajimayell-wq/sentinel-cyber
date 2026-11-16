package ma.adess.sentinel

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

// ---------- Libellés ----------

fun typeLabel(t: String) = when (t) {
    "rancongiciel" -> "Rançongiciel"; "fuite" -> "Fuite de données"; "phishing" -> "Hameçonnage"; "infra" -> "Infrastructure critique"
    "cloud" -> "Cloud"; "panne" -> "Panne de service"; "incident" -> "Cyberattaque"; "vuln_exploitee" -> "Vulnérabilité exploitée"; "vuln" -> "Vulnérabilité"
    "maj" -> "Mise à jour de sécurité"; "norme" -> "Normes et pratiques"; "recherche" -> "Recherche"; else -> "Actualité"
}

fun statusLabel(s: String, long: Boolean = false) = when (s) {
    "confirme" -> "Confirmé"; "revendique" -> "Revendiqué"; "conteste" -> "Contesté"
    else -> if (long) "Signalé par une source" else "Signalé"
}

fun sevLabel(s: String) = when (s) {
    "critique" -> "Critique"; "elevee" -> "Élevée"; "moyenne" -> "Moyenne"; "faible" -> "Faible"; else -> "Non évaluée"
}

fun kindLabel(k: String) = when (k) {
    "officiel" -> "Autorité publique"; "editeur" -> "Éditeur"; "recherche" -> "Équipe de recherche"; "presse" -> "Presse spécialisée"; "donnees" -> "Base de données"; "suivi" -> "Suivi des revendications"; else -> "Source"
}

// ---------- Dates ----------

private val zone: ZoneId get() = ZoneId.systemDefault()
private val dayFmt = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.FRENCH)
private val dtFmt = DateTimeFormatter.ofPattern("d MMM yyyy 'à' HH:mm", Locale.FRENCH)
private val shortFmt = DateTimeFormatter.ofPattern("d MMM HH:mm", Locale.FRENCH)

fun day(t: Long): String = dayFmt.format(Instant.ofEpochMilli(t).atZone(zone))
fun dateTime(t: Long): String = dtFmt.format(Instant.ofEpochMilli(t).atZone(zone))
fun shortDate(t: Long): String = shortFmt.format(Instant.ofEpochMilli(t).atZone(zone))

fun ago(t: Long?, now: Long = System.currentTimeMillis()): String {
    if (t == null) return "date non communiquée"
    val m = (now - t) / 60000
    return when {
        m < 1 -> "à l’instant"
        m < 60 -> "il y a $m min"
        m < 1440 -> "il y a ${m / 60} h"
        m < 43200 -> "il y a ${m / 1440} j"
        else -> day(t)
    }
}

/** Délai entre la publication par la source et l'apparition dans l'application. */
fun collectDelay(p: Pub): String? {
    val pub = p.publishedAt ?: return null
    val m = (p.collectedAt - pub) / 60000
    return when {
        m < 0 -> null
        m < 60 -> "+$m min"
        m < 1440 -> "+${m / 60} h ${(m % 60).toString().padStart(2, '0')}"
        else -> "+${m / 1440} j"
    }
}

fun pct(v: Double): String = String.format(Locale.FRENCH, "%.1f %%", v * 100)
fun joinFr(items: List<String>): String = when (items.size) {
    0 -> ""; 1 -> items[0]; else -> items.dropLast(1).joinToString(", ") + " et " + items.last()
}

// ---------- Comparaison de versions ----------

data class Change(
    val op: String, val k: String, val label: String, val before: String?, val after: String?,
    val stBefore: String?, val stAfter: String?, val src: String, val url: String?, val basis: String?,
)

fun diff(a: List<Claim>, b: List<Claim>): List<Change> {
    val old = a.associateBy { it.k }
    val new = b.associateBy { it.k }
    val out = ArrayList<Change>()
    for (c in b) {
        val o = old[c.k]
        if (o == null) out += Change("add", c.k, c.label, null, c.v, null, c.st, c.src, c.url, c.basis)
        else if ((o.h ?: o.v) != (c.h ?: c.v) || o.st != c.st) out += Change("mod", c.k, c.label, o.v, c.v, o.st, c.st, c.src, c.url, c.basis)
    }
    for (c in a) if (!new.containsKey(c.k)) out += Change("del", c.k, c.label, c.v, null, c.st, null, c.src, c.url, c.basis)
    return out
}

/** Affirmations portant sur le même sujet mais donnant des valeurs différentes selon la source. */
fun contradictions(claims: List<Claim>): List<Pair<String, List<Claim>>> =
    claims.filter { it.topic != null }.groupBy { it.topic!! }.filter { (_, g) -> g.map { it.v }.distinct().size > 1 }.toList()

fun topicLabel(t: String) = when (t) { "impact" -> "l’ampleur de l’impact"; "cvss" -> "le score de gravité CVSS"; "chronologie" -> "la chronologie"; "attribution" -> "l’attribution"; else -> t }

data class WhatsNew(val firstVisit: Boolean, val since: Version?, val changes: List<Change>)

fun whatsNew(e: Event, seenN: Int?): WhatsNew {
    val base = e.versions.lastOrNull { seenN != null && it.n <= seenN } ?: return WhatsNew(true, null, emptyList())
    return WhatsNew(false, base, if (base.n == e.last.n) emptyList() else diff(base.claims, e.last.claims))
}

// ---------- Veille et priorité ----------

fun watchMatch(e: Event, watch: List<String>): Boolean = watch.any { w -> w.isNotBlank() && e.hay.contains(w.trim().lowercase(Locale.FRENCH)) }

data class Priority(val score: Int, val label: String, val sentence: String)

fun priority(e: Event, watched: Boolean): Priority {
    val v = e.vuln
    val reasons = ArrayList<String>()
    var score = 0
    if (watched) { reasons += "le produit figure dans votre liste de surveillance"; score += 3 }
    if (v?.kev != null) { reasons += "l’exploitation est documentée (catalogue CISA KEV)"; score += 3 }
    if (v?.kev?.ransomware == "Known") { reasons += "un usage par des rançongiciels est connu"; score += 1 }
    val epss = v?.epss ?: 0.0
    if (epss >= 0.5) { reasons += "la probabilité d’exploitation EPSS atteint ${pct(epss)}"; score += 1 }
    val cvss = v?.cvss ?: 0.0
    if (cvss >= 9.0) { reasons += "le score CVSS est de $cvss"; score += 1 }
    if (e.kind == "incident" && e.status == "confirme") { reasons += "l’incident est confirmé"; score += 2 }
    if (v?.patch == "oui") reasons += "un correctif est disponible"
    val label = when { score >= 5 -> "Priorité élevée"; score >= 3 -> "Priorité moyenne"; else -> "Priorité faible" }
    val because = if (reasons.isEmpty()) "aucun critère de priorité n’est documenté par les sources" else joinFr(reasons)
    return Priority(score, label, "$label, car $because.")
}

data class Rules(val patch: Boolean, val exploit: Boolean, val scope: Boolean)
data class Alert(val eventId: String, val title: String, val lines: List<String>)

private val SCOPE_KEYS = setOf("perimetre", "pays", "secteur", "versions", "sauvegardes", "donnees", "produit")

/** Alertes à émettre après une synchronisation, regroupées par fiche. */
fun computeAlerts(old: Snapshot, new: Snapshot, watch: List<String>, followed: Set<String>, rules: Rules): List<Alert> {
    val out = ArrayList<Alert>()
    for (e in new.events) {
        if (e.fictif) continue
        val watched = watchMatch(e, watch)
        if (!watched && e.id !in followed) continue
        val o = old.event(e.id)
        val lines = ArrayList<String>()
        if (o == null) {
            if (rules.scope) lines += "Nouvelle fiche dans votre périmètre : ${typeLabel(e.type)}, ${statusLabel(e.status).lowercase(Locale.FRENCH)}"
        } else if (o.last.n != e.last.n) {
            val changes = diff(o.last.claims, e.last.claims)
            if (rules.patch && changes.any { it.k == "patch" && it.stAfter == "confirme" && it.stBefore != "confirme" }) lines += "Un correctif est désormais référencé"
            if (rules.exploit && changes.any { it.k == "kev" && it.op == "add" }) lines += "Exploitation confirmée : inscription au catalogue CISA KEV"
            if (rules.exploit && o.status != "confirme" && e.status == "confirme") lines += "Statut passé à « confirmé »"
            if (rules.scope) changes.filter { it.k in SCOPE_KEYS || it.k.startsWith("impact") }.take(3).forEach { c ->
                lines += when (c.op) { "add" -> "Périmètre — ajout : ${c.label}"; "del" -> "Périmètre — retrait : ${c.label}"; else -> "Périmètre modifié : ${c.label}" }
            }
        }
        if (lines.isNotEmpty()) out += Alert(e.id, e.title, lines)
    }
    return out
}

// ---------- Lecture « En 30 secondes » : les cinq questions ----------

data class QA(val q: String, val lines: List<String>, val note: String? = null)

fun thirtySeconds(e: Event, watched: Boolean): List<QA> {
    val claims = e.last.claims
    val concerned = ArrayList<String>()
    e.vuln?.let { v -> listOfNotNull(v.vendor, v.product).joinToString(" ").ifBlank { null }?.let { concerned += "Produit : $it" } }
    if (e.sectors.isNotEmpty()) concerned += "Secteurs mentionnés : ${e.sectors.joinToString(", ")}"
    if (e.countries.isNotEmpty()) concerned += "Pays mentionnés : ${e.countries.joinToString(", ") { it.name }}"
    if (e.vuln == null && e.techs.isNotEmpty()) concerned += "Technologies citées : ${e.techs.take(6).joinToString(", ")}"
    claims.firstOrNull { it.k == "perimetre" }?.let { concerned += "${it.label} : ${it.v}" }
    if (concerned.isEmpty()) concerned += "Non précisé par les sources."

    val sure = claims.filter { it.st == "confirme" && !it.k.startsWith("pub:") }.take(4).map { "${it.label} : ${it.v}" }.toMutableList()
    if (sure.isEmpty()) claims.filter { it.st == "confirme" }.take(2).forEach { sure += "${it.label} : « ${it.v} »" }
    if (sure.isEmpty()) sure += "Rien n’est confirmé à ce stade. ${e.statusReason ?: ""}".trim()

    val changed = if (e.versions.size == 1) listOf("Aucune évolution depuis la création de la fiche, le ${dateTime(e.last.at)}.")
    else listOf("Version ${e.last.n}, le ${dateTime(e.last.at)} : ${e.last.note}")

    val action = ArrayList<String>()
    action += e.defense.take(3)
    if (e.vuln != null) action += priority(e, watched).sentence
    if (action.isEmpty()) action += if (e.techs.isNotEmpty()) "Aucune mesure n’est documentée par les sources. Vérifiez votre exposition si vous utilisez : ${e.techs.take(5).joinToString(", ")}."
    else "Aucune mesure défensive n’est documentée par les sources de cette fiche."

    val english = e.pubs.isNotEmpty() && e.pubs.all { it.lang == "en" } || (e.vuln != null && e.pubs.isEmpty())
    return listOf(
        QA("Que s’est-il passé ?", listOf(e.summary ?: e.title), listOfNotNull(e.summarySrc?.let { "Extrait de la source : $it" }, if (english && !e.fictif) "texte d’origine en anglais" else null).joinToString(" · ").ifBlank { null }),
        QA("Qui est concerné ?", concerned),
        QA("Que sait-on avec certitude ?", sure),
        QA("Qu’est-ce qui a changé depuis la dernière mise à jour ?", changed),
        QA("Quelle action défensive envisager ?", action),
    )
}

// ---------- Filtres ----------

data class FilterSet(
    val status: Set<String> = emptySet(), val severity: Set<String> = emptySet(), val type: Set<String> = emptySet(),
    val country: Set<String> = emptySet(), val sector: Set<String> = emptySet(), val tech: Set<String> = emptySet(), val query: String = "",
) {
    val active: Int get() = listOf(status, severity, type, country, sector, tech).count { it.isNotEmpty() } + if (query.isBlank()) 0 else 1
    fun match(e: Event): Boolean =
        (status.isEmpty() || e.status in status) && (severity.isEmpty() || e.severity in severity) && (type.isEmpty() || e.type in type) &&
            (country.isEmpty() || e.countries.any { it.code in country }) && (sector.isEmpty() || e.sectors.any { it in sector }) &&
            (tech.isEmpty() || e.techs.any { it in tech }) && (query.isBlank() || e.hay.contains(query.trim().lowercase(Locale.FRENCH)))
}

// ---------- Assistant : réponse construite à partir des fiches indexées ----------

data class Answer(val text: String, val refs: List<Event>, val criteria: String, val local: Boolean)

private val SECTOR_WORDS = mapOf(
    "Santé" to listOf("hôpit", "hopit", "santé", "clinique", "médic"), "Finance" to listOf("banque", "financ", "assurance"),
    "Éducation" to listOf("universit", "école", "éducation", "lycée"), "Administration" to listOf("administration", "collectivit", "mairie", "gouvernement", "ministère"),
    "Énergie" to listOf("énergie", "électri", "nucléaire"), "Transport" to listOf("transport", "aéroport", "ferroviaire", "aérien"),
    "Télécoms" to listOf("télécom", "opérateur"), "Industrie" to listOf("industri", "usine"), "Commerce" to listOf("commerce", "distribution", "magasin"),
    "Défense" to listOf("défense", "militaire", "armée"), "Eau" to listOf("eau potable", "assainissement"), "Médias" to listOf("média", "presse", "télévision"),
)
private val SMALL = setOf("quels", "quelles", "quel", "quelle", "cette", "dans", "avec", "pour", "sont", "depuis", "concernent", "touchent", "alertes", "incidents", "incident", "confirmés", "semaine", "logiciels", "surveille", "organisation", "premier", "communiqué", "confirmé", "fiches", "derniers", "dernières", "vulnérabilités", "quoi", "neuf")

fun localAnswer(question: String, s: Snapshot, watch: List<String>, now: Long = System.currentTimeMillis()): Answer {
    val t = question.lowercase(Locale.FRENCH)
    val words = t.split(Regex("[^\\p{L}\\p{N}-]+")).filter { it.length > 3 && it !in SMALL }

    // « Qu'a confirmé X depuis son premier communiqué ? » : on retrace la fiche nommée.
    if (Regex("depuis|premier communiqué|évolu|a changé").containsMatchIn(t)) {
        val named = s.events.filter { e -> e.versions.size > 1 && words.any { w -> e.title.lowercase(Locale.FRENCH).contains(w) } }.maxByOrNull { it.updatedAt }
        if (named != null) {
            val first = named.versions.first()
            val conf = diff(first.claims, named.last.claims).filter { it.stAfter == "confirme" }
            val head = "Depuis la première version du ${dateTime(first.at)}, ${conf.size} élément(s) confirmé(s) ont été ajoutés ou corrigés (dernière mise à jour : ${dateTime(named.last.at)})."
            val body = conf.take(8).joinToString("\n") { c -> "• ${c.label} : ${c.after} — ${c.src}" }
            val pre = if (named.fictif) "Fiche FICTIVE de démonstration.\n" else ""
            return Answer(pre + head + if (body.isEmpty()) "" else "\n$body", listOf(named), "fiche nommée dans la question · comparaison de la première et de la dernière version", true)
        }
    }

    val days = when { "aujourd" in t || "24 h" in t -> 1; "semaine" in t || "7 jours" in t -> 7; "mois" in t -> 30; else -> 0 }
    val status = when { "confirm" in t -> "confirme"; "revendiqu" in t -> "revendique"; "contest" in t || "démenti" in t -> "conteste"; else -> null }
    val kind = when {
        Regex("vuln|cve|faille|correctif|patch").containsMatchIn(t) -> "vuln"
        Regex("incident|attaque|rançon|ransom|fuite|intrusion").containsMatchIn(t) -> "incident"
        else -> null
    }
    val sector = SECTOR_WORDS.entries.firstOrNull { (_, ws) -> ws.any { it in t } }?.key
    val country = s.events.asSequence().flatMap { it.countries }.map { it.name }.distinct().firstOrNull { it.lowercase(Locale.FRENCH) in t }
    val mine = Regex("surveill|ma veille|mes logiciels|mes technologies|que je sui").containsMatchIn(t)
    val structured = days > 0 || status != null || kind != null || sector != null || country != null || mine
    val since = if (days > 0) now - days * 86_400_000L else 0L

    var hits = s.events.filter { e ->
        !e.fictif && e.recency >= since && (status == null || e.status == status) && (kind == null || e.kind == kind) &&
            (sector == null || sector in e.sectors) && (country == null || e.countries.any { it.name == country }) && (!mine || watchMatch(e, watch))
    }
    if (!structured) hits = hits.map { e -> e to words.count { e.hay.contains(it) } }.filter { it.second > 0 }.sortedByDescending { it.second }.map { it.first }
    else hits = hits.sortedByDescending { it.recency }

    val crit = listOfNotNull(
        when (kind) { "vuln" -> "vulnérabilités"; "incident" -> "incidents"; else -> "toutes les fiches" },
        status?.let { "statut « ${statusLabel(it).lowercase(Locale.FRENCH)} »" }, sector?.let { "secteur $it" }, country?.let { "pays : $it" },
        if (mine) "liste de surveillance (${if (watch.isEmpty()) "vide" else watch.joinToString(", ")})" else null,
        if (days > 0) "depuis le ${day(since)}" else null,
        if (!structured && words.isNotEmpty()) "mots-clés : ${words.joinToString(", ")}" else null,
    ).joinToString(" · ")

    if (mine && watch.isEmpty()) return Answer("Votre liste de surveillance est vide. Ajoutez des logiciels, fournisseurs ou secteurs dans l’onglet « Ma veille » pour obtenir une réponse.", emptyList(), crit, true)
    if (hits.isEmpty()) return Answer("Aucune fiche indexée ne correspond. Cela ne prouve pas l’absence d’événement : seules les publications collectées sont interrogées (données du ${dateTime(s.generatedAt)}).", emptyList(), crit, true)
    val top = hits.take(12)
    val head = "${hits.size} fiche(s) correspondent, selon les données collectées le ${dateTime(s.generatedAt)}." + if (hits.size > top.size) " Les ${top.size} plus récentes sont listées." else ""
    return Answer(head, top, crit, true)
}
