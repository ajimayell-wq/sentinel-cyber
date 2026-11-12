// ───────────── Fiche détaillée ─────────────
function changeRow(c, fictif) {
  const [sym, col, word] = c.op === 'add' ? ['+', 'var(--green)', 'Ajout'] : c.op === 'del' ? ['−', 'var(--red)', 'Retrait'] : ['~', 'var(--yellow)', 'Correction'];
  const stl = c.op === 'mod' && c.stBefore && c.stAfter && c.stBefore !== c.stAfter ? `<div class="small" style="color:${statusColor(c.stAfter)};margin-top:3px">Statut : ${esc(statusLabel(c.stBefore))} → ${esc(statusLabel(c.stAfter))}</div>` : '';
  return `<div class="chg"><div class="sym" style="--c:${col}" aria-hidden="true">${sym}</div><div class="grow">${eyebrow(`${word} · ${c.label}`, col)}${c.before != null ? `<del>${esc(c.before)}</del>` : ''}${c.after != null ? `<ins>${esc(c.after)}</ins>` : ''}${stl}${c.basis && c.op !== 'del' ? `<div class="small dim" style="margin-top:3px">Étayé par : ${esc(c.basis)}</div>` : ''}${lnk(`Source : ${c.src}`, c.url, fictif)}</div></div>`;
}
function detailView(id) {
  const s = S.snap, e = s?.byId.get(id);
  if (!e) return `<div class="wrap">${topbar('Fiche')}${s ? empty('Fiche introuvable', 'Cette fiche ne figure plus dans l’instantané synchronisé.') : noSnap()}</div>`;
  if (S.prevFor !== id) { S.prevFor = id; S.prev = S.seen[id] ?? null; }
  if (S.seen[id] !== e.last.n) { S.seen[id] = e.last.n; LS.set('seen', S.seen); }
  const watched = isWatched(e), followed = S.followed.includes(id), mode = S.mode[id] ?? 0, claims = e.last.claims, conf = contradictions(claims), fic = e.fictif;
  const star = `<button class="iconbtn" data-act="follow" data-v="${esc(id)}" aria-pressed="${followed}" aria-label="${followed ? 'Ne plus suivre cette fiche' : 'Suivre cette fiche'}" style="color:${followed ? 'var(--yellow)' : 'var(--faint)'}">${followed ? IC.star.replace('fill="none"', 'fill="currentColor"') : IC.star}</button>`;
  const news = whatsNew(e, S.prev), pending = news.since && news.changes.length > 0, showNew = !!S.showNew[id];

  const header = `${fic ? `<div>${pill('FICTIF', 'var(--violet)', 1)}<p class="small" style="color:var(--violet);margin:6px 0 10px">Organisations, groupe, chiffres et liens de cette fiche sont inventés.</p></div>` : ''}
    <h1 style="font-size:22px;line-height:1.3;margin:6px 0 12px;font-weight:600">${esc(clean(e.title))}</h1>
    <div class="wrapflex" style="align-items:center">${stChip(e.status, true)}${e.kind !== 'actu' ? `<span>${sevMeter(e.severity)}</span>` : ''}${watched ? pill('Ma veille', 'var(--blue)', 1) : ''}${followed ? pill('Suivi', 'var(--yellow)', 1) : ''}</div>
    ${e.statusReason ? `<p class="note">${esc(e.statusReason)}</p>` : ''}${e.kind !== 'actu' && e.severityReason ? `<p class="note" style="margin-top:0">Gravité : ${esc(e.severityReason)}</p>` : ''}${readBtn(e)}`;

  let newBody = '';
  if (showNew) {
    if (!news.since) newBody = note(`C’est votre première consultation de cette fiche, qui compte ${e.versions.length} version(s). Les changements publiés après cette visite seront résumés ici.`);
    else if (!news.changes.length) newBody = note(`Rien de nouveau : vous aviez déjà consulté la version ${news.since.n}, du ${dateTime(news.since.at)}.`);
    else newBody = `${note(`Depuis la version ${news.since.n} du ${dateTime(news.since.at)}, que vous aviez consultée :`)}${news.changes.map(c => changeRow(c, fic)).join('')}<div style="margin-top:8px"><a class="btn block" href="#/comparer/${enc(id)}/${news.since.n}/${e.last.n}">${IC.compare}Comparer v${news.since.n} et v${e.last.n}</a></div>`;
  }
  const evo = `<div class="panel acc" style="--acc:${pending ? 'var(--yellow)' : 'var(--blue)'}"><div class="between">${eyebrow('Dernière évolution')}<span class="small mono">v${e.last.n} · ${esc(ago(e.last.at))}</span></div>
    <p style="font-weight:500;margin:6px 0 2px">${esc(e.last.note)}</p><p class="small" style="margin:0 0 12px">${esc(dateTime(e.last.at))}</p>
    ${btn(pending ? `Quoi de neuf depuis ma dernière visite ? · ${news.changes.length}` : 'Quoi de neuf depuis ma dernière visite ?', 'spark', 'shownew', { primary: pending, block: 1, v: id })}${newBody}</div>`;

  const cells = e.kind === 'vuln' ? [['Publication CVE', e.disclosedAt && day(e.disclosedAt), 'Non communiquée'], ['Inscription KEV', e.vuln?.kev?.added, 'Non inscrite'], ['Mise à jour', shortDate(e.updatedAt)]]
    : e.kind === 'incident' ? [['Date de l’incident', e.incidentDate && day(e.incidentDate), 'Non communiquée'], ['Divulgation', e.disclosedAt && day(e.disclosedAt), 'Non communiquée'], ['Mise à jour', shortDate(e.updatedAt)]]
      : [['Publication', e.disclosedAt && day(e.disclosedAt), 'Non communiquée'], ['Première collecte', day(e.firstSeenAt)], ['Mise à jour', shortDate(e.updatedAt)]];
  const dates = `<div class="dates">${cells.map(([l, v, m]) => `<div>${eyebrow(l)}<b class="${v ? '' : 'miss'}">${esc(v || m || '')}</b></div>`).join('')}</div>`;

  let content;
  if (mode === 0) {
    content = thirtySeconds(e, watched).map(qa => `<div class="panel qa">${eyebrow(qa.q, 'var(--blue)')}<div style="margin-top:7px">${qa.lines.map(l => `<p>${esc(l)}</p>`).join('')}${qa.note ? `<p class="small">${esc(qa.note)}</p>` : ''}</div></div>`).join('') +
      (conf.length ? note(`Les sources de cette fiche se contredisent sur ${joinFr(conf.map(c => topicLabel(c[0])))} : voir l’analyse technique.`) : '');
  } else {
    const parts = [];
    if (e.vuln) parts.push(vulnBlock(e, e.vuln, watched));
    conf.forEach(([topic, g]) => parts.push(`<div class="panel acc" style="--acc:var(--orange)">${eyebrow('Sources en désaccord', 'var(--orange)')}<p style="font-size:16px;font-weight:600;margin:4px 0 10px">Les sources divergent sur ${esc(topicLabel(topic))}</p><div class="scroll">${g.map(c => `<div class="conf" style="--c:${statusColor(c.st)}"><div class="small" style="color:var(--blue);font-weight:500">${esc(c.src)}</div><p style="font-size:15px;font-weight:500;margin:8px 0">${esc(c.v)}</p>${stChip(c.st)}<div style="margin-top:10px">${eyebrow('Ce qui l’étaye')}<p class="small dim" style="margin:3px 0 0">${esc(c.basis ?? 'Élément à l’appui non précisé par la source.')}</p></div>${lnk('Ouvrir la source', c.url, fic)}</div>`).join('')}</div></div>`));
    if (e.actor) parts.push(`<div class="panel acc" style="--acc:var(--violet)">${eyebrow('Attribution — évaluée séparément du statut', 'var(--violet)')}<p style="font-size:16px;font-weight:600;margin:5px 0 3px">${esc(e.actor.name)}</p><p style="margin:0">Niveau de confiance : ${esc(e.actor.confidence)}.</p><p class="small" style="margin:3px 0 0">La mention d’un groupe par une source ne vaut pas attribution établie.</p>${lnk(`Source : ${e.actor.source}`, e.actor.url, fic)}</div>`);
    const facts = claims.filter(c => !c.k.startsWith('pub:'));
    parts.push(sec('Ce que disent les sources', facts.length));
    parts.push(facts.length ? `<div class="panel">${facts.map(c => `<div class="claim"><i class="mark m-${esc(c.st)}"></i><div class="grow">${eyebrow(c.label)}<p>${esc(c.v)}</p>${lnk(`${statusLabel(c.st, true)} · ${c.src}`, c.url, fic)}</div></div>`).join('')}</div>` : note('Aucun fait structuré n’a pu être extrait : consultez les publications d’origine ci-dessous.'));
    parts.push(`<div class="sec"><h3>Chronologie de la fiche</h3><span class="n">${e.versions.length}</span>${e.versions.length > 1 ? `<a href="#/comparer/${enc(id)}/${e.versions.at(-2).n}/${e.last.n}" style="font-size:13px">Comparer</a>` : ''}</div>`);
    parts.push(`<div class="tl">${[...e.versions].reverse().map((v, i) => { const before = [...e.versions].reverse().find(x => x.n < v.n); return `<div class="v${i === 0 ? ' last' : ''}"><span class="mono small"><b style="color:${i === 0 ? 'var(--blue)' : 'var(--dim)'};font-weight:500">v${v.n}</b> · ${esc(dateTime(v.at))}</span><p style="margin:3px 0">${esc(v.note)}</p>${before ? `<a href="#/comparer/${enc(id)}/${before.n}/${v.n}" class="lnk" style="font-size:12.5px;font-weight:500">Voir ce qui a changé depuis v${before.n}</a>` : ''}</div>`; }).join('')}</div>`);
    parts.push(sec('Techniques MITRE ATT&CK', e.attack.length));
    parts.push(e.attack.length ? e.attack.map(tid => attackCard(tid, s.attack[tid])).join('') : note('Aucune technique ATT&CK n’est citée par les sources de cette fiche.'));
    if (e.defense.length) parts.push(sec('Mesures défensives à vérifier', e.defense.length) + `<div class="panel">${e.defense.map((d, i) => `<div class="row" style="align-items:flex-start;padding:5px 0"><span class="mono" style="color:var(--blue);width:22px;font-size:12px;flex:none;padding-top:3px">${i + 1}</span><span>${esc(d)}</span></div>`).join('')}</div>`);
    parts.push(sec('Publications d’origine', e.pubs.length), pubList(e));
    content = parts.join('');
  }
  return `<div class="wrap">${topbar(e.kind === 'vuln' ? e.id : typeLabel(e.type), star)}${header}${evo}${dates}${seg(['En 30 secondes', 'Analyse technique'], mode, 'mode')}${content}</div>`;
}
function vulnBlock(e, v, watched) {
  const m = (l, val, sub, c) => `<div class="metric">${eyebrow(l)}<b style="--c:${c}">${esc(val)}</b><span>${esc(sub)}</span></div>`;
  return `<div class="panel"><div class="metrics">
    ${m(`CVSS ${v.cvssVersion ?? ''}`.trim(), v.cvss != null ? String(v.cvss) : '—', v.cvssSev ? `${v.cvssSev.toLowerCase()} · ${v.cvssSource === 'nvd@nist.gov' ? 'NVD' : v.cvssSource ?? ''}` : 'Score non publié', sevColor(e.severity))}
    ${m('EPSS', v.epss != null ? pct(v.epss) : '—', v.epssPct != null ? `${Math.floor(v.epssPct * 100)}ᵉ centile · ${v.epssDate ?? ''}` : 'Score non disponible', 'var(--blue)')}
    ${m('CISA KEV', v.kev ? 'Inscrite' : 'Absente', v.kev ? `depuis le ${v.kev.added ?? 'date non communiquée'}` : 'Pas d’exploitation documentée par la CISA', v.kev ? 'var(--orange)' : 'var(--faint)')}
    ${m('Correctif', v.patch === 'oui' ? 'Référencé' : 'Non documenté', v.patch === 'oui' ? 'Référence « Patch » dans NVD' : 'Aucune référence de correctif dans NVD', v.patch === 'oui' ? 'var(--green)' : 'var(--faint)')}</div>
    <div style="margin-top:12px">${eyebrow('Versions touchées')}${v.versions.length ? v.versions.map(x => `<div class="mono" style="font-size:12.5px">${esc(x)}</div>`).join('') : '<p class="small" style="margin:4px 0 0">Non précisées par NVD à ce jour.</p>'}</div>
    ${v.kev ? `<div style="margin-top:10px">${eyebrow('Rançongiciels')}<p style="margin:3px 0 0">${v.kev.ransomware === 'Known' ? 'Usage connu dans des campagnes de rançongiciel (CISA).' : 'Pas d’usage connu par des rançongiciels à ce jour (CISA).'}</p>${v.kev.due ? `<p class="small" style="margin:2px 0 0">Échéance fixée aux agences fédérales américaines : ${esc(v.kev.due)}.</p>` : ''}</div>` : ''}
    <div class="prio">${eyebrow('Priorité défensive', 'var(--blue)')}<p>${esc(priority(e, watched).sentence)}</p></div>
    ${v.patchUrl ? `<div style="margin-top:10px">${lnk(v.patch === 'oui' ? 'Ouvrir la référence du correctif' : 'Ouvrir l’avis de l’éditeur', v.patchUrl, e.fictif)}</div>` : ''}</div>`;
}
function attackCard(id, t) {
  const url = safeUrl(t?.url) ?? `https://attack.mitre.org/techniques/${id.replace('.', '/')}/`;
  if (!t) return `<a class="panel" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><div class="row">${pill(id, 'var(--blue)', 1)}<b>Technique citée par les sources</b></div><p class="small" style="margin:6px 0 0">Fiche technique non embarquée : consultez MITRE ATT&amp;CK.</p></a>`;
  return `<a class="panel" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><div class="row">${pill(id, 'var(--blue)', 1)}<b class="grow">${esc(t.name ?? id)}</b></div><p class="small" style="margin:4px 0 6px">${esc(t.tactic ?? '')}</p>${[['Détection', t.detect], ['Durcissement', t.harden], ['Remédiation', t.remediate]].map(([k, v]) => `<div style="margin-top:6px">${eyebrow(k, 'var(--dim)')}<p style="margin:2px 0 0;font-size:14px">${esc(v ?? '')}</p></div>`).join('')}</a>`;
}
function pubList(e) {
  if (!e.pubs.length) return note('Aucune publication rattachée : cette fiche provient uniquement des bases NVD, CISA KEV et EPSS.');
  const byId = new Map(e.pubs.map(p => [p.id, p])), origins = new Map();
  e.pubs.forEach(p => { if (p.derivedFrom != null) origins.set(p.derivedFrom, (origins.get(p.derivedFrom) ?? 0) + 1); });
  const warn = [...origins].map(([o, n]) => byId.get(o) ? `<p class="small yellow">${n} publication(s) de cette fiche reprennent une même source initiale : ${esc(byId.get(o).src)}. Elles ne constituent pas une confirmation indépendante.</p>` : '').join('');
  return warn + e.pubs.map(p => {
    const u = safeUrl(p.url), d = collectDelay(p), o = p.derivedFrom != null ? byId.get(p.derivedFrom) : null;
    const inner = `<div class="row">${eyebrow(p.src, 'var(--blue)')}<span class="grow"></span>${eyebrow(kindLabel(p.kind))}</div><div style="font-weight:500;margin-top:5px">${esc(p.title)}</div>${o ? `<div class="small yellow" style="margin-top:4px">↳ Reprend : ${esc(o.src)}</div>` : ''}<div class="small" style="margin-top:5px">${p.publishedAt ? `Publié le ${esc(dateTime(p.publishedAt))}` : 'Date de publication non communiquée par la source'}${d ? ` · dans l’application ${esc(d)} après` : ` · collecté le ${esc(dateTime(p.collectedAt))}`}</div>${e.fictif ? '<div class="small" style="color:var(--violet)">Lien fictif, non ouvrable.</div>' : ''}`;
    return u && !e.fictif ? `<a class="panel" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<div class="panel">${inner}</div>`;
  }).join('');
}

