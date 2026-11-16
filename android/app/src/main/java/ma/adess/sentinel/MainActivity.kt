package ma.adess.sentinel

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

sealed interface Route {
    data class Detail(val id: String) : Route
    data class Compare(val id: String, val a: Int, val b: Int) : Route
    object Brief : Route
}

/** État de navigation : onglet courant, pile de fiches ouvertes et filtres conservés d'un onglet à l'autre. */
class Nav {
    var tab by mutableStateOf(0)
    val stack = mutableStateListOf<Route>()
    var incView by mutableStateOf(0)
    var filters by mutableStateOf(FilterSet())
    var vulnFlags by mutableStateOf(setOf<String>())
    var vulnQuery by mutableStateOf("")

    fun open(id: String) { stack.add(Route.Detail(id)) }
    fun compare(id: String, a: Int, b: Int) { stack.add(Route.Compare(id, a, b)) }
    fun brief() { stack.add(Route.Brief) }
    fun pop() { if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex) }
}

/** Fiche à ouvrir depuis une notification. */
object Deep { var event by mutableStateOf<String?>(null) }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.dark(0), navigationBarStyle = SystemBarStyle.dark(0))
        Repo.init(applicationContext)
        Fonts.load(applicationContext)
        SyncWorker.schedule(applicationContext)
        Deep.event = intent?.getStringExtra("event")
        setContent { App() }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        Deep.event = intent.getStringExtra("event")
    }
}

private val TABS = listOf("Accueil" to Ic.home, "Incidents" to Ic.incident, "Vulnérabilités" to Ic.vuln, "Recherche" to Ic.search, "Ma veille" to Ic.watch)

@Composable
fun App() {
    val nav = remember { Nav() }
    LaunchedEffect(Unit) { Repo.sync() }
    LaunchedEffect(Deep.event, Repo.snap != null) {
        val id = Deep.event
        if (id != null && Repo.snap != null) { if (Repo.snap?.event(id) != null) nav.open(id); Deep.event = null }
    }

    MaterialTheme(colorScheme = darkColorScheme(background = C.bg, surface = C.surface, primary = C.blue, onBackground = C.text, onSurface = C.text)) {
        Box(Modifier.fillMaxSize().background(C.bg).background(Grad.glow)) {
            Column(Modifier.fillMaxSize().systemBarsPadding().imePadding()) {
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    when (nav.tab) {
                        0 -> HomeScreen(nav)
                        1 -> IncidentsScreen(nav)
                        2 -> VulnsScreen(nav)
                        3 -> SearchScreen(nav)
                        else -> WatchScreen(nav)
                    }
                }
                BottomBar(nav)
            }
            val route = nav.stack.lastOrNull()
            if (route != null) {
                Box(Modifier.fillMaxSize().background(C.bg).clickable(enabled = false) {}.systemBarsPadding()) {
                    when (route) {
                        is Route.Detail -> DetailScreen(route.id, nav)
                        is Route.Compare -> CompareScreen(route.id, route.a, route.b, nav)
                        Route.Brief -> BriefScreen(nav)
                    }
                }
            }
            BackHandler(enabled = nav.stack.isNotEmpty() || nav.tab != 0) { if (nav.stack.isNotEmpty()) nav.pop() else nav.tab = 0 }
        }
    }
}

@Composable
private fun BottomBar(nav: Nav) {
    Column(Modifier.fillMaxWidth().background(C.surface)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(C.line))
        Row(Modifier.fillMaxWidth().height(62.dp)) {
            TABS.forEachIndexed { i, (label, icon) ->
                val on = nav.tab == i
                Column(
                    Modifier.weight(1f).fillMaxSize().clickable { nav.tab = i },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(Modifier.width(26.dp).height(2.dp).clip(RoundedCornerShape(1.dp)).background(if (on) C.blue else C.surface))
                    Spacer(Modifier.height(9.dp))
                    Icon(icon, label, tint = if (on) C.blue else C.faint, modifier = Modifier.size(22.dp))
                    Spacer(Modifier.height(4.dp))
                    Text(label, style = ts(9.8, if (on) FontWeight.SemiBold else FontWeight.Normal, if (on) C.text else C.faint, ls = -0.2), maxLines = 1, softWrap = false)
                }
            }
        }
    }
}
