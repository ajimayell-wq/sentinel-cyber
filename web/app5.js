// ───────────── Ma veille ─────────────
function veilleView() {
  const s = S.snap, watch = S.watch, rules = S.rules;
  const sugg = s ? (() => {
    const cnt = new Map(); s.events.forEach(e => e.techs.forEach(t => cnt.set(t, (cnt.get(t) ?? 0) + 1)));
    const techs = [...cnt].sort((a, b) => b[1] - a[1]).map(x => x[0]), sectors = [...new Set(s.events.flatMap(e => e.sectors))];
    return [...techs.slice(0, 14), ...sectors.slice(0, 4)].filter(c => !watch.some(w => lower(w) === lower(c))).slice(0, 14);
  })() : [];
  const rule = (key, title, sub) => `<label class="rule"><span class="grow"><b>${esc(title)}</b><span>${esc(sub)}</span></span><input class="switch" type="checkbox" role="switch" data-rule="${key}" ${rules[key] ? 'checked' : ''} aria-label="${esc(title)}"></label>`;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const sources = s ? s.sources.map(x => {
    const ok = !x.lastError && x.lastSuccess, c = ok ? 'var(--green)' : x.lastSuccess ? 'var(--orange)' : 'var(--red)';
    return `<div class="panel"><div class="row"><i class="mark" style="background:${c};border-radius:50%"></i><b class="grow" style="font-weight:500">${esc(x.name)}</b>${eyebrow(ok ? 'Flux actif' : 'Indisponible', c)}</div>
      <p class="small" style="margin:3px 0 0 17px">${esc(kindLabel(x.kind))} · ${esc(x.org)}</p>
      <p class="small mono dim" style="margin:5px 0 0 17px">Dernière collecte réussie : ${x.lastSuccess ? esc(dateTime(x.lastSuccess)) : 'aucune'}<br>Donnée la plus récente : ${x.lastItemAt ? esc(dateTime(x.lastItemAt)) : 'date non communiquée'}</p>
      ${x.lastError ? `<p class="small" style="margin:3px 0 0 17px;color:var(--orange)">Dernière tentative (${x.lastAttempt ? esc(dateTime(x.lastAttempt)) : 'date inconnue'}) : ${esc(x.lastError)}</p>` : ''}</div>`;
  }).join('') : note('Aucun instantané synchronisé.');
  return `<div class="wrap">${head('Ma veille', 'Votre périmètre reste dans ce navigateur')}
    ${sec('Liste de surveillance', watch.length)}
    <div class="panel"><p class="note" style="margin-top:0">Logiciels, fournisseurs cloud, systèmes et secteurs. Une fiche est signalée « Ma veille » dès qu’un de ces termes y figure.</p>
      <div class="row"><div class="grow"><input type="text" id="wq" placeholder="Ajouter : Fortinet, AWS, Santé…" aria-label="Ajouter un terme à surveiller" autocomplete="off"></div>${btn('Ajouter', 'plus', 'addWatch', { primary: 1 })}</div>
      ${watch.length ? `<div class="wrapflex" style="margin-top:12px">${watch.map(w => `<span class="chip" style="background:var(--blueDeep)">${esc(w)}<button class="iconbtn" style="padding:0 0 0 2px" data-act="rmWatch" data-v="${esc(w)}" aria-label="Retirer ${esc(w)}">${IC.close.replace('<svg', '<svg width="14" height="14"')}</button></span>`).join('')}</div>` : ''}
      ${sugg.length ? `<div style="margin-top:12px">${eyebrow('Cités dans les fiches actuelles')}<div class="wrapflex" style="margin-top:7px">${sugg.map(c => chip('+ ' + c, false, 'sugg', null, c)).join('')}</div></div>` : ''}</div>
    ${sec('Alertes')}
    <div class="panel"><p class="note" style="margin-top:0">Pour les fiches de votre liste et celles que vous suivez (étoile). Les changements d’un même incident sont regroupés en une seule alerte.</p>
      ${rule('patch', 'Un correctif paraît', 'Un correctif devient référencé pour une vulnérabilité suivie.')}${rule('exploit', 'Une exploitation est confirmée', 'Inscription au catalogue CISA KEV ou passage au statut confirmé.')}${rule('scope', 'Le périmètre d’un incident change', 'Nouvelle fiche dans votre périmètre, versions, pays, secteurs ou ampleur modifiés.')}
      <div style="margin-top:10px">${perm === 'granted' ? '<p class="small" style="color:var(--green);margin:0">Notifications autorisées pendant que cette page est ouverte · vérification toutes les 5 minutes.</p>' : perm === 'unsupported' ? '<p class="small" style="margin:0">Ce navigateur ne gère pas les notifications : les alertes s’affichent dans la page.</p>' : btn('Autoriser les notifications', 'bell', 'notif', { block: 1 })}
      <p class="small" style="margin:8px 0 0">Une page web ne peut pas vous alerter lorsqu’elle est fermée. Pour des alertes téléphone verrouillé, utilisez l’application Android.</p>
      ${S.followed.length ? `<p class="small" style="margin:4px 0 0">${S.followed.length} fiche(s) suivie(s) individuellement.</p>` : ''}</div></div>
    ${S.alerts.length ? `${sec('Alertes récentes', S.alerts.length, 'Effacer', 'clearAlerts')}${S.alerts.slice(0, 10).map(a => `<a class="panel acc" style="--acc:var(--yellow)" href="#/fiche/${enc(a.id)}"><b style="font-weight:500">${esc(clean(a.title))}</b>${a.lines.map(l => `<p class="small dim" style="margin:3px 0 0">${esc(l)}</p>`).join('')}<p class="small mono" style="margin:4px 0 0">${esc(dateTime(a.at))}</p></a>`).join('')}` : ''}
    ${sec('Briefing')}
    <div class="panel"><p class="note" style="margin-top:0">Document PDF sourcé : votre périmètre, les incidents confirmés, les vulnérabilités exploitées, la date de génération et les incertitudes encore ouvertes.</p>${btn('Exporter le briefing en PDF', 'doc', 'export', { primary: 1, block: 1 })}<p class="small" style="margin:8px 0 0">La fenêtre d’impression s’ouvre : choisissez « Enregistrer au format PDF ».</p></div>
    ${sec('État des sources', s?.sources.length)}${s ? note(`Dernière collecte du serveur : ${dateTime(s.generatedAt)}. Une source en défaut reste affichée avec la date de ses dernières données.`) : ''}${sources}
    ${sec('Serveur')}
    <div class="panel"><p class="note" style="margin-top:0">Adresse de l’API ou de son miroir statique (par défaut, celle de ce site). Voir le guide d’installation du serveur.</p><input type="url" id="srv" value="${esc(S.server)}" placeholder="https://exemple.fr/api" aria-label="Adresse du serveur" autocomplete="off">
      <div style="margin-top:10px">${btn(S.syncing ? 'Synchronisation…' : 'Enregistrer et synchroniser', 'refresh', 'saveServer', { block: 1 })}</div>
      <p class="small dim" style="margin:10px 0 0">Dernière synchronisation réussie : ${S.lastSync ? esc(dateTime(S.lastSync)) : 'jamais'}${S.fromCache ? ' · copie enregistrée dans ce navigateur' : ''}</p>${S.error ? `<p class="small" style="color:var(--orange);margin:3px 0 0">Dernière tentative en échec : ${esc(S.error)}</p>` : ''}
      ${S.installEvt ? `<div style="margin-top:12px">${btn('Installer comme application', 'plus', 'install', { block: 1 })}</div>` : ''}</div>
    ${sec('Méthode')}${note('Les fiches sont construites automatiquement à partir des publications des sources listées ci-dessus. Statut, type, pays et secteurs sont déduits du texte des sources par des règles : ils peuvent être incomplets ou erronés et doivent être vérifiés dans les publications d’origine. Une information absente est indiquée comme telle, jamais devinée.')}</div>`;
}

