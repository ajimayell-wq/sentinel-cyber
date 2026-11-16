package ma.adess.sentinel

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.Locale

/** Une affirmation sourcée : l'unité de base d'une fiche. Deux versions se comparent affirmation par affirmation. */
data class Claim(
    val k: String, val label: String, val v: String, val st: String, val src: String,
    val url: String?, val topic: String?, val basis: String?, val h: String?,
)

data class Version(val n: Int, val at: Long, val note: String, val claims: List<Claim>)

data class Pub(
    val id: Int, val src: String, val kind: String, val title: String, val url: String, val summary: String?,
    val lang: String?, val publishedAt: Long?, val collectedAt: Long, val derivedFrom: Int?,
)

data class Country(val code: String, val name: String, val lat: Double, val lon: Double)
data class Actor(val name: String, val confidence: String, val source: String, val url: String?)
data class Kev(val added: String?, val due: String?, val ransomware: String?, val action: String?)

data class Vuln(
    val cve: String, val vendor: String?, val product: String?, val description: String?, val versions: List<String>,
    val cvss: Double?, val cvssSev: String?, val cvssVector: String?, val cvssVersion: String?, val cvssSource: String?,
    val epss: Double?, val epssPct: Double?, val epssDate: String?, val kev: Kev?,
    val patch: String, val patchUrl: String?, val cwe: List<String>,
)

data class Event(
    val id: String, val kind: String, val type: String, val fictif: Boolean, val title: String,
    val status: String, val statusReason: String?, val severity: String, val severityReason: String?,
    val incidentDate: Long?, val disclosedAt: Long?, val updatedAt: Long, val firstSeenAt: Long,
    val countries: List<Country>, val sectors: List<String>, val techs: List<String>, val cves: List<String>,
    val actor: Actor?, val attack: List<String>, val summary: String?, val summarySrc: String?,
    val defense: List<String>, val vuln: Vuln?, val pubs: List<Pub>, val versions: List<Version>,
) {
    val last: Version get() = versions.last()
    val sourceCount: Int get() = pubs.map { it.src }.distinct().size
    /** Date qui sert au tri : la dernière évolution si la fiche a changé, sinon la divulgation publique. */
    val recency: Long get() = if (versions.size > 1) updatedAt else (disclosedAt ?: updatedAt)
    val hay: String by lazy {
        (listOf(title, id, summary ?: "", vuln?.vendor ?: "", vuln?.product ?: "", actor?.name ?: "") + cves + techs + sectors + countries.map { it.name })
            .joinToString(" ").lowercase(Locale.FRENCH)
    }
}

data class Source(
    val id: String, val name: String, val org: String, val kind: String, val site: String?,
    val lastAttempt: Long?, val lastSuccess: Long?, val lastError: String?, val lastItemAt: Long?, val items: Int,
)

data class Technique(val id: String, val name: String, val tactic: String, val detect: String, val harden: String, val remediate: String, val url: String?)

data class Snapshot(val generatedAt: Long, val sources: List<Source>, val events: List<Event>, val attack: Map<String, Technique>) {
    private val byId: Map<String, Event> by lazy { events.associateBy { it.id } }
    fun event(id: String): Event? = byId[id]
}

private fun JSONObject.str(k: String): String? = if (isNull(k)) null else optString(k, "").ifBlank { null }
private fun JSONObject.time(k: String): Long? = str(k)?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
private fun JSONObject.num(k: String): Double? = if (isNull(k)) null else optDouble(k).takeIf { !it.isNaN() }
private fun JSONObject.strs(k: String): List<String> {
    val a = optJSONArray(k) ?: return emptyList()
    return (0 until a.length()).mapNotNull { i -> if (a.isNull(i)) null else a.optString(i, "").ifBlank { null } }
}
private fun <T> JSONArray?.objs(f: (JSONObject) -> T?): List<T> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { i -> optJSONObject(i)?.let(f) }
}

