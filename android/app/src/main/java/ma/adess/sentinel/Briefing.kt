package ma.adess.sentinel

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.text.StaticLayout
import android.text.TextPaint
import java.io.OutputStream

/** Briefing PDF sourcé : date de génération, faits, sources et incertitudes encore ouvertes. */
object Briefing {
    private const val W = 595
    private const val H = 842
    private const val M = 46f

    fun write(out: OutputStream, s: Snapshot, watch: List<String>) {
        val doc = PdfDocument()
        var pageNo = 0
        var page: PdfDocument.Page? = null
        var cv: Canvas? = null
        var y = M
        val now = System.currentTimeMillis()

        fun paint(size: Float, color: Int, bold: Boolean = false) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size; this.color = color; typeface = Typeface.create(Typeface.SANS_SERIF, if (bold) Typeface.BOLD else Typeface.NORMAL)
        }
        val ink = 0xFF111827.toInt(); val grey = 0xFF5B6577.toInt(); val blue = 0xFF1D4E9E.toInt()
        val pTitle = paint(20f, ink, true); val pH = paint(12.5f, blue, true); val pB = paint(10f, ink, true); val pT = paint(9.5f, ink); val pS = paint(8.5f, grey)

        fun newPage() {
            page?.let { doc.finishPage(it) }
            pageNo++
            val p = doc.startPage(PdfDocument.PageInfo.Builder(W, H, pageNo).create())
            page = p; cv = p.canvas; y = M
            p.canvas.drawText("SENTINEL CYBER — briefing du ${dateTime(now)} — page $pageNo", M, H - 24f, pS)
        }

        fun text(str: String, p: TextPaint, indent: Float = 0f, gap: Float = 4f) {
            if (str.isBlank()) return
            val l = StaticLayout.Builder.obtain(str, 0, str.length, p, (W - 2 * M - indent).toInt()).build()
            if (y + l.height > H - M - 14) newPage()
            val c = cv ?: return
            c.save(); c.translate(M + indent, y); l.draw(c); c.restore()
            y += l.height + gap
        }

        fun section(title: String) { y += 10f; text(title.uppercase(), pH, gap = 6f) }

        fun entry(e: Event) {
            text(e.title, pB, gap = 2f)
            text("${typeLabel(e.type)} · Statut : ${statusLabel(e.status, true)}. ${e.statusReason ?: ""}", pT, 10f, 2f)
            text("Incident : ${e.incidentDate?.let { day(it) } ?: "date non communiquée"} · Divulgation : ${e.disclosedAt?.let { day(it) } ?: "date non communiquée"} · Dernière mise à jour : ${dateTime(e.updatedAt)} (version ${e.last.n})", pT, 10f, 2f)
            e.vuln?.let { v ->
                text("${v.cve} · CVSS ${v.cvss ?: "non publié"} · EPSS ${v.epss?.let { pct(it) } ?: "non disponible"} · KEV : ${v.kev?.added?.let { "inscrite le $it" } ?: "non inscrite"} · Correctif : ${if (v.patch == "oui") "référencé" else "non documenté"}", pT, 10f, 2f)
                text(priority(e, watchMatch(e, watch)).sentence, pT, 10f, 2f)
            }
            val urls = (e.last.claims.mapNotNull { it.url } + e.pubs.map { it.url }).distinct().take(3)
            if (urls.isNotEmpty()) text("Sources : " + urls.joinToString("  ·  "), pS, 10f, 8f) else y += 6f
        }

        newPage()
        text("SENTINEL CYBER", pTitle, gap = 2f)
        text("Briefing de veille généré le ${dateTime(now)}", pB, gap = 2f)
        val okSrc = s.sources.count { it.lastError == null && it.lastSuccess != null }
        text("Données collectées le ${dateTime(s.generatedAt)} · $okSrc sources joignables sur ${s.sources.size}. Classement automatique à partir des publications : à vérifier dans les sources citées.", pS, gap = 2f)
        text("Périmètre surveillé : ${if (watch.isEmpty()) "aucun élément enregistré" else watch.joinToString(", ")}", pS)

        val real = s.events.filter { !it.fictif }
        val week = now - 7 * 86_400_000L
        val mine = real.filter { watchMatch(it, watch) && it.recency >= now - 14 * 86_400_000L }.sortedByDescending { priority(it, true).score }.take(10)
        val incidents = real.filter { it.kind == "incident" && it.status == "confirme" && it.recency >= week && it !in mine }.sortedByDescending { it.recency }.take(10)
        val vulns = real.filter { it.vuln?.kev != null && it !in mine }.sortedByDescending { it.vuln?.kev?.added ?: "" }.take(10)

        section("1. Votre périmètre (14 derniers jours)")
        if (mine.isEmpty()) text(if (watch.isEmpty()) "Liste de surveillance vide." else "Aucune fiche récente ne correspond à votre liste de surveillance.", pT) else mine.forEach(::entry)
        section("2. Incidents confirmés (7 derniers jours)")
        if (incidents.isEmpty()) text("Aucun incident confirmé dans les publications collectées.", pT) else incidents.forEach(::entry)
        section("3. Vulnérabilités activement exploitées (dernières inscriptions KEV)")
        if (vulns.isEmpty()) text("Aucune inscription récente.", pT) else vulns.forEach(::entry)

        section("4. Incertitudes encore ouvertes")
        var open = 0
        for (e in mine + incidents + vulns) {
            val u = ArrayList<String>()
            if (e.kind == "incident" && e.incidentDate == null) u += "date de l’incident non communiquée"
            if (e.status != "confirme") u += "statut : ${statusLabel(e.status, true).lowercase()}"
            if (e.vuln != null && e.vuln.patch != "oui") u += "correctif non documenté"
            if (e.vuln != null && e.vuln.versions.isEmpty()) u += "versions touchées non précisées"
            contradictions(e.last.claims).forEach { (t, _) -> u += "sources en désaccord sur ${topicLabel(t)}" }
            e.actor?.let { u += "attribution à ${it.name} : ${it.confidence}" }
            if (u.isNotEmpty()) { open++; text("• ${e.title} — ${u.joinToString(" ; ")}.", pT, 0f, 3f) }
        }
        if (open == 0) text("Aucune incertitude relevée sur les fiches de ce briefing.", pT)

        val down = s.sources.filter { it.lastError != null }
        if (down.isNotEmpty()) {
            section("5. Sources indisponibles lors de la dernière collecte")
            down.forEach { text("• ${it.name} — dernières données reçues : ${it.lastSuccess?.let { t -> dateTime(t) } ?: "jamais"}.", pT, 0f, 2f) }
        }

        page?.let { doc.finishPage(it) }
        doc.writeTo(out)
        doc.close()
    }
}
