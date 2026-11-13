'use strict';
/* SENTINEL CYBER — version web. Lit api/snapshot.json (même format que l'application Android) ; aucune dépendance, aucune compilation. */

// ───────────── Outils ─────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
const enc = encodeURIComponent;
const LS = {
  get(k, d) { try { const v = localStorage.getItem('sc.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sc.' + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
};
const lower = s => String(s ?? '').toLowerCase();
const ms = v => { if (!v) return null; const t = Date.parse(v); return Number.isNaN(t) ? null : t; };

// ───────────── Libellés ─────────────
const TYPES = { rancongiciel: 'Rançongiciel', fuite: 'Fuite de données', phishing: 'Hameçonnage', infra: 'Infrastructure critique', cloud: 'Cloud', panne: 'Panne de service', incident: 'Cyberattaque', vuln_exploitee: 'Vulnérabilité exploitée', vuln: 'Vulnérabilité', maj: 'Mise à jour de sécurité', norme: 'Normes et pratiques', recherche: 'Recherche' };
const typeLabel = t => TYPES[t] ?? 'Actualité';
const statusLabel = (s, long) => ({ confirme: 'Confirmé', revendique: 'Revendiqué', conteste: 'Contesté' }[s] ?? (long ? 'Signalé par une source' : 'Signalé'));
const SEV = { critique: ['Critique', 4], elevee: ['Élevée', 3], moyenne: ['Moyenne', 2], faible: ['Faible', 1] };
const sevLabel = s => SEV[s]?.[0] ?? 'Non évaluée';
const sevRank = s => ({ critique: 0, elevee: 1, moyenne: 2, faible: 3 }[s] ?? 4);
const sevColor = s => ({ critique: 'var(--red)', elevee: 'var(--orange)', moyenne: 'var(--yellow)', faible: 'var(--green)' }[s] ?? 'var(--faint)');
const statusColor = s => ({ confirme: 'var(--green)', revendique: 'var(--orange)', conteste: 'var(--red)' }[s] ?? 'var(--blue)');
const kindLabel = k => ({ officiel: 'Autorité publique', editeur: 'Éditeur', recherche: 'Équipe de recherche', presse: 'Presse spécialisée', donnees: 'Base de données', suivi: 'Suivi des revendications' }[k] ?? 'Source');
const topicLabel = t => ({ impact: 'l’ampleur de l’impact', cvss: 'le score de gravité CVSS', chronologie: 'la chronologie', attribution: 'l’attribution' }[t] ?? t);
const joinFr = a => a.length <= 1 ? (a[0] ?? '') : a.slice(0, -1).join(', ') + ' et ' + a.at(-1);
const pct = v => (v * 100).toFixed(1).replace('.', ',') + ' %';

// ───────────── Dates ─────────────
const fDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const fTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const day = t => fDay.format(t);
const dateTime = t => `${fDay.format(t)} à ${fTime.format(t)}`;
const shortDate = t => `${fShort.format(t)} ${fTime.format(t)}`;
function ago(t, now = Date.now()) {
  if (t == null) return 'date non communiquée';
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  if (m < 1440) return `il y a ${Math.floor(m / 60)} h`;
  if (m < 43200) return `il y a ${Math.floor(m / 1440)} j`;
  return day(t);
}
function collectDelay(p) {
  if (p.publishedAt == null) return null;
  const m = Math.floor((p.collectedAt - p.publishedAt) / 60000);
  if (m < 0) return null;
  if (m < 60) return `+${m} min`;
  if (m < 1440) return `+${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
  return `+${Math.floor(m / 1440)} j`;
}

// ───────────── Modèle : lecture de l'instantané ─────────────
function normEvent(o) {
  const versions = (o.versions || []).map(v => ({
    n: v.n, at: ms(v.at) || 0, note: v.note || '',
    claims: (v.claims || []).map(c => ({ k: c.k || '', label: c.label || '', v: c.v ?? '', st: c.st || 'signale', src: c.src || 'source non précisée', url: c.url || null, topic: c.topic || null, basis: c.basis || null, h: c.h || null })),
  })).sort((a, b) => a.n - b.n);
  if (!versions.length || !o.id) return null;
  const v = o.vuln;
  const vuln = v ? {
    cve: v.cve || '', vendor: v.vendor || null, product: v.product || null, description: v.description || null, versions: v.versions || [],
    cvss: v.cvss ?? null, cvssSev: v.cvss_sev || null, cvssVector: v.cvss_vector || null, cvssVersion: v.cvss_version || null, cvssSource: v.cvss_source || null,
    epss: v.epss ?? null, epssPct: v.epss_pct ?? null, epssDate: v.epss_date || null,
    kev: v.kev ? { added: v.kev.added || null, due: v.kev.due || null, ransomware: v.kev.ransomware || null, action: v.kev.action || null } : null,
    patch: v.patch || 'non_documente', patchUrl: v.patch_url || null, cwe: v.cwe || [],
  } : null;
  const updatedAt = ms(o.updated_at) || versions.at(-1).at;
  const e = {
    id: o.id, kind: o.kind || 'actu', type: o.type || 'autre', fictif: !!o.fictif, title: o.title || '(sans titre)',
    status: o.status || 'signale', statusReason: o.status_reason || null, severity: o.severity || 'inconnue', severityReason: o.severity_reason || null,
    incidentDate: ms(o.incident_date), disclosedAt: ms(o.disclosed_at), updatedAt, firstSeenAt: ms(o.first_seen_at) || updatedAt,
    countries: (o.countries || []).map(c => ({ code: c.code || '', name: c.name || '', lat: +c.lat || 0, lon: +c.lon || 0 })),
    sectors: o.sectors || [], techs: o.techs || [], cves: o.cves || [],
    actor: o.actor && o.actor.name ? { name: o.actor.name, confidence: o.actor.confidence || 'niveau de confiance non précisé', source: o.actor.source || '', url: o.actor.url || null } : null,
    attack: o.attack || [], summary: o.summary || null, summarySrc: o.summary_src || null, defense: o.defense || [], vuln,
    pubs: (o.pubs || []).map(p => ({ id: p.id, src: p.src || '', kind: p.kind || 'presse', title: p.title || '', url: p.url || '', summary: p.summary || null, lang: p.lang || null, publishedAt: ms(p.published_at), collectedAt: ms(p.collected_at) || updatedAt, derivedFrom: p.derived_from ?? null })),
    versions,
  };
  e.last = versions.at(-1);
  e.sourceCount = new Set(e.pubs.map(p => p.src)).size;
  e.recency = versions.length > 1 ? updatedAt : (e.disclosedAt ?? updatedAt);
  e.hay = [e.title, e.id, e.summary ?? '', vuln?.vendor ?? '', vuln?.product ?? '', e.actor?.name ?? '', ...e.cves, ...e.techs, ...e.sectors, ...e.countries.map(c => c.name)].join(' ').toLowerCase();
  return e;
}
function parseSnapshot(o) {
  const events = (o.events || []).map(normEvent).filter(Boolean);
  const snap = {
    generatedAt: ms(o.generated_at) || 0, events,
    sources: (o.sources || []).map(s => ({ id: s.id, name: s.name || s.id, org: s.org || '', kind: s.kind || '', site: s.site || null, lastAttempt: ms(s.last_attempt), lastSuccess: ms(s.last_success), lastError: s.last_error || null, lastItemAt: ms(s.last_item_at), items: s.items ?? 0 })),
    attack: o.attack || {},
  };
  snap.byId = new Map(events.map(e => [e.id, e]));
  return snap;
}

// ───────────── Logique métier (identique à l'application Android) ─────────────
function diff(a, b) {
  const old = new Map(a.map(c => [c.k, c])), nw = new Map(b.map(c => [c.k, c])), out = [];
  for (const c of b) {
    const o = old.get(c.k);
    if (!o) out.push({ op: 'add', k: c.k, label: c.label, before: null, after: c.v, stBefore: null, stAfter: c.st, src: c.src, url: c.url, basis: c.basis });
    else if ((o.h ?? o.v) !== (c.h ?? c.v) || o.st !== c.st) out.push({ op: 'mod', k: c.k, label: c.label, before: o.v, after: c.v, stBefore: o.st, stAfter: c.st, src: c.src, url: c.url, basis: c.basis });
  }
  for (const c of a) if (!nw.has(c.k)) out.push({ op: 'del', k: c.k, label: c.label, before: c.v, after: null, stBefore: c.st, stAfter: null, src: c.src, url: c.url, basis: c.basis });
  return out;
}
function contradictions(claims) {
  const g = new Map();
  for (const c of claims) if (c.topic) (g.get(c.topic) ?? g.set(c.topic, []).get(c.topic)).push(c);
  return [...g].filter(([, l]) => new Set(l.map(c => c.v)).size > 1);
}
function whatsNew(e, seenN) {
  const base = seenN == null ? null : [...e.versions].reverse().find(v => v.n <= seenN);
  if (!base) return { first: true, since: null, changes: [] };
  return { first: false, since: base, changes: base.n === e.last.n ? [] : diff(base.claims, e.last.claims) };
}
const watchMatch = (e, watch) => watch.some(w => w.trim() && e.hay.includes(w.trim().toLowerCase()));
function priority(e, watched) {
  const v = e.vuln, r = []; let score = 0;
  if (watched) { r.push('le produit figure dans votre liste de surveillance'); score += 3; }
  if (v?.kev) { r.push('l’exploitation est documentée (catalogue CISA KEV)'); score += 3; }
  if (v?.kev?.ransomware === 'Known') { r.push('un usage par des rançongiciels est connu'); score += 1; }
  if ((v?.epss ?? 0) >= 0.5) { r.push(`la probabilité d’exploitation EPSS atteint ${pct(v.epss)}`); score += 1; }
  if ((v?.cvss ?? 0) >= 9) { r.push(`le score CVSS est de ${v.cvss}`); score += 1; }
  if (e.kind === 'incident' && e.status === 'confirme') { r.push('l’incident est confirmé'); score += 2; }
  if (v?.patch === 'oui') r.push('un correctif est disponible');
  const label = score >= 5 ? 'Priorité élevée' : score >= 3 ? 'Priorité moyenne' : 'Priorité faible';
  return { score, label, sentence: `${label}, car ${r.length ? joinFr(r) : 'aucun critère de priorité n’est documenté par les sources'}.` };
}
const SCOPE_KEYS = new Set(['perimetre', 'pays', 'secteur', 'versions', 'sauvegardes', 'donnees', 'produit']);
function computeAlerts(old, nw, watch, followed, rules) {
  const out = [];
  for (const e of nw.events) {
    if (e.fictif) continue;
    if (!watchMatch(e, watch) && !followed.includes(e.id)) continue;
    const o = old.byId.get(e.id), lines = [];
    if (!o) { if (rules.scope) lines.push(`Nouvelle fiche dans votre périmètre : ${typeLabel(e.type)}, ${statusLabel(e.status).toLowerCase()}`); }
    else if (o.last.n !== e.last.n) {
      const ch = diff(o.last.claims, e.last.claims);
      if (rules.patch && ch.some(c => c.k === 'patch' && c.stAfter === 'confirme' && c.stBefore !== 'confirme')) lines.push('Un correctif est désormais référencé');
      if (rules.exploit && ch.some(c => c.k === 'kev' && c.op === 'add')) lines.push('Exploitation confirmée : inscription au catalogue CISA KEV');
      if (rules.exploit && o.status !== 'confirme' && e.status === 'confirme') lines.push('Statut passé à « confirmé »');
      if (rules.scope) ch.filter(c => SCOPE_KEYS.has(c.k) || c.k.startsWith('impact')).slice(0, 3).forEach(c => lines.push(c.op === 'add' ? `Périmètre — ajout : ${c.label}` : c.op === 'del' ? `Périmètre — retrait : ${c.label}` : `Périmètre modifié : ${c.label}`));
    }
    if (lines.length) out.push({ id: e.id, title: e.title, lines, at: Date.now() });
  }
  return out;
}
function thirtySeconds(e, watched) {
  const claims = e.last.claims, who = [];
  if (e.vuln) { const p = [e.vuln.vendor, e.vuln.product].filter(Boolean).join(' '); if (p) who.push(`Produit : ${p}`); }
  if (e.sectors.length) who.push(`Secteurs mentionnés : ${e.sectors.join(', ')}`);
  if (e.countries.length) who.push(`Pays mentionnés : ${e.countries.map(c => c.name).join(', ')}`);
  if (!e.vuln && e.techs.length) who.push(`Technologies citées : ${e.techs.slice(0, 6).join(', ')}`);
  const per = claims.find(c => c.k === 'perimetre'); if (per) who.push(`${per.label} : ${per.v}`);
  if (!who.length) who.push('Non précisé par les sources.');
  let sure = claims.filter(c => c.st === 'confirme' && !c.k.startsWith('pub:')).slice(0, 4).map(c => `${c.label} : ${c.v}`);
  if (!sure.length) sure = claims.filter(c => c.st === 'confirme').slice(0, 2).map(c => `${c.label} : « ${c.v} »`);
  if (!sure.length) sure = [`Rien n’est confirmé à ce stade. ${e.statusReason ?? ''}`.trim()];
  const changed = e.versions.length === 1 ? [`Aucune évolution depuis la création de la fiche, le ${dateTime(e.last.at)}.`] : [`Version ${e.last.n}, le ${dateTime(e.last.at)} : ${e.last.note}`];
  const action = [...e.defense.slice(0, 3)];
  if (e.vuln) action.push(priority(e, watched).sentence);
  if (!action.length) action.push(e.techs.length ? `Aucune mesure n’est documentée par les sources. Vérifiez votre exposition si vous utilisez : ${e.techs.slice(0, 5).join(', ')}.` : 'Aucune mesure défensive n’est documentée par les sources de cette fiche.');
  const english = (e.pubs.length && e.pubs.every(p => p.lang === 'en')) || (e.vuln && !e.pubs.length);
  const note = [e.summarySrc ? `Extrait de la source : ${e.summarySrc}` : null, english && !e.fictif ? 'texte d’origine en anglais' : null].filter(Boolean).join(' · ') || null;
  return [
    { q: 'Que s’est-il passé ?', lines: [e.summary ?? e.title], note },
    { q: 'Qui est concerné ?', lines: who },
    { q: 'Que sait-on avec certitude ?', lines: sure },
    { q: 'Qu’est-ce qui a changé depuis la dernière mise à jour ?', lines: changed },
    { q: 'Quelle action défensive envisager ?', lines: action },
  ];
}
const newFilters = () => ({ status: new Set(), severity: new Set(), type: new Set(), country: new Set(), sector: new Set(), tech: new Set(), query: '' });
const filterActive = f => ['status', 'severity', 'type', 'country', 'sector', 'tech'].filter(k => f[k].size).length + (f.query.trim() ? 1 : 0);
const filterMatch = (f, e) => (!f.status.size || f.status.has(e.status)) && (!f.severity.size || f.severity.has(e.severity)) && (!f.type.size || f.type.has(e.type)) &&
  (!f.country.size || e.countries.some(c => f.country.has(c.code))) && (!f.sector.size || e.sectors.some(s => f.sector.has(s))) && (!f.tech.size || e.techs.some(t => f.tech.has(t))) &&
  (!f.query.trim() || e.hay.includes(f.query.trim().toLowerCase()));

const SECTOR_WORDS = { 'Santé': ['hôpit', 'hopit', 'santé', 'clinique', 'médic'], 'Finance': ['banque', 'financ', 'assurance'], 'Éducation': ['universit', 'école', 'éducation', 'lycée'], 'Administration': ['administration', 'collectivit', 'mairie', 'gouvernement', 'ministère'], 'Énergie': ['énergie', 'électri', 'nucléaire'], 'Transport': ['transport', 'aéroport', 'ferroviaire', 'aérien'], 'Télécoms': ['télécom', 'opérateur'], 'Industrie': ['industri', 'usine'], 'Commerce': ['commerce', 'distribution', 'magasin'], 'Défense': ['défense', 'militaire', 'armée'], 'Eau': ['eau potable', 'assainissement'], 'Médias': ['média', 'presse', 'télévision'] };
const SMALL = new Set(['quels', 'quelles', 'quel', 'quelle', 'cette', 'dans', 'avec', 'pour', 'sont', 'depuis', 'concernent', 'touchent', 'alertes', 'incidents', 'incident', 'confirmés', 'semaine', 'logiciels', 'surveille', 'organisation', 'premier', 'communiqué', 'confirmé', 'fiches', 'derniers', 'dernières', 'vulnérabilités', 'quoi', 'neuf']);
function localAnswer(question, s, watch, now = Date.now()) {
  const t = lower(question), words = t.split(/[^\p{L}\p{N}-]+/u).filter(w => w.length > 3 && !SMALL.has(w));
  if (/depuis|premier communiqué|évolu|a changé/.test(t)) {
    const named = s.events.filter(e => e.versions.length > 1 && words.some(w => lower(e.title).includes(w))).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (named) {
      const first = named.versions[0], conf = diff(first.claims, named.last.claims).filter(c => c.stAfter === 'confirme');
      const head = `Depuis la première version du ${dateTime(first.at)}, ${conf.length} élément(s) confirmé(s) ont été ajoutés ou corrigés (dernière mise à jour : ${dateTime(named.last.at)}).`;
      const body = conf.slice(0, 8).map(c => `• ${c.label} : ${c.after} — ${c.src}`).join('\n');
      return { text: (named.fictif ? 'Fiche FICTIVE de démonstration.\n' : '') + head + (body ? '\n' + body : ''), refs: [named], criteria: 'fiche nommée dans la question · comparaison de la première et de la dernière version', local: true };
    }
  }
  const days = /aujourd|24 h/.test(t) ? 1 : /semaine|7 jours/.test(t) ? 7 : /mois/.test(t) ? 30 : 0;
  const status = t.includes('confirm') ? 'confirme' : t.includes('revendiqu') ? 'revendique' : /contest|démenti/.test(t) ? 'conteste' : null;
  const kind = /vuln|cve|faille|correctif|patch/.test(t) ? 'vuln' : /incident|attaque|rançon|ransom|fuite|intrusion/.test(t) ? 'incident' : null;
  const sector = Object.entries(SECTOR_WORDS).find(([, ws]) => ws.some(w => t.includes(w)))?.[0] ?? null;
  const country = [...new Set(s.events.flatMap(e => e.countries.map(c => c.name)))].find(n => t.includes(lower(n))) ?? null;
  const mine = /surveill|ma veille|mes logiciels|mes technologies|que je sui/.test(t);
  const structured = days > 0 || status || kind || sector || country || mine;
  const since = days > 0 ? now - days * 86400000 : 0;
  let hits = s.events.filter(e => !e.fictif && e.recency >= since && (!status || e.status === status) && (!kind || e.kind === kind) && (!sector || e.sectors.includes(sector)) && (!country || e.countries.some(c => c.name === country)) && (!mine || watchMatch(e, watch)));
  if (!structured) hits = hits.map(e => [e, words.filter(w => e.hay.includes(w)).length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  else hits.sort((a, b) => b.recency - a.recency);
  const crit = [kind === 'vuln' ? 'vulnérabilités' : kind === 'incident' ? 'incidents' : 'toutes les fiches', status && `statut « ${statusLabel(status).toLowerCase()} »`, sector && `secteur ${sector}`, country && `pays : ${country}`,
    mine && `liste de surveillance (${watch.length ? watch.join(', ') : 'vide'})`, days > 0 && `depuis le ${day(since)}`, !structured && words.length && `mots-clés : ${words.join(', ')}`].filter(Boolean).join(' · ');
  if (mine && !watch.length) return { text: 'Votre liste de surveillance est vide. Ajoutez des logiciels, fournisseurs ou secteurs dans l’onglet « Ma veille » pour obtenir une réponse.', refs: [], criteria: crit, local: true };
  if (!hits.length) return { text: `Aucune fiche indexée ne correspond. Cela ne prouve pas l’absence d’événement : seules les publications collectées sont interrogées (données du ${dateTime(s.generatedAt)}).`, refs: [], criteria: crit, local: true };
  const top = hits.slice(0, 12);
  return { text: `${hits.length} fiche(s) correspondent, selon les données collectées le ${dateTime(s.generatedAt)}.` + (hits.length > top.length ? ` Les ${top.length} plus récentes sont listées.` : ''), refs: top, criteria: crit, local: true };
}

