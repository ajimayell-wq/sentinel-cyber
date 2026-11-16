package ma.adess.sentinel

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp

data class Marker(val code: String, val name: String, val lat: Double, val lon: Double, val count: Int, val severity: String)

/** Un marqueur par pays explicitement mentionné dans les sources d'un incident. */
fun markersOf(events: List<Event>): List<Marker> =
    events.filter { !it.fictif && it.kind == "incident" }.flatMap { e -> e.countries.map { it to e } }.groupBy { it.first.code }.map { (code, l) ->
        val c = l.first().first
        Marker(code, c.name, c.lat, c.lon, l.size, l.map { it.second.severity }.minByOrNull { sevRank(it) } ?: "inconnue")
    }.sortedByDescending { it.count }

/** Masque des terres : grille de 90 x 34 cellules de 4°, de 78° N à 58° S (données Natural Earth simplifiées). */
private object Land {
    const val W = 90
    const val H = 34
    private const val HEX = "00008203ff0000080f80000000fb707f8000089ffe3008fff2eb8f8007e7fffffffc3ffffc63860377ffffffff0f3ff83000038ffffffff40003ff8f00006fffffffc300007fffe000bffffffff880000fffec003ffffffffc000003fff0000671fffffe800000fff000060bfffffe0000001ffc0000703ffffe10000003fe00007e8fffff80000000f880003fffbfffe00000000e00001fff78fff000000001a00007ffde1ef000000000180001fffb061c400000000110007fff008100000000000f000fffe000020000000003f0001ff800640000000001fe0007fc000b00000000007fe000fe000001800000001ffc003f8000103000000003ff000fe000002000000000ff8003fa00003a000000001fe000fc80001fc000000007e0001f20001ff800000001f80007800003fe000000007c0001c00000ef800000001e000000000000e00000000600000000000000000000018000000000000010000000c000000000000000000000300000000000000000000000000000000000000"
    val cells: BooleanArray by lazy {
        val out = BooleanArray(W * H)
        HEX.forEachIndexed { i, ch ->
            val v = Character.digit(ch, 16)
            for (b in 0..3) { val idx = i * 4 + b; if (idx < out.size) out[idx] = (v shr (3 - b)) and 1 == 1 }
        }
        out
    }
}

/** Carte du monde en points. N'affiche que des localisations documentées ; un appui sélectionne le pays le plus proche. */
@Composable
fun WorldMap(markers: List<Marker>, selected: String?, modifier: Modifier = Modifier, onSelect: ((String?) -> Unit)? = null) {
    val pulse by rememberInfiniteTransition(label = "carte").animateFloat(0f, 1f, infiniteRepeatable(tween(2400, easing = LinearEasing), RepeatMode.Restart), label = "pouls")
    var m = modifier.fillMaxWidth().aspectRatio(Land.W.toFloat() / Land.H)
    if (onSelect != null) m = m.pointerInput(markers, selected) {
        detectTapGestures { p ->
            val hit = markers.minByOrNull { mk -> (Offset(((mk.lon + 180) / 360 * size.width).toFloat(), ((78 - mk.lat) / 136 * size.height).toFloat()) - p).getDistance() }
            val d = hit?.let { mk -> (Offset(((mk.lon + 180) / 360 * size.width).toFloat(), ((78 - mk.lat) / 136 * size.height).toFloat()) - p).getDistance() } ?: Float.MAX_VALUE
            onSelect(if (hit != null && d < 30.dp.toPx() && hit.code != selected) hit.code else null)
        }
    }
    Canvas(m) {
        val cw = size.width / Land.W
        val ch = size.height / Land.H
        val r = cw * 0.27f
        val cells = Land.cells
        for (j in 0 until Land.H) for (i in 0 until Land.W) {
            if (cells[j * Land.W + i]) drawCircle(C.line, r, Offset((i + 0.5f) * cw, (j + 0.5f) * ch))
        }
        val max = (markers.maxOfOrNull { it.count } ?: 1).coerceAtLeast(1)
        for (mk in markers.asReversed()) {
            val c = Offset(((mk.lon + 180) / 360 * size.width).toFloat(), ((78 - mk.lat) / 136 * size.height).toFloat())
            val col = if (mk.severity == "inconnue") C.blue else sevColor(mk.severity)
            val base = cw * (1.0f + 1.5f * mk.count / max)
            val on = mk.code == selected
            drawCircle(col.copy(alpha = (1f - pulse) * 0.45f), base + pulse * cw * 3.2f, c, style = Stroke(1.5f))
            drawCircle(col.copy(alpha = 0.22f), base * 1.7f, c)
            drawCircle(col, base * 0.72f, c)
            if (on) drawCircle(C.text, base * 2.1f, c, style = Stroke(2.2f))
        }
    }
}