// ───────────── Comparaison de versions ─────────────
function compareView(id, a0, b0) {
  const e = S.snap?.byId.get(id);
  if (!e) return `<div class="wrap">${topbar('Comparer')}${empty('Fiche introuvable', '')}</div>`;
  const va = e.versions.find(v => v.n === a0) ?? e.versions[0], vb = e.versions.find(v => v.n === b0) ?? e.last;
  const ch = diff(va.claims, vb.claims), kept = vb.claims.length - ch.filter(c => c.op !== 'del').length;
  const picker = (label, which, sel) => `<div style="margin:10px 0">${eyebrow(label)}<div class="scroll" style="margin-top:6px">${e.versions.map(v => chip(`v${v.n} · ${shortDate(v.at)}`, v.n === sel, 'ver', which, v.n)).join('')}</div></div>`;
  const order = { mod: 0, add: 1, del: 2 };
  return `<div class="wrap">${topbar('Comparer les versions')}${e.fictif ? pill('FICTIF', 'var(--violet)', 1) : ''}<h1 style="font-size:18px;margin:8px 0;font-weight:600">${esc(clean(e.title))}</h1>
    ${picker('Version de départ', 'a', va.n)}${picker('Version d’arrivée', 'b', vb.n)}
    <div class="panel acc"><div class="mono" style="font-size:19px">v${va.n} → v${vb.n}</div><div class="small mono" style="margin:3px 0 10px">${esc(dateTime(va.at))} → ${esc(dateTime(vb.at))}</div>
      <div class="wrapflex">${pill(`+ ${ch.filter(c => c.op === 'add').length} ajout(s)`, 'var(--green)', 1)}${pill(`~ ${ch.filter(c => c.op === 'mod').length} correction(s)`, 'var(--yellow)', 1)}${pill(`− ${ch.filter(c => c.op === 'del').length} retrait(s)`, 'var(--red)', 1)}${pill(`${kept} inchangé(s)`, 'var(--dim)')}</div></div>
    ${va.n === vb.n ? note('Choisissez deux versions différentes pour voir ce qui a changé.') : !ch.length ? note('Aucune différence entre ces deux versions.') : `<div class="panel">${[...ch].sort((x, y) => order[x.op] - order[y.op]).map(c => changeRow(c, e.fictif)).join('')}</div>`}
    ${e.fictif && ch.some(c => c.k === 'sauvegardes') && e.defense.length ? `${sec('Vérifications défensives associées')}<div class="panel">${e.defense.slice(0, 3).map(d => `<p style="margin:4px 0">• ${esc(d)}</p>`).join('')}</div>` : ''}</div>`;
}


