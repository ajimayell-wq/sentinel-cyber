package ma.adess.sentinel

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

/** Palette graphite et violet. Les couleurs d'alerte sont toujours doublées d'un libellé et d'une forme. */
object C {
    val bg = Color(0xFF0B0A10)
    val surface = Color(0xFF16141E)
    val raised = Color(0xFF1F1C29)
    val line = Color(0xFF2A2735)
    val text = Color(0xFFEEECF5)
    val dim = Color(0xFFA7A3B8)
    val faint = Color(0xFF6F6B82)
    val blue = Color(0xFFA78BFA)
    val blueDeep = Color(0xFF2A2346)
    val red = Color(0xFFFF6470)
    val orange = Color(0xFFFF9F45)
    val yellow = Color(0xFFEFCB5A)
    val green = Color(0xFF55D6A0)
    val violet = Color(0xFFD9A2FF)
}

/** Dégradés du thème : violet vif pour les actions, voile clair pour le relief des cartes. */
object Grad {
    val main = Brush.linearGradient(listOf(Color(0xFF6D4DFF), Color(0xFF9B6BFF), Color(0xFFD58BFF)))
    val soft = Brush.linearGradient(listOf(Color(0x6B6D4DFF), Color(0x42D58BFF)))
    val card = Brush.verticalGradient(listOf(Color(0xFF1A1823), Color(0xFF13121A)))
    val sheen = Brush.linearGradient(listOf(Color.White.copy(alpha = 0.05f), Color.Transparent), start = Offset.Zero, end = Offset(520f, 820f))
    val glow = Brush.radialGradient(listOf(Color(0x307A58FF), Color.Transparent), center = Offset(980f, -60f), radius = 1300f)
}

/** IBM Plex Sans et Plex Mono si le pipeline les a embarquées, sinon polices du système. */
object Fonts {
    var sans: FontFamily = FontFamily.Default
        private set
    var mono: FontFamily = FontFamily.Monospace
        private set

    fun load(ctx: Context) {
        val have = runCatching { ctx.assets.list("fonts")?.toSet() }.getOrNull() ?: emptySet()
        fun family(prefix: String, weights: List<Int>): FontFamily? {
            val fonts = weights.filter { "$prefix-$it.ttf" in have }.map { Font("fonts/$prefix-$it.ttf", ctx.assets, FontWeight(it)) }
            return if (fonts.isEmpty()) null else FontFamily(fonts)
        }
        (family("manrope", listOf(400, 500, 600, 700)) ?: family("ibm-plex-sans", listOf(400, 500, 600)))?.let { sans = it }
        family("ibm-plex-mono", listOf(400, 500))?.let { mono = it }
    }
}

fun ts(size: Double, weight: FontWeight = FontWeight.Normal, color: Color = C.text, mono: Boolean = false, ls: Double = 0.0, lh: Double = 0.0) = TextStyle(
    fontFamily = if (mono) Fonts.mono else Fonts.sans, fontSize = size.sp, fontWeight = weight, color = color,
    letterSpacing = ls.sp, lineHeight = if (lh > 0) lh.sp else TextUnit.Unspecified,
)

fun statusColor(st: String) = when (st) { "confirme" -> C.green; "revendique" -> C.violet; "conteste" -> C.orange; else -> C.blue }
fun sevColor(sev: String) = when (sev) { "critique" -> C.red; "elevee" -> C.orange; "moyenne" -> C.yellow; "faible" -> C.green; else -> C.faint }
fun sevRank(sev: String) = when (sev) { "critique" -> 0; "elevee" -> 1; "moyenne" -> 2; "faible" -> 3; else -> 4 }

/** Icônes au trait, dessinées pour l'application. */
object Ic {
    private fun mk(vararg d: String): ImageVector = ImageVector.Builder(defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f).apply {
        d.forEach { addPath(pathData = addPathNodes(it), fill = null, stroke = SolidColor(Color.White), strokeLineWidth = 1.7f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round) }
    }.build()

    val home = mk("M4 11l8-7 8 7", "M6 10v9h12v-9", "M10 19v-5h4v5")
    val incident = mk("M12 3.5l9 15.5H3z", "M12 10v4", "M12 16.4v.2")
    val vuln = mk("M12 3l7 3v5c0 5-3 8-7 10c-4-2-7-5-7-10V6z", "M9.5 12l2 2l3.5-4")
    val search = mk("M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14", "M16 16l4 4")
    val watch = mk("M2.5 12c2-4 5.5-6.5 9.5-6.5s7.5 2.5 9.5 6.5c-2 4-5.5 6.5-9.5 6.5s-7.5-2.5-9.5-6.5z", "M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5")
    val back = mk("M14 6l-6 6l6 6")
    val star = mk("M12 4l2.4 5l5.6.7l-4.1 3.8l1.1 5.5l-5-2.8l-5 2.8l1.1-5.5L4 9.7l5.6-.7z")
    val link = mk("M14 5h5v5", "M19 5l-8 8", "M11 7H6v11h11v-5")
    val refresh = mk("M19 12a7 7 0 1 1-2.1-5", "M19 4v4h-4")
    val close = mk("M6 6l12 12", "M18 6L6 18")
    val compare = mk("M5 5h5v14H5z", "M14 5h5v14h-5z", "M10 12h4")
    val map = mk("M3 6l6-2l6 2l6-2v14l-6 2l-6-2l-6 2z", "M9 4v14", "M15 6v14")
    val bell = mk("M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z", "M10 20a2 2 0 0 0 4 0")
    val doc = mk("M7 3h7l4 4v14H7z", "M14 3v4h4", "M10 12h5", "M10 16h5")
    val spark = mk("M12 3v5", "M12 16v5", "M3 12h5", "M16 12h5", "M6 6l3 3", "M15 15l3 3", "M18 6l-3 3", "M9 15l-3 3")
    val plus = mk("M12 5v14", "M5 12h14")
    val chevron = mk("M9 6l6 6l-6 6")
    val clock = mk("M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16", "M12 8v4l3 2")
}

