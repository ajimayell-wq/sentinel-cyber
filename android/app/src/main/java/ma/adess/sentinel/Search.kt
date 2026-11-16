package ma.adess.sentinel

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import java.util.Locale

private val EXAMPLES = listOf(
    "Quels incidents confirmés concernent les hôpitaux cette semaine ?",
    "Quelles alertes touchent les logiciels que je surveille ?",
    "Qu’a confirmé Orvane depuis son premier communiqué ?",
    "Quelles vulnérabilités exploitées ont été confirmées cette semaine ?",
)

@Composable
fun SearchScreen(nav: Nav) {
    val s = Repo.snap
    var q by rememberSaveable { mutableStateOf("") }
    var asked by rememberSaveable { mutableStateOf("") }
    var answer by remember { mutableStateOf<Answer?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val ask: (String) -> Unit = { text ->
        if (text.isNotBlank() && !busy) {
            q = text; asked = text; busy = true
            scope.launch { answer = Repo.ask(text); busy = false }
        }
    }
    val hits = remember(s, q, asked) {
        val t = q.trim().lowercase(Locale.FRENCH)
        if (s == null || t.length < 2 || q == asked) emptyList() else s.events.filter { it.hay.contains(t) }.sortedByDescending { it.recency }.take(30)
    }

    Column(Modifier.fillMaxSize()) {
        ScreenHead("Recherche", "Fiches indexées et assistant")
        Field(q, { q = it }, "Mot-clé, CVE ou question…", Modifier.padding(horizontal = 16.dp).fillMaxWidth(), onDone = { ask(q) })
        LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (q.isNotBlank() && q != asked) item { Button("Poser cette question à l’assistant", Ic.spark, primary = true, modifier = Modifier.fillMaxWidth()) { ask(q) } }
            if (busy) item { Note("Interrogation des fiches indexées…") }
            val a = answer
            if (a != null && !busy) {
                item { AnswerCard(a, asked) }
                items(a.refs, key = { "r" + it.id }) { EventCard(it, nav) }
            }
            if (hits.isNotEmpty()) {
                item { SectionHead("Fiches correspondantes", hits.size) }
                items(hits, key = { "h" + it.id }) { EventCard(it, nav) }
            } else if (q.trim().length >= 2 && q != asked && s != null) item { Note("Aucune fiche ne contient « ${q.trim()} ». Vous pouvez poser la question à l’assistant.") }
            if (a == null && !busy && q.isBlank()) {
                item { SectionHead("Exemples de questions") }
                items(EXAMPLES) { ex ->
                    Panel(onClick = { ask(ex) }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Ic.spark, null, tint = C.blue, modifier = Modifier.size(17.dp))
                            Spacer(Modifier.width(11.dp))
                            Text(ex, style = ts(14.0, lh = 19.5), modifier = Modifier.weight(1f))
                        }
                    }
                }
                item { Note("L’assistant répond uniquement à partir des publications collectées, avec les fiches en référence et des dates explicites.") }
            }
        }
    }
}

@Composable
private fun AnswerCard(a: Answer, asked: String) {
    Panel(accent = C.blue) {
        Eyebrow(if (a.local) "Réponse — fiches indexées" else "Réponse — assistant du serveur", C.blue)
        Text(asked, style = ts(12.5, color = C.faint, lh = 17.5), modifier = Modifier.padding(top = 5.dp))
        Spacer(Modifier.height(8.dp))
        Text(a.text, style = ts(14.5, FontWeight.Medium, lh = 21.0))
        Spacer(Modifier.height(10.dp))
        Eyebrow("Critères compris")
        Text(a.criteria, style = ts(12.5, color = C.dim, lh = 17.5), modifier = Modifier.padding(top = 3.dp))
        Text(
            if (a.local) "Réponse obtenue par filtrage des fiches, sans texte généré. Chaque référence ci-dessous ouvre la fiche et ses sources."
            else "Texte rédigé par un modèle de langage à partir des fiches citées : vérifiez les références ci-dessous.",
            style = ts(11.5, color = C.faint, lh = 16.0), modifier = Modifier.padding(top = 8.dp),
        )
    }
}