private fun claim(o: JSONObject) = Claim(
    o.str("k") ?: "", o.str("label") ?: "", o.str("v") ?: "", o.str("st") ?: "signale", o.str("src") ?: "source non précisée",
    o.str("url"), o.str("topic"), o.str("basis"), o.str("h"),
)

private fun event(o: JSONObject): Event? {
    val versions = o.optJSONArray("versions").objs { v ->
        Version(v.optInt("n"), v.time("at") ?: 0L, v.str("note") ?: "", v.optJSONArray("claims").objs(::claim))
    }.sortedBy { it.n }
    if (versions.isEmpty()) return null
    val vuln = o.optJSONObject("vuln")?.let { v ->
        val kev = v.optJSONObject("kev")?.let { k -> Kev(k.str("added"), k.str("due"), k.str("ransomware"), k.str("action")) }
        Vuln(
            v.str("cve") ?: "", v.str("vendor"), v.str("product"), v.str("description"), v.strs("versions"),
            v.num("cvss"), v.str("cvss_sev"), v.str("cvss_vector"), v.str("cvss_version"), v.str("cvss_source"),
            v.num("epss"), v.num("epss_pct"), v.str("epss_date"), kev, v.str("patch") ?: "non_documente", v.str("patch_url"), v.strs("cwe"),
        )
    }
    val updated = o.time("updated_at") ?: versions.last().at
    return Event(
        id = o.str("id") ?: return null, kind = o.str("kind") ?: "actu", type = o.str("type") ?: "autre", fictif = o.optBoolean("fictif", false),
        title = o.str("title") ?: "(sans titre)", status = o.str("status") ?: "signale", statusReason = o.str("status_reason"),
        severity = o.str("severity") ?: "inconnue", severityReason = o.str("severity_reason"),
        incidentDate = o.time("incident_date"), disclosedAt = o.time("disclosed_at"), updatedAt = updated, firstSeenAt = o.time("first_seen_at") ?: updated,
        countries = o.optJSONArray("countries").objs { c -> Country(c.str("code") ?: "", c.str("name") ?: "", c.optDouble("lat", 0.0), c.optDouble("lon", 0.0)) },
        sectors = o.strs("sectors"), techs = o.strs("techs"), cves = o.strs("cves"),
        actor = o.optJSONObject("actor")?.let { a -> a.str("name")?.let { n -> Actor(n, a.str("confidence") ?: "niveau de confiance non précisé", a.str("source") ?: "", a.str("url")) } },
        attack = o.strs("attack"), summary = o.str("summary"), summarySrc = o.str("summary_src"), defense = o.strs("defense"), vuln = vuln,
        pubs = o.optJSONArray("pubs").objs { p ->
            Pub(
                p.optInt("id"), p.str("src") ?: "", p.str("kind") ?: "presse", p.str("title") ?: "", p.str("url") ?: "", p.str("summary"), p.str("lang"),
                p.time("published_at"), p.time("collected_at") ?: updated, if (p.isNull("derived_from")) null else p.optInt("derived_from"),
            )
        },
        versions = versions,
    )
}

fun parseSnapshot(text: String): Snapshot {
    val o = JSONObject(text)
    val attack = HashMap<String, Technique>()
    o.optJSONObject("attack")?.let { a ->
        for (id in a.keys()) a.optJSONObject(id)?.let { t ->
            attack[id] = Technique(id, t.str("name") ?: id, t.str("tactic") ?: "", t.str("detect") ?: "", t.str("harden") ?: "", t.str("remediate") ?: "", t.str("url"))
        }
    }
    return Snapshot(
        generatedAt = o.time("generated_at") ?: 0L,
        sources = o.optJSONArray("sources").objs { s ->
            Source(
                s.str("id") ?: "", s.str("name") ?: "", s.str("org") ?: "", s.str("kind") ?: "", s.str("site"),
                s.time("last_attempt"), s.time("last_success"), s.str("last_error"), s.time("last_item_at"), s.optInt("items"),
            )
        },
        events = o.optJSONArray("events").objs(::event),
        attack = attack,
    )
}