// ───────────── Lire l'article ─────────────
const PUB_RANK = { officiel: 4, editeur: 3, recherche: 2, donnees: 1 };
function mainPub(e) {
  const ok = e.pubs.filter(p => safeUrl(p.url));
  const orig = ok.filter(p => p.derivedFrom == null);
  return (orig.length ? orig : ok).sort((a, b) => (PUB_RANK[b.kind] ?? 0) - (PUB_RANK[a.kind] ?? 0) || (a.publishedAt ?? a.collectedAt) - (b.publishedAt ?? b.collectedAt))[0] ?? null;
}
function mainUrl(e) {
  if (e.fictif) return null;
  const p = mainPub(e);
  return p ? safeUrl(p.url) : e.kind === 'vuln' ? `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(e.id)}` : null;
}
function readBtn(e) {
  const url = mainUrl(e); if (!url) return '';
  const p = mainPub(e), others = e.pubs.length - (p ? 1 : 0);
  return `<a class="btn primary block" style="margin:4px 0 6px" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${IC.doc}${esc(p ? `Lire l’article · ${p.src}` : 'Lire la fiche NVD')} ↗</a>${others > 0 ? `<button class="small lnk" data-act="mode" data-v="1" style="background:none;border:0;color:var(--blue);padding:2px 0 10px">${others} autre${others > 1 ? 's' : ''} source${others > 1 ? 's' : ''} dans l’analyse technique ›</button>` : ''}`;
}