// ───────────── Briefing imprimable ─────────────
function printBriefing() {
  const s = S.snap; if (!s) { toast('Aucune donnée à exporter.'); return; }
  const now = Date.now(), watch = S.watch, real = s.events.filter(e => !e.fictif), week = now - 7 * 86400e3;
  const mine = real.filter(e => watchMatch(e, watch) && e.recency >= now - 14 * 86400e3).sort((a, b) => priority(b, 1).score - priority(a, 1).score).slice(0, 10);
  const incidents = real.filter(e => e.kind === 'incident' && e.status === 'confirme' && e.recency >= week && !mine.includes(e)).sort((a, b) => b.recency - a.recency).slice(0, 10);
  const vulns = real.filter(e => e.vuln?.kev && !mine.includes(e)).sort((a, b) => (b.vuln.kev.added ?? '').localeCompare(a.vuln.kev.added ?? '')).slice(0, 10);
  const entry = e => {
    const urls = [...new Set([...e.last.claims.map(c => c.url), ...e.pubs.map(p => p.url)].map(safeUrl).filter(Boolean))].slice(0, 3);
    const v = e.vuln;
    return `<div class="e"><b>${esc(e.title)}</b><div>${esc(typeLabel(e.type))} · Statut : ${esc(statusLabel(e.status, true))}. ${esc(e.statusReason ?? '')}</div>
      <div>Incident : ${e.incidentDate ? esc(day(e.incidentDate)) : 'date non communiquée'} · Divulgation : ${e.disclosedAt ? esc(day(e.disclosedAt)) : 'date non communiquée'} · Dernière mise à jour : ${esc(dateTime(e.updatedAt))} (version ${e.last.n})</div>
      ${v ? `<div>${esc(v.cve)} · CVSS ${v.cvss ?? 'non publié'} · EPSS ${v.epss != null ? pct(v.epss) : 'non disponible'} · KEV : ${v.kev?.added ? 'inscrite le ' + esc(v.kev.added) : 'non inscrite'} · Correctif : ${v.patch === 'oui' ? 'référencé' : 'non documenté'}</div><div>${esc(priority(e, watchMatch(e, watch)).sentence)}</div>` : ''}
      ${urls.length ? `<div class="g">Sources : ${urls.map(u => `<a href="${esc(u)}">${esc(u)}</a>`).join(' · ')}</div>` : ''}</div>`;
  };
  const open = [];
  for (const e of [...mine, ...incidents, ...vulns]) {
    const u = [];
    if (e.kind === 'incident' && !e.incidentDate) u.push('date de l’incident non communiquée');
    if (e.status !== 'confirme') u.push(`statut : ${statusLabel(e.status, true).toLowerCase()}`);
    if (e.vuln && e.vuln.patch !== 'oui') u.push('correctif non documenté');
    if (e.vuln && !e.vuln.versions.length) u.push('versions touchées non précisées');
    contradictions(e.last.claims).forEach(([t]) => u.push(`sources en désaccord sur ${topicLabel(t)}`));
    if (e.actor) u.push(`attribution à ${e.actor.name} : ${e.actor.confidence}`);
    if (u.length) open.push(`<div>• ${esc(e.title)} — ${esc(u.join(' ; '))}.</div>`);
  }
  const down = s.sources.filter(x => x.lastError), okSrc = s.sources.filter(x => !x.lastError && x.lastSuccess).length;
  $('#print').innerHTML = `<h1>SENTINEL CYBER</h1><div><b>Briefing de veille généré le ${esc(dateTime(now))}</b></div>
    <div class="g">Données collectées le ${esc(dateTime(s.generatedAt))} · ${okSrc} sources joignables sur ${s.sources.length}. Classement automatique à partir des publications : à vérifier dans les sources citées.</div>
    <div class="g">Périmètre surveillé : ${watch.length ? esc(watch.join(', ')) : 'aucun élément enregistré'}</div>
    <h2>1. Votre périmètre (14 derniers jours)</h2>${mine.length ? mine.map(entry).join('') : `<div>${watch.length ? 'Aucune fiche récente ne correspond à votre liste de surveillance.' : 'Liste de surveillance vide.'}</div>`}
    <h2>2. Incidents confirmés (7 derniers jours)</h2>${incidents.length ? incidents.map(entry).join('') : '<div>Aucun incident confirmé dans les publications collectées.</div>'}
    <h2>3. Vulnérabilités activement exploitées (dernières inscriptions KEV)</h2>${vulns.length ? vulns.map(entry).join('') : '<div>Aucune inscription récente.</div>'}
    <h2>4. Incertitudes encore ouvertes</h2>${open.join('') || '<div>Aucune incertitude relevée sur les fiches de ce briefing.</div>'}
    ${down.length ? `<h2>5. Sources indisponibles lors de la dernière collecte</h2>${down.map(x => `<div>• ${esc(x.name)} — dernières données reçues : ${x.lastSuccess ? esc(dateTime(x.lastSuccess)) : 'jamais'}.</div>`).join('')}` : ''}`;
  const prev = document.title; document.title = `sentinel-briefing-${new Date().toISOString().slice(0, 10)}`;
  window.print(); setTimeout(() => { document.title = prev; }, 1500);
}

