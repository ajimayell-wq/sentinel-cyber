// ───────────── Éléments d'interface ─────────────
const ico = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  accueil: ico('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  incidents: ico('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>'),
  vulns: ico('<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 8v4M12 15v.5"/>'),
  recherche: ico('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  veille: ico('<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>'),
  back: ico('<path d="M15 5l-7 7 7 7"/>'), star: ico('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>'),
  refresh: ico('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>'), link: ico('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  spark: ico('<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>'), compare: ico('<path d="M8 4v16M16 4v16M4 8l4-4 4 4M12 16l4 4 4-4"/>'),
  doc: ico('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>'), bell: ico('<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/>'),
  plus: ico('<path d="M12 5v14M5 12h14"/>'), close: ico('<path d="M6 6l12 12M18 6L6 18"/>'),
};
const clean = t => t.replace(/^\[FICTIF\] /, '');
const pill = (t, c, fill) => `<span class="pill${fill ? ' fill' : ''}" style="--c:${c}">${esc(t)}</span>`;
const stChip = (st, long) => `<span class="pill fill" style="--c:${statusColor(st)}"><i class="mark m-${esc(st)}"></i>${esc(statusLabel(st, long))}</span>`;
const sevMeter = s => { const n = SEV[s]?.[1] ?? 0; return `<span class="sev" style="--c:${sevColor(s)}" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span><span class="small" style="color:var(--dim)">${esc(sevLabel(s))}</span>`; };
const eyebrow = (t, c) => `<div class="eyebrow"${c ? ` style="--c:${c}"` : ''}>${esc(t)}</div>`;
const sec = (title, n, btn, act) => `<div class="sec"><h3>${esc(title)}</h3>${n != null ? `<span class="n">${n}</span>` : ''}${btn ? `<button data-act="${act}">${esc(btn)}</button>` : ''}</div>`;
const note = t => `<p class="note">${esc(t)}</p>`;
const empty = (t, s) => `<div class="empty"><h3>${esc(t)}</h3><p>${esc(s ?? '')}</p></div>`;
const btn = (label, icon, act, o = {}) => `<button class="btn${o.primary ? ' primary' : ''}${o.block ? ' block' : ''}" data-act="${act}"${o.v != null ? ` data-v="${esc(o.v)}"` : ''}>${icon ? IC[icon] : ''}${esc(label)}</button>`;
function lnk(text, url, fictif) {
  const u = safeUrl(url);
  if (u && !fictif) return `<a class="src" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`;
  return `<span class="src off">${esc(text)}${fictif ? ' (lien fictif)' : ''}</span>`;
}
function card(e) {
  const f = S.followed.includes(e.id), v = e.vuln;
  const line = v ? `<p class="sum mono" style="font-size:12.5px">${esc(v.cve)} · CVSS ${v.cvss ?? '—'} · EPSS ${v.epss != null ? pct(v.epss) : '—'}${v.kev ? ' · exploitée (KEV)' : ''}${v.patch === 'oui' ? ' · correctif référencé' : ''}</p>` : e.summary ? `<p class="sum">${esc(e.summary)}</p>` : '';
  const src = e.sourceCount ? `${e.sourceCount} source${e.sourceCount > 1 ? 's' : ''}` : 'bases NVD / KEV';
  return `<a class="panel card${e.fictif ? ' acc' : ''}" ${e.fictif ? 'style="--acc:var(--violet)"' : ''} href="#/fiche/${enc(e.id)}">
    <div class="wrapflex" style="gap:6px;align-items:center">${stChip(e.status)}${e.kind !== 'actu' ? sevMeter(e.severity) : ''}${pill(typeLabel(e.type), 'var(--dim)')}${isWatched(e) ? pill('Ma veille', 'var(--blue)', 1) : ''}${e.fictif ? pill('FICTIF', 'var(--violet)', 1) : ''}</div>
    <div class="title">${esc(clean(e.title))}</div>${line}
    <div class="meta">${e.disclosedAt ? day(e.disclosedAt) : 'date non communiquée'} · ${src} · v${e.last.n} · ${ago(e.updatedAt)}</div>${f ? `<span class="star" title="Fiche suivie" style="width:18px;height:18px">${IC.star.replace('fill="none"', 'fill="currentColor"')}</span>` : ''}</a>`;
}
const topbar = (title, right = '') => `<div class="top"><button class="iconbtn" data-act="back" aria-label="Retour">${IC.back}</button><h2>${esc(title)}</h2>${right}</div>`;
const head = (t, s) => `<div class="head"><h1>${esc(t)}</h1><p>${esc(s)}</p></div>`;
const seg = (labels, cur, act) => `<div class="seg" role="group">${labels.map((l, i) => `<button data-act="${act}" data-v="${i}" aria-pressed="${i === cur}">${esc(l)}</button>`).join('')}</div>`;
const chip = (label, on, act, g, v) => `<button class="chip" aria-pressed="${on}" data-act="${act}"${g != null ? ` data-g="${esc(g)}"` : ''} data-v="${esc(v)}">${esc(label)}</button>`;
const noSnap = () => S.loading ? empty('Chargement des fiches…', 'Récupération de l’instantané en cours.') : `<div class="empty"><h3>Aucune donnée disponible</h3><p>${esc(S.error ? `Le serveur est injoignable : ${S.error}.` : 'Aucun instantané n’a pu être chargé.')}</p><p>${btn('Réessayer', 'refresh', 'refresh', { primary: 1 })}</p></div>`;
const syncPill = () => { const s = S.snap, c = S.syncing ? 'var(--blue)' : (S.error || S.fromCache) ? 'var(--orange)' : 'var(--green)'; return `<button class="syncpill" data-act="refresh" style="--c:${c}" aria-label="Synchroniser maintenant"><i></i>${S.syncing ? 'Synchronisation…' : s ? `Collecte ${esc(ago(s.generatedAt))}` : 'Synchroniser'} ${IC.refresh.replace('<svg', '<svg width="15" height="15"')}</button>`; };

// ───────────── À la une ─────────────
// Sujets des dernières 36 h dont tout le monde parle : nombre de sources, grand éditeur touché, panne mondiale, faille critique exploitée.
// Le statut n'entre pas dans le tri : une panne « signalée » mais couverte partout reste à la une.
const BIG = /\b(microsoft|outlook|teams|azure|windows|google|gmail|android|chrome|apple|icloud|iphone|amazon|aws|cloudflare|meta|facebook|instagram|whatsapp|crowdstrike|cisco|fortinet|palo alto|oracle|salesforce|openai|chatgpt|x\.com|twitter|starlink|visa|mastercard|swift)\b/i;
function headlines(real, now = Date.now()) {
  const since = now - 36 * 3600e3, sinceDay = new Date(since).toISOString().slice(0, 10), out = [], seen = new Set();
  const scored = real.map(e => {
    const v = e.vuln, big = (lower(e.title).match(BIG) ?? [])[0];
    let score = 0;
    if (e.kind === 'incident' && e.recency >= since) score = e.sourceCount * 2 + (big ? 3 : 0) + (e.type === 'panne' ? 2 : 0) + (e.status === 'confirme' ? 1 : 0) + (/mondial|worldwide|global/i.test(e.title) ? 2 : 0);
    else if (v?.kev && (v.kev.added ?? '') >= sinceDay) score = 3 + ((v.cvss ?? 0) >= 9 ? 2 : 0) + (v.kev.ransomware === 'Known' ? 2 : 0) + (big ? 2 : 0);
    return { e, score, key: e.type === 'panne' && big ? 'panne:' + big.replace(/outlook|teams|azure|windows/, 'microsoft') : e.id };
  }).filter(x => x.score >= 5).sort((a, b) => b.score - a.score || b.e.recency - a.e.recency);
  for (const x of scored) { if (seen.has(x.key)) continue; seen.add(x.key); out.push(x.e); if (out.length >= 5) break; }
  return out;
}

// ───────────── Accueil ─────────────
function homeView() {
  const s = S.snap;
  if (!s) return `<div class="wrap">${head('SENTINEL CYBER', 'Veille cybersécurité mondiale')}${noSnap()}</div>`;
  const now = Date.now(), h72 = now - 72 * 3600e3, real = s.events.filter(e => !e.fictif), watch = S.watch;
  const confirmed = real.filter(e => e.kind === 'incident' && e.status === 'confirme' && e.recency >= h72).sort((a, b) => b.recency - a.recency);
  const evol = real.filter(e => e.versions.length > 1 && e.updatedAt >= h72).sort((a, b) => b.updatedAt - a.updatedAt);
  const mine = real.filter(e => watchMatch(e, watch)).sort((a, b) => priority(b, 1).score - priority(a, 1).score || b.recency - a.recency);
  const weekAgo = new Date(now - 7 * 86400e3).toISOString().slice(0, 10);
  const kev = real.filter(e => (e.vuln?.kev?.added ?? '') >= weekAgo).length;
  const marks = markersOf(real), okSrc = s.sources.filter(x => !x.lastError && x.lastSuccess).length;
  const maroc = real.filter(e => e.countries.some(c => c.code === 'MA')).sort((a, b) => b.recency - a.recency);
  const demo = s.events.find(e => e.fictif), une = headlines(real, now);
  const warn = (S.fromCache || S.error) ? `<div class="panel acc" style="--acc:var(--orange)">${eyebrow(S.fromCache ? 'Données en cache' : 'Hors connexion', 'var(--orange)')}<p class="note">${esc(S.fromCache ? `Vous consultez la dernière copie enregistrée, collectée le ${dateTime(s.generatedAt)}.` : `Dernières fiches synchronisées : données du ${dateTime(s.generatedAt)}.`)}${S.error ? ` Serveur injoignable : ${esc(S.error)}.` : ''}</p></div>` : '';
  return `<div class="wrap">
    <div class="between" style="padding:16px 0 4px"><div class="wm"><i></i>SENTINEL <b>CYBER</b></div>${syncPill()}</div>${warn}
    <div class="stats" style="margin-top:10px">
      <button class="panel" data-act="goStat" data-v="conf"><div class="v" style="color:var(--green)">${confirmed.length}</div><div class="l">Incidents confirmés</div><div class="s">72 heures</div></button>
      <button class="panel" data-act="goStat" data-v="kev"><div class="v" style="color:var(--orange)">${kev}</div><div class="l">Inscriptions KEV</div><div class="s">7 jours</div></button>
      <button class="panel" data-act="goStat" data-v="src"><div class="v" style="color:${okSrc === s.sources.length ? 'var(--blue)' : 'var(--yellow)'}">${okSrc}/${s.sources.length}</div><div class="l">Sources</div><div class="s">joignables</div></button>
    </div>
    ${une.length ? `<div class="sec"><h3 style="color:var(--orange)">À la une</h3><span class="n">${une.length}</span></div>${une.map(card).join('')}` : ''}
    <a class="btn primary block" style="margin:12px 0 2px" href="#/briefing">${IC.doc}Briefing des dernières 24 h</a>
    <button class="panel" data-act="goStat" data-v="map"><div class="between">${eyebrow('Localisations documentées')}<span class="small mono">${marks.length} pays ›</span></div><canvas class="map" id="map-home" role="img" aria-label="Carte des pays mentionnés dans les incidents"></canvas></button>
    ${sec('Maroc', maroc.length, 'Incidents', 'goStat" data-v="ma')}
    ${maroc.length ? maroc.slice(0, 6).map(card).join('') : note('Aucune fiche ne mentionne le Maroc dans les publications collectées (DGSSI, presse marocaine, revendications de rançongiciels).')}
    ${sec('Nouveaux incidents confirmés', confirmed.length, 'Tout voir', 'goStat" data-v="conf')}
    ${confirmed.length ? confirmed.slice(0, 6).map(card).join('') : note('Aucun incident confirmé sur les 72 dernières heures dans les publications collectées.')}
    ${sec('Évolutions importantes', Math.min(evol.length, 6))}
    ${evol.length ? evol.slice(0, 6).map(card).join('') : note('Aucune fiche n’a changé de version sur les 72 dernières heures. Les corrections et nouveaux faits apparaîtront ici, avec ce qui a changé.')}
    ${sec('Vos technologies suivies', watch.length ? Math.min(mine.length, 6) : null, watch.length ? 'Ma veille' : 'Configurer', 'tab" data-v="veille')}
    ${!watch.length ? note('Enregistrez les logiciels, fournisseurs cloud et secteurs que vous surveillez : les alertes qui les concernent remonteront ici en priorité.') : mine.length ? mine.slice(0, 6).map(card).join('') : note(`Aucune fiche récente ne concerne : ${watch.join(', ')}.`)}
    ${demo ? `${sec('Démonstration')}${note('Scénario inventé pour montrer la comparaison de versions : un éditeur confirme une intrusion, puis révèle que ses sauvegardes ont été touchées.')}${card(demo)}` : ''}
  </div>`;
}

// ───────────── Incidents, actualités, carte ─────────────
function filterPanel(list) {
  const f = S.filters, count = (fn) => { const m = new Map(); list.forEach(e => fn(e).forEach(([k, l]) => { const x = m.get(k) ?? m.set(k, { l, n: 0 }).get(k); x.n++; })); return [...m].sort((a, b) => b[1].n - a[1].n).map(([k, x]) => [k, x.l]); };
  const types = count(e => [[e.type, typeLabel(e.type)]]), countries = count(e => e.countries.map(c => [c.code, c.name])).slice(0, 16), sectors = count(e => e.sectors.map(x => [x, x])).slice(0, 12), techs = count(e => e.techs.map(x => [x, x])).slice(0, 14);
  const grp = (label, g, opts) => opts.length ? `<div style="margin-top:12px">${eyebrow(label)}<div class="wrapflex" style="margin-top:6px">${opts.map(([v, l]) => chip(l, f[g].has(v), 'flt', g, v)).join('')}</div></div>` : '';
  const n = filterActive(f);
  return `<div class="row" style="margin:6px 0"><div class="grow"><input type="search" id="fq" placeholder="Filtrer : organisation, produit, CVE, pays…" value="${esc(f.query)}" aria-label="Filtrer les fiches"></div>
    <button class="chip" data-act="showFilters" aria-pressed="${S.showFilters}">Filtres${n ? ` · ${n}` : ''}</button></div>
    ${S.showFilters ? `<div class="panel">${grp('Statut', 'status', [['confirme', 'Confirmé'], ['signale', 'Signalé'], ['revendique', 'Revendiqué'], ['conteste', 'Contesté']])}${grp('Gravité', 'severity', [['critique', 'Critique'], ['elevee', 'Élevée'], ['moyenne', 'Moyenne'], ['faible', 'Faible'], ['inconnue', 'Non évaluée']])}${grp('Type', 'type', types)}${grp('Pays', 'country', countries)}${grp('Secteur', 'sector', sectors)}${grp('Technologie', 'tech', techs)}${n ? `<div style="margin-top:14px">${btn('Effacer les filtres', 'close', 'fltClear')}</div>` : ''}</div>` : ''}`;
}
function listBlock(list, limit, moreAct) {
  if (!list.length) return empty('Aucune fiche', filterActive(S.filters) ? 'Aucune fiche ne correspond à ces filtres.' : 'Aucune fiche dans cette catégorie pour le moment.');
  return `<p class="small" style="margin:8px 0">${list.length} fiche(s)</p>${list.slice(0, limit).map(card).join('')}${list.length > limit ? `<div style="text-align:center;margin:14px 0">${btn(`Afficher plus (${list.length - limit})`, null, moreAct)}</div>` : ''}`;
}
function incidentsView() {
  const s = S.snap;
  if (!s) return `<div class="wrap">${head('Incidents', 'Cyberattaques et actualités')}${noSnap()}</div>`;
  const sort = (a, b) => b.recency - a.recency;
  const inc = s.events.filter(e => e.kind === 'incident').sort(sort), act = s.events.filter(e => e.kind === 'actu').sort(sort);
  let body;
  if (S.incView === 2) {
    const marks = markersOf(s.events), sel = marks.find(m => m.code === S.mapSel);
    const list = sel ? inc.filter(e => !e.fictif && e.countries.some(c => c.code === sel.code)) : [];
    body = `<div class="panel"><canvas class="map" id="map-main" role="img" aria-label="Carte des pays mentionnés dans les incidents"></canvas>
      <p class="small" style="margin:8px 0 0">Seuls les pays explicitement cités par les sources sont placés. Touchez un point pour voir ses fiches.</p>
      <div class="maprow">${marks.map(m => chip(`${m.name} · ${m.count}`, m.code === S.mapSel, 'mapsel', null, m.code)).join('') || '<span class="small">Aucune localisation documentée.</span>'}</div></div>
      ${sel ? `${sec(sel.name, list.length)}${list.map(card).join('')}` : ''}`;
  } else {
    const list = (S.incView === 0 ? inc : act).filter(e => filterMatch(S.filters, e));
    body = filterPanel(S.incView === 0 ? inc : act) + `<div id="res">${listBlock(list, S.limit, 'more')}</div>`;
  }
  return `<div class="wrap">${head('Incidents', 'Ce qui est confirmé, signalé ou revendiqué')}${seg([`Incidents · ${inc.length}`, `Actualités · ${act.length}`, 'Carte'], S.incView, 'seg')}${body}</div>`;
}

// ───────────── Vulnérabilités ─────────────
const VFLAGS = [['kev', 'Exploitée (KEV)', e => !!e.vuln?.kev], ['patch', 'Correctif référencé', e => e.vuln?.patch === 'oui'], ['nopatch', 'Sans correctif', e => e.vuln?.patch !== 'oui'], ['watch', 'Ma veille', e => isWatched(e)], ['crit', 'Critique ou élevée', e => ['critique', 'elevee'].includes(e.severity)], ['epss', 'EPSS ≥ 50 %', e => (e.vuln?.epss ?? 0) >= .5]];
function vulnsView() {
  const s = S.snap;
  if (!s) return `<div class="wrap">${head('Vulnérabilités', 'CVE, exploitation et correctifs')}${noSnap()}</div>`;
  const all = s.events.filter(e => e.kind === 'vuln').sort((a, b) => (b.vuln?.kev?.added ?? '').localeCompare(a.vuln?.kev?.added ?? '') || b.recency - a.recency);
  const q = lower(S.vulnQuery).trim();
  const list = all.filter(e => [...S.vulnFlags].every(f => VFLAGS.find(x => x[0] === f)[2](e)) && (!q || e.hay.includes(q)));
  return `<div class="wrap">${head('Vulnérabilités', `${all.length} fiches · exploitation, gravité et correctifs`)}
    <input type="search" id="vq" placeholder="CVE, éditeur, produit…" value="${esc(S.vulnQuery)}" aria-label="Rechercher une vulnérabilité">
    <div class="wrapflex" style="margin:10px 0">${VFLAGS.map(([k, l]) => chip(l, S.vulnFlags.has(k), 'vflag', null, k)).join('')}</div>
    ${!list.length ? empty('Aucune vulnérabilité', 'Aucune fiche ne correspond à ces critères.') : `<p class="small" style="margin:8px 0">${list.length} fiche(s)</p>${list.slice(0, S.vulnLimit).map(card).join('')}${list.length > S.vulnLimit ? `<div style="text-align:center;margin:14px 0">${btn(`Afficher plus (${list.length - S.vulnLimit})`, null, 'vmore')}</div>` : ''}`}</div>`;
}

// ───────────── Recherche et assistant ─────────────
const EXAMPLES = ['Quels incidents confirmés cette semaine ?', 'Quelles vulnérabilités exploitées touchent mes logiciels surveillés ?', 'Quels incidents concernent le Maroc ?', 'Quelles alertes concernent le secteur Santé ?', 'Quelles vulnérabilités ont un correctif depuis ce mois ?', 'Qu’a confirmé Orvane depuis son premier communiqué ?'];
function searchView() {
  const s = S.snap, q = S.q;
  if (!s) return `<div class="wrap">${head('Recherche', 'Fiches indexées et assistant')}${noSnap()}</div>`;
  const t = lower(q).trim(), hits = (t.length < 2 || q === S.asked) ? [] : s.events.filter(e => e.hay.includes(t)).sort((a, b) => b.recency - a.recency).slice(0, 30);
  const a = S.answer;
  return `<div class="wrap">${head('Recherche', 'Fiches indexées et assistant')}
    <input type="search" id="sq" placeholder="Mot-clé, CVE ou question…" value="${esc(q)}" aria-label="Recherche ou question">
    ${q.trim() && q !== S.asked ? `<div style="margin-top:10px">${btn('Poser cette question à l’assistant', 'spark', 'ask', { primary: 1, block: 1 })}</div>` : ''}
    ${S.busy ? note('Interrogation des fiches indexées…') : ''}
    ${a && !S.busy ? `<div class="panel acc">${eyebrow(a.local ? 'Réponse — fiches indexées' : 'Réponse — assistant du serveur', 'var(--blue)')}<p class="small" style="margin:5px 0 8px">${esc(S.asked)}</p><p class="ans" style="font-weight:500;margin:0 0 10px">${esc(a.text)}</p>${eyebrow('Critères compris')}<p class="small dim" style="margin:3px 0 8px">${esc(a.criteria)}</p><p class="small">${a.local ? 'Réponse obtenue par filtrage des fiches, sans texte généré. Chaque référence ci-dessous ouvre la fiche et ses sources.' : 'Texte rédigé par un modèle de langage à partir des fiches citées : vérifiez les références ci-dessous.'}</p></div>${a.refs.map(card).join('')}` : ''}
    ${hits.length ? `${sec('Fiches correspondantes', hits.length)}${hits.map(card).join('')}` : (t.length >= 2 && q !== S.asked ? note(`Aucune fiche ne contient « ${q.trim()} ». Vous pouvez poser la question à l’assistant.`) : '')}
    ${!a && !S.busy && !q.trim() ? `${sec('Exemples de questions')}${EXAMPLES.map((x, i) => `<button class="panel" data-act="askEx" data-v="${i}"><span class="row">${IC.spark.replace('<svg', '<svg width="17" height="17" style="color:var(--blue);flex:none"')}<span>${esc(x)}</span></span></button>`).join('')}${note('L’assistant répond uniquement à partir des publications collectées, avec les fiches en référence et des dates explicites.')}` : ''}</div>`;
}
async function ask(text) {
  if (!text.trim() || S.busy || !S.snap) return;
  S.q = text; S.asked = text; S.busy = true; render(true);
  let a = null;
  if (S.assistantOk !== false) {
    try {
      const r = await fetch(base() + '/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: text, watch: S.watch }), signal: AbortSignal.timeout(25000) });
      if (r.ok) { const j = await r.json(); S.assistantOk = true; a = { text: j.answer || '', refs: (j.refs || []).map(x => S.snap.byId.get(x.id)).filter(Boolean), criteria: 'réponse rédigée à partir des fiches les plus proches de la question', local: false }; } else S.assistantOk = false;
    } catch { S.assistantOk = false; }
  }
  S.answer = a?.text ? a : localAnswer(text, S.snap, S.watch);
  S.busy = false; render(true);
}