@Composable
fun Eyebrow(text: String, color: Color = C.faint, modifier: Modifier = Modifier) =
    Text(text.uppercase(Locale.FRENCH), style = ts(10.5, FontWeight.Medium, color, mono = true, ls = 1.3), modifier = modifier, maxLines = 1, overflow = TextOverflow.Ellipsis)

/** Forme distincte par statut : disque plein, losange, triangle, anneau. */
@Composable
fun StatusMark(st: String, dp: Int = 9) {
    val col = statusColor(st)
    Canvas(Modifier.size(dp.dp)) {
        val w = this.size.width
        when (st) {
            "confirme" -> drawCircle(col)
            "revendique" -> drawPath(Path().apply { moveTo(w / 2, 0f); lineTo(w, w / 2); lineTo(w / 2, w); lineTo(0f, w / 2); close() }, col)
            "conteste" -> drawPath(Path().apply { moveTo(w / 2, 0f); lineTo(w, w); lineTo(0f, w); close() }, col)
            else -> drawCircle(col, radius = w / 2 - w * 0.12f, style = Stroke(w * 0.22f))
        }
    }
}

@Composable
fun StatusChip(st: String, long: Boolean = false) {
    val col = statusColor(st)
    val shape = RoundedCornerShape(6.dp)
    Row(
        Modifier.clip(shape).background(col.copy(alpha = 0.11f)).border(1.dp, col.copy(alpha = 0.34f), shape).padding(horizontal = 7.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StatusMark(st, 8)
        Spacer(Modifier.width(6.dp))
        Text(statusLabel(st, long).uppercase(Locale.FRENCH), style = ts(10.5, FontWeight.Medium, col, mono = true, ls = 0.8), maxLines = 1)
    }
}

/** Jauge de gravité à quatre barres, toujours accompagnée de son libellé. */
@Composable
fun SeverityMeter(sev: String, showLabel: Boolean = true) {
    val level = 4 - sevRank(sev)
    val col = sevColor(sev)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
            for (i in 1..4) Box(Modifier.width(3.dp).height((4 + i * 2).dp).clip(RoundedCornerShape(1.dp)).background(if (i <= level) col else C.line))
        }
        if (showLabel) {
            Spacer(Modifier.width(6.dp))
            Text(sevLabel(sev).uppercase(Locale.FRENCH), style = ts(10.5, FontWeight.Medium, if (level == 0) C.faint else col, mono = true, ls = 0.8), maxLines = 1)
        }
    }
}

@Composable
fun Pill(text: String, color: Color = C.dim, filled: Boolean = false) {
    Text(
        text, style = ts(11.0, FontWeight.Medium, color, mono = true), maxLines = 1, overflow = TextOverflow.Ellipsis,
        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(if (filled) color.copy(alpha = 0.14f) else C.raised).padding(horizontal = 7.dp, vertical = 3.dp),
    )
}

@Composable
fun FictifBadge() {
    Text(
        "SCÉNARIO FICTIF — DÉMONSTRATION", style = ts(10.5, FontWeight.Medium, C.violet, mono = true, ls = 1.0), maxLines = 1,
        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(C.violet.copy(alpha = 0.13f)).border(1.dp, C.violet.copy(alpha = 0.45f), RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 4.dp),
    )
}

@Composable
fun Panel(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, accent: Color? = null, fill: Color = C.surface, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(20.dp)
    var m = modifier.fillMaxWidth().clip(shape)
        .background(if (fill == C.surface) Grad.card else SolidColor(fill))
        .background(Grad.sheen)
        .border(1.dp, Color.White.copy(alpha = 0.06f), shape)
    if (accent != null) m = m.drawBehind {
        val inset = 14.dp.toPx()
        drawRoundRect(accent, topLeft = Offset(0f, inset), size = Size(3.dp.toPx(), (this.size.height - 2 * inset).coerceAtLeast(0f)), cornerRadius = CornerRadius(3.dp.toPx()))
    }
    if (onClick != null) m = m.clickable(onClick = onClick)
    Column(m.padding(start = 15.dp, end = 14.dp, top = 13.dp, bottom = 13.dp), content = content)
}

