package ma.adess.sentinel

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/** Vérifie la logique de l'application sur l'instantané réel embarqué par le pipeline (assets/seed.json). */
class LogicTest {
    private val file = File("src/main/assets/seed.json")
    private val snap: Snapshot by lazy { parseSnapshot(file.readText()) }

    @Test
    fun instantaneReel() {
        assumeTrue(file.exists())
        assertTrue("fiches", snap.events.size > 30)
        assertTrue("sources", snap.sources.size > 20)
        assertTrue(snap.events.all { it.versions.isNotEmpty() && it.title.isNotBlank() })
        assertTrue("vulnérabilités avec score CVSS", snap.events.any { it.vuln?.cvss != null })
        assertTrue("incidents", snap.events.any { it.kind == "incident" && !it.fictif })
        for (e in snap.events) {
            assertEquals(5, thirtySeconds(e, false).size)
            assertTrue(priority(e, true).sentence.isNotBlank())
            contradictions(e.last.claims)
        }
        println("Instantané lu : ${snap.events.size} fiches, ${snap.sources.size} sources, ${markersOf(snap.events).size} pays localisés")
    }

    @Test
    fun scenarioFictif() {
        assumeTrue(file.exists())
        val d = snap.events.first { it.fictif }
        assertEquals(4, d.versions.size)
        val ch = diff(d.versions[1].claims, d.versions[2].claims)
        assertTrue(ch.any { it.k == "sauvegardes" && it.op == "mod" })
        assertTrue(ch.any { it.k == "donnees" && it.op == "del" })
        assertTrue(contradictions(d.last.claims).any { it.first == "impact" })
        val n = whatsNew(d, 2)
        assertFalse(n.firstVisit)
        assertTrue(n.changes.isNotEmpty())
        assertTrue(whatsNew(d, null).firstVisit)
        assertTrue(whatsNew(d, 4).changes.isEmpty())
    }

    @Test
    fun assistantLocal() {
        assumeTrue(file.exists())
        val a = localAnswer("Qu’a confirmé Orvane depuis son premier communiqué ?", snap, emptyList())
        assertTrue(a.refs.any { it.fictif })
        val b = localAnswer("Quels incidents confirmés concernent les hôpitaux cette semaine ?", snap, emptyList())
        assertTrue(b.criteria.contains("Santé"))
        assertTrue(b.refs.all { it.status == "confirme" && "Santé" in it.sectors && it.kind == "incident" })
        val c = localAnswer("Quelles alertes touchent les logiciels que je surveille ?", snap, emptyList())
        assertTrue(c.refs.isEmpty())
    }

    @Test
    fun alertesRegroupeesParFiche() {
        assumeTrue(file.exists())
        val v = snap.events.first { it.vuln?.kev != null }
        val before = snap.copy(events = snap.events.map { e ->
            if (e.id == v.id) e.copy(versions = listOf(e.last.copy(n = 0, claims = e.last.claims.filter { c -> c.k != "kev" }))) else e
        })
        val alerts = computeAlerts(before, snap, emptyList(), setOf(v.id), Rules(patch = true, exploit = true, scope = true))
        assertEquals(1, alerts.size)
        assertTrue(alerts[0].lines.any { it.contains("KEV") })
        assertTrue(computeAlerts(snap, snap, emptyList(), setOf(v.id), Rules(true, true, true)).isEmpty())
    }
}