// ───────────── Briefing ─────────────
const BRIEF_P = [[24, '24 h'], [72, '72 h'], [168, '7 jours']];
function briefData(hours) {
  const s = S.snap, since = Date.now() - hours * 3600e3, sinceDay = new Date(since).toISOString().slice(0, 10);
  const real = s.events.filter(e => !e.fictif), rec = (a, b) => b.recency - a.recency;
  const out = [
    ['Failles activement exploitées (ajouts KEV)', real.filter(e => (e.vuln?.kev?.added ?? '') >= sinceDay).sort((a, b) => (b.vuln.cvss ?? 0) - (a.vuln.cvss ?? 0))],
    ['Incidents confirmés', real.filter(e => e.kind === 'incident' && e.status === 'confirme' && e.recency >= since).sort(rec)],
    ['Revendications (non vérifiées)', real.filter(e => e.kind === 'incident' && e.status === 'revendique' && e.recency >= since).sort(rec)],
    ['Maroc', real.filter(e => e.countries.some(c => c.code === 'MA') && e.recency >= since).sort(rec)],
  ];
  if (S.watch.length) out.push(['Ma veille', real.filter(e => watchMatch(e, S.watch) && e.recency >= since).sort(rec)]);
  out.push(['Fiches qui ont évolué', real.filter(e => e.versions.length > 1 && e.updatedAt >= since).sort((a, b) => b.updatedAt - a.updatedAt)]);
  return out;
}
const briefLine = e => {
  const v = e.vuln;
  const extra = v ? [v.cvss != null ? `CVSS ${v.cvss}` : '', v.kev?.ransomware === 'Known' ? 'utilisée par des rançongiciels' : '', v.patch === 'oui' ? 'correctif disponible' : ''].filter(Boolean).join(' · ')
    : [statusLabel(e.status), e.countries.map(c => c.name).slice(0, 3).join(', '), mainPub(e)?.src ?? ''].filter(Boolean).join(' · ');
  return { title: v ? `${v.cve} — ${clean(e.title)}` : clean(e.title), extra };
};
function briefText(hours) {
  const s = S.snap, label = BRIEF_P.find(p => p[0] === hours)[1];
  const parts = [`SENTINEL CYBER — Briefing des dernières ${label}`, `Données collectées le ${dateTime(s.generatedAt)}`, ''];
  for (const [t, list] of briefData(hours)) {
    if (!list.length) continue;
    parts.push(`■ ${t} (${list.length})`);
    for (const e of list.slice(0, 10)) { const l = briefLine(e), u = mainUrl(e); parts.push(`• ${l.title}${l.extra ? ` (${l.extra})` : ''}`); if (u) parts.push(`  ${u}`); }
    if (list.length > 10) parts.push(`  … et ${list.length - 10} autre(s)`);
    parts.push('');
  }
  parts.push('Statuts établis à partir des sources publiques : à vérifier dans les publications d’origine.');
  return parts.join('\n');
}
function briefingView() {
  const s = S.snap;
  if (!s) return `<div class="wrap">${topbar('Briefing')}${noSnap()}</div>`;
  const h = S.briefH ?? 24, data = briefData(h), label = BRIEF_P.find(p => p[0] === h)[1];
  const n = t => data.find(d => d[0].startsWith(t))?.[1].length ?? 0;
  const total = data.reduce((a, d) => a + d[1].length, 0);
  const summary = `${n('Failles')} faille(s) exploitée(s) ajoutée(s) au catalogue KEV, ${n('Incidents')} incident(s) confirmé(s), ${n('Revendications')} revendication(s) et ${n('Maroc')} fiche(s) sur le Maroc ces dernières ${label}.`;
  return `<div class="wrap">${topbar('Briefing')}
    <p class="small" style="margin:2px 0 10px">Données collectées le ${esc(dateTime(s.generatedAt))}</p>
    ${seg(BRIEF_P.map(p => p[1]), BRIEF_P.findIndex(p => p[0] === h), 'bperiod')}
    <div class="panel acc" style="--acc:var(--blue)">${eyebrow('En bref', 'var(--blue)')}<p style="margin:6px 0 12px">${esc(summary)}</p>
      <div class="wrapflex">${btn('Copier le briefing', 'doc', 'bcopy', { primary: 1 })}${navigator.share ? btn('Partager', 'link', 'bshare') : ''}</div></div>
    ${total ? data.map(([t, list]) => list.length ? `${sec(t, list.length)}${list.slice(0, 8).map(card).join('')}${list.length > 8 ? note(`… et ${list.length - 8} autre(s), incluses dans le texte copié.`) : ''}` : '').join('') : note(`Rien de nouveau dans les publications collectées ces dernières ${label}.`)}
  </div>`;
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignoré */ } a.remove(); return ok;
  }
}