@Composable
fun SectionHead(title: String, count: Int? = null, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = ts(17.0, FontWeight.SemiBold), modifier = Modifier.weight(1f, fill = false))
        if (count != null) { Spacer(Modifier.width(8.dp)); Text(count.toString(), style = ts(12.0, FontWeight.Medium, C.faint, mono = true)) }
        Spacer(Modifier.weight(1f))
        if (action != null && onAction != null) Text(action, style = ts(13.0, FontWeight.Medium, C.blue), modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onAction).padding(6.dp))
    }
}

@Composable
fun ScreenHead(title: String, sub: String? = null, trailing: @Composable RowScope.() -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 10.dp, top = 14.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = ts(25.0, FontWeight.SemiBold, ls = -0.3))
            if (sub != null) Text(sub, style = ts(12.5, color = C.dim), modifier = Modifier.padding(top = 2.dp))
        }
        trailing()
    }
}

@Composable
fun IconBtn(icon: ImageVector, label: String, tint: Color = C.text, onClick: () -> Unit) {
    Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Icon(icon, label, tint = tint, modifier = Modifier.size(22.dp))
    }
}

@Composable
fun TopBar(title: String, onBack: () -> Unit, actions: @Composable RowScope.() -> Unit = {}) {
    Row(Modifier.fillMaxWidth().height(52.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        IconBtn(Ic.back, "Retour", onClick = onBack)
        Text(title.uppercase(Locale.FRENCH), style = ts(12.0, FontWeight.Medium, C.dim, mono = true, ls = 1.2), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(start = 2.dp))
        actions()
    }
}

@Composable
fun Segmented(options: List<String>, selected: Int, modifier: Modifier = Modifier, onSelect: (Int) -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Row(modifier.fillMaxWidth().clip(shape).background(C.surface).border(1.dp, Color.White.copy(alpha = 0.06f), shape).padding(3.dp)) {
        options.forEachIndexed { i, label ->
            val on = i == selected
            Box(
                Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(if (on) Grad.soft else SolidColor(Color.Transparent)).clickable { onSelect(i) }.padding(vertical = 9.dp),
                contentAlignment = Alignment.Center,
            ) { Text(label, style = ts(13.0, if (on) FontWeight.SemiBold else FontWeight.Normal, if (on) C.text else C.dim), maxLines = 1) }
        }
    }
}

@Composable
fun Chip(label: String, active: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(9.dp)
    Text(
        label, style = ts(12.5, FontWeight.Medium, if (active) C.text else C.dim), maxLines = 1,
        modifier = Modifier.clip(shape).background(if (active) C.blueDeep else C.surface).border(1.dp, if (active) C.blue.copy(alpha = 0.6f) else C.line, shape).clickable(onClick = onClick).padding(horizontal = 11.dp, vertical = 7.dp),
    )
}

@Composable
fun Field(value: String, onValue: (String) -> Unit, hint: String, modifier: Modifier = Modifier, icon: ImageVector? = Ic.search, onDone: (() -> Unit)? = null) {
    val shape = RoundedCornerShape(12.dp)
    Row(modifier.clip(shape).background(C.surface).border(1.dp, C.line, shape).padding(horizontal = 12.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) { Icon(icon, null, tint = C.faint, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(9.dp)) }
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Text(hint, style = ts(14.5, color = C.faint), maxLines = 1, overflow = TextOverflow.Ellipsis)
            BasicTextField(
                value = value, onValueChange = onValue, singleLine = true, textStyle = ts(14.5), cursorBrush = SolidColor(C.blue),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done), keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (value.isNotEmpty()) Icon(Ic.close, "Effacer", tint = C.faint, modifier = Modifier.size(18.dp).clip(CircleShape).clickable { onValue("") })
    }
}

@Composable
fun Toggle(on: Boolean, onChange: (Boolean) -> Unit) {
    Box(
        Modifier.width(46.dp).height(27.dp).clip(CircleShape).background(if (on) C.blue else C.line).clickable { onChange(!on) }.padding(3.dp),
        contentAlignment = if (on) Alignment.CenterEnd else Alignment.CenterStart,
    ) { Box(Modifier.size(21.dp).clip(CircleShape).background(if (on) C.bg else C.dim)) }
}

@Composable
fun EmptyState(title: String, body: String) {
    Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, style = ts(16.0, FontWeight.SemiBold))
        Spacer(Modifier.height(6.dp))
        Text(body, style = ts(13.5, color = C.dim, lh = 19.0))
    }
}

@Composable
fun Button(label: String, icon: ImageVector? = null, primary: Boolean = false, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier.clip(shape).background(if (primary) Grad.main else SolidColor(C.raised)).border(1.dp, if (primary) Color.Transparent else Color.White.copy(alpha = 0.07f), shape).clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) { Icon(icon, null, tint = if (primary) Color.White else C.blue, modifier = Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)) }
        Text(label, style = ts(13.5, FontWeight.SemiBold, if (primary) Color.White else C.text), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}