// ───────────── Navigation et rendu ─────────────
const TABS = [['accueil', 'Accueil'], ['incidents', 'Incidents'], ['vulns', 'Vulnérabilités'], ['recherche', 'Recherche'], ['veille', 'Ma veille']];
const route = () => location.hash.replace(/^#\/?/, '').split('/').map(x => { try { return decodeURIComponent(x); } catch { return x; } });
let lastKey = null;
function render(keep) {
  const r = route(), main = $('#main'), y = window.scrollY;
  const a = document.activeElement, focus = a && a.id && ['INPUT', 'TEXTAREA'].includes(a.tagName) ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
  let html, tab = S.tab;
  if (r[0] === 'fiche') html = detailView(r[1]);
  else if (r[0] === 'comparer') html = compareView(r[1], +r[2], +r[3]);
  else { tab = TABS.some(t => t[0] === r[0]) ? r[0] : 'accueil'; S.tab = tab; html = { accueil: homeView, incidents: incidentsView, vulns: vulnsView, recherche: searchView, veille: veilleView }[tab](); }
  main.innerHTML = html;
  $('#nav').innerHTML = `<div class="brand"><i></i>SENTINEL <b>CYBER</b></div>` + TABS.map(([k, l]) => `<button data-act="tab" data-v="${k}" ${k === tab ? 'aria-current="page"' : ''}>${IC[k]}<span>${l}</span></button>`).join('');
  const key = r.slice(0, 2).join('/');
  if (keep && key === lastKey) window.scrollTo(0, y); else window.scrollTo(0, 0);
  lastKey = key;
  const home = $('#map-home'); if (home) drawMap(home, markersOf(S.snap.events.filter(e => !e.fictif)), null, null);
  const mp = $('#map-main'); if (mp) drawMap(mp, markersOf(S.snap.events), S.mapSel, c => { S.mapSel = c; render(true); });
  if (!home && !mp) cancelAnimationFrame(mapRaf);
  if (focus) { const el = document.getElementById(focus.id); if (el) { el.focus(); try { el.setSelectionRange(focus.s, focus.e); } catch { /* type sans sélection */ } } }
  document.title = (r[0] === 'fiche' && S.snap?.byId.get(r[1]) ? clean(S.snap.byId.get(r[1]).title) + ' — ' : '') + 'SENTINEL CYBER';
}
const softRender = () => render(true);
function go(h) { if (location.hash === h) render(true); else location.hash = h; }
function focusWin() { try { window.focus(); } catch { /* ignoré */ } }

window.addEventListener('hashchange', () => { S.navCount++; render(false); });
document.addEventListener('click', async ev => {
  const t = ev.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act, v = t.dataset.v, g = t.dataset.g;
  switch (act) {
    case 'tab': go('#/' + (v === 'accueil' ? '' : v)); break;
    case 'back': if (S.navCount > 0) history.back(); else go('#/' + (S.tab === 'accueil' ? '' : S.tab)); break;
    case 'refresh': sync(true); break;
    case 'follow': { const i = S.followed.indexOf(v); if (i >= 0) S.followed.splice(i, 1); else S.followed.push(v); LS.set('followed', S.followed); render(true); break; }
    case 'mode': { const id = route()[1]; S.mode[id] = +v; render(true); break; }
    case 'shownew': S.showNew[v] = !S.showNew[v]; render(true); break;
    case 'seg': S.incView = +v; S.limit = 40; render(); break;
    case 'flt': { const set = S.filters[g]; set.has(v) ? set.delete(v) : set.add(v); S.limit = 40; render(true); break; }
    case 'fltClear': S.filters = newFilters(); render(true); break;
    case 'showFilters': S.showFilters = !S.showFilters; render(true); break;
    case 'more': S.limit += 40; render(true); break;
    case 'vflag': S.vulnFlags.has(v) ? S.vulnFlags.delete(v) : S.vulnFlags.add(v); S.vulnLimit = 40; render(true); break;
    case 'vmore': S.vulnLimit += 40; render(true); break;
    case 'mapsel': S.mapSel = S.mapSel === v ? null : v; render(true); break;
    case 'goStat':
      if (v === 'conf') { S.incView = 0; S.filters = newFilters(); S.filters.status.add('confirme'); S.showFilters = true; go('#/incidents'); }
      else if (v === 'ma') { S.incView = 0; S.filters = newFilters(); S.filters.country.add('MA'); S.showFilters = true; go('#/incidents'); }
      else if (v === 'kev') { S.vulnFlags = new Set(['kev']); go('#/vulns'); }
      else if (v === 'map') { S.incView = 2; go('#/incidents'); }
      else go('#/veille');
      break;
    case 'ask': ask(S.q); break;
    case 'askEx': { const q = EXAMPLES[+v]; S.q = q; ask(q); break; }
    case 'addWatch': { const el = $('#wq'), w = el.value.trim(); if (w && !S.watch.some(x => lower(x) === lower(w))) { S.watch.push(w); saveWatch(); } render(true); break; }
    case 'sugg': if (!S.watch.some(x => lower(x) === lower(v))) { S.watch.push(v); saveWatch(); } render(true); break;
    case 'rmWatch': S.watch = S.watch.filter(x => x !== v); saveWatch(); render(true); break;
    case 'notif': askNotifications(); break;
    case 'clearAlerts': S.alerts = []; LS.set('alerts', []); render(true); break;
    case 'export': printBriefing(); break;
    case 'saveServer': { const val = ($('#srv').value || '').trim().replace(/\/+$/, ''); S.server = val || DEFAULT_SERVER; LS.set('server', S.server); S.assistantOk = null; sync(true); break; }
    case 'install': if (S.installEvt) { S.installEvt.prompt(); S.installEvt = null; render(true); } break;
    case 'ver': { const r = route(), id = r[1]; let a = +r[2], b = +r[3]; if (g === 'a') a = +v; else b = +v; history.replaceState(null, '', `#/comparer/${enc(id)}/${a}/${b}`); render(true); break; }
  }
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.id === 'fq') { S.filters.query = t.value; S.limit = 40; render(true); }
  else if (t.id === 'vq') { S.vulnQuery = t.value; S.vulnLimit = 40; render(true); }
  else if (t.id === 'sq') { S.q = t.value; if (S.asked && t.value !== S.asked) S.answer = null; render(true); }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.dataset?.rule) { S.rules = { ...S.rules, [t.dataset.rule]: t.checked }; LS.set('rules', S.rules); if (t.checked && 'Notification' in window && Notification.permission === 'default') askNotifications(); }
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Enter') return;
  if (ev.target.id === 'sq') { ev.preventDefault(); ask(ev.target.value); }
  else if (ev.target.id === 'wq') { ev.preventDefault(); $('[data-act=addWatch]').click(); }
  else if (ev.target.id === 'srv') { ev.preventDefault(); $('[data-act=saveServer]').click(); }
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; if (S.tab === 'veille') render(true); });

// ───────────── Démarrage ─────────────
(async function boot() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  render();
  const cached = await idb.get('snapshot');
  if (cached) { try { S.snap = parseSnapshot(cached); S.fromCache = true; } catch { /* copie illisible */ } }
  S.loading = !S.snap; render(true);
  await sync();
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - (S.lastSync ?? 0) > 2 * 60 * 1000) sync(); });
})();
