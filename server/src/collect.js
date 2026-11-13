// Collecte planifiée : flux -> publications dédoublonnées -> rattachement à une fiche -> nouvelle version.
import { q, one } from './db.js';
import { SOURCES, env } from './config.js';
import { parseFeed, excerpt, strip, hrefs, tokens, similar, date } from './parse.js';
import { classify, nature, rebuild } from './model.js';

const UA = 'SentinelCyber/1.0 (veille cybersécurité ; flux publics)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MAX_AGE = +env('MAX_AGE_DAYS', 45) * 864e5;
const KEV_DAYS = +env('KEV_DAYS', 120);

export let fetcher = async (url, opt = {}) => {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: opt.json ? 'application/json' : 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*', ...(opt.headers ?? {}) }, signal: AbortSignal.timeout(opt.timeout ?? 30000), redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
};
export const setFetcher = f => { fetcher = f; };

// Essaie chaque adresse connue de la source ; « read » valide le contenu (une page HTML à la place d'un flux = échec).
async function fetchAny(src, opt, suffix = '', read = b => b) {
  let err;
  for (const u of src.urls) { try { return { url: u, body: read(await fetcher(u + suffix, src.headers ? { ...opt, headers: { ...src.headers, ...(opt.headers ?? {}) } } : opt)) }; } catch (e) { err = new Error(`${e.message} (${new URL(u).hostname}${new URL(u).pathname})`); } }
  throw err;
}
async function ok(id, n, lastItem) {
  await q(`UPDATE sources SET last_attempt=now(), last_success=now(), last_error=NULL, items=$2, last_item_at=GREATEST(last_item_at, $3::timestamptz) WHERE id=$1`, [id, n, lastItem ?? null]);
}
const ko = (id, e) => q(`UPDATE sources SET last_attempt=now(), last_error=$2 WHERE id=$1`, [id, String(e.message ?? e).slice(0, 300)]);

async function collectFeed(src, now, report) {
  if (src.html) {   // page web sans flux : le fichier robots.txt du site est respecté
    const u = new URL(src.urls[0]);
    const robots = await fetcher(`${u.origin}/robots.txt`).catch(() => '');
    let mine = false;
    for (const line of robots.split(/\r?\n/)) {
      const i = line.indexOf(':'); if (i < 0) continue;
      const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).split('#')[0].trim();
      if (k === 'user-agent') mine = v === '*' || /sentinelcyber/i.test(v);
      else if (mine && k === 'disallow' && v && u.pathname.startsWith(v)) throw new Error('collecte non autorisée par le fichier robots.txt du site');
    }
  }
  const { body: all } = await fetchAny(src, {}, '', b => parseFeed(b, src));
  const keep = src.filter ? new RegExp(src.filter, 'i') : null;
  const items = keep ? all.filter(it => keep.test(`${it.title} ${strip(it.html)}`)) : all;
  const fresh = [];
  let latest = null;
  // les flux très volumineux (un élément par CVE) sont limités aux éléments les plus récents
  const recent = [...items].sort((x, y) => (y.published ?? 0) - (x.published ?? 0)).slice(0, src.max ?? 60);
  for (const it of recent) {
    if (it.published && (!latest || it.published > latest)) latest = it.published;
    if (it.published && now - it.published > MAX_AGE) continue;
    const text = strip(it.html);
    const row = await one(`INSERT INTO publications (source_id,guid,url,title,summary,body,lang,published_at,collected_at,links)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (source_id,guid) DO NOTHING RETURNING id`,
      [src.id, it.guid.slice(0, 500), it.url, it.title.slice(0, 400), excerpt(text, 280) || null, text.slice(0, 6000) || null, src.lang ?? null, it.published, now, hrefs(it.html).filter(h => h !== it.url)]);
    if (row) fresh.push(row.id);
  }
  await ok(src.id, items.length, latest);
  report.sources[src.id] = { ok: true, items: items.length, nouvelles: fresh.length };
  return fresh;
}

async function collectKev(src, report) {
  const { body } = await fetchAny(src, { json: true });
  const doc = JSON.parse(body);
  const since = new Date(Date.now() - KEV_DAYS * 864e5).toISOString().slice(0, 10);
  let n = 0;
  for (const v of doc.vulnerabilities ?? []) {
    if (v.dateAdded >= since) { await q(`INSERT INTO vulns (cve,kev) VALUES ($1,$2) ON CONFLICT (cve) DO UPDATE SET kev=$2`, [v.cveID, JSON.stringify(v)]); n++; }
    else await q(`UPDATE vulns SET kev=$2 WHERE cve=$1`, [v.cveID, JSON.stringify(v)]);
  }
  await ok(src.id, doc.count ?? doc.vulnerabilities.length, date(doc.dateReleased));
  report.sources[src.id] = { ok: true, items: doc.vulnerabilities.length, suivies: n, version: doc.catalogVersion };
}

async function collectNvd(src, report) {
  const headers = env('NVD_API_KEY') ? { apiKey: env('NVD_API_KEY') } : {};
  const save = async body => { let n = 0; for (const x of JSON.parse(body).vulnerabilities ?? []) { n += (await q(`UPDATE vulns SET nvd=$2, nvd_at=now() WHERE cve=$1 RETURNING cve`, [x.cve.id, JSON.stringify(x.cve)])).length; } return n; };
  let n = 0, errors = [];
  try {   // 1 requête : toutes les CVE inscrites au KEV sur la période suivie
    const end = new Date(), start = new Date(Date.now() - Math.min(KEV_DAYS, 119) * 864e5);
    const { body } = await fetchAny(src, { json: true, headers, timeout: 60000 }, `?hasKev&kevStartDate=${start.toISOString()}&kevEndDate=${end.toISOString()}&resultsPerPage=500`);
    n += await save(body);
  } catch (e) { errors.push(`lot KEV : ${e.message}`); }
  // puis, à l'unité et sans dépasser le quota public, les CVE encore sans détail
  const missing = await q(`SELECT cve FROM vulns WHERE nvd IS NULL OR nvd_at < now() - interval '3 days' ORDER BY nvd_at NULLS FIRST, wanted_at DESC LIMIT $1`, [+env('NVD_PER_RUN', 8)]);
  for (const { cve } of missing) {
    try { const { body } = await fetchAny(src, { json: true, headers }, `?cveId=${cve}`); n += await save(body); } catch (e) { errors.push(`${cve} : ${e.message}`); if (/HTTP (403|429)/.test(e.message)) break; }
    await sleep(+env('NVD_DELAY_MS', 6500));
  }
  if (n || !errors.length) await ok(src.id, n, new Date()); else await ko(src.id, new Error(errors[0]));
  report.sources[src.id] = { ok: n > 0 || !errors.length, items: n, erreurs: errors.slice(0, 3) };
}

async function collectEpss(src, report) {
  const cves = (await q(`SELECT cve FROM vulns`)).map(r => r.cve);
  let n = 0, day = null;
  for (let i = 0; i < cves.length; i += 80) {
    const { body } = await fetchAny(src, { json: true }, `?cve=${cves.slice(i, i + 80).join(',')}`);
    for (const d of JSON.parse(body).data ?? []) { day = d.date; n += (await q(`UPDATE vulns SET epss=$2, epss_pct=$3, epss_date=$4 WHERE cve=$1 RETURNING cve`, [d.cve, +d.epss, +d.percentile, d.date])).length; }
  }
  await ok(src.id, n, day ? new Date(day) : null);
  report.sources[src.id] = { ok: true, items: n, date: day };
}

async function ensureVulnEvent(cve, now) {
  await q(`INSERT INTO events (id,kind,type,title,status,updated_at,first_seen_at) VALUES ($1,'vuln','vuln',$1,'signale',$2,$2) ON CONFLICT (id) DO NOTHING`, [cve, now]);
}

// Rattache chaque nouvelle publication à une fiche existante ou en crée une.
async function assign(ids, now, touched) {
  if (!ids.length) return;
  const recent = await q(`SELECT id, kind, type, tokens, updated_at, COALESCE(data->'techs', '[]'::jsonb) AS techs FROM events WHERE kind <> 'vuln' AND NOT fictif AND updated_at > $1`, [new Date(now - 10 * 864e5)]);
  const tracked = new Set((await q('SELECT cve FROM vulns')).map(r => r.cve));
  const pubs = await q(`SELECT p.*, s.kind AS skind FROM publications p JOIN sources s ON s.id=p.source_id WHERE p.id = ANY($1) ORDER BY COALESCE(p.published_at,p.collected_at), p.id`, [ids]);
  // les publications qui en citent une autre du même lot passent après elle
  const urls = new Set(pubs.map(p => p.url));
  pubs.sort((a, b) => a.links.some(l => urls.has(l)) - b.links.some(l => urls.has(l)));
  for (const p of pubs) {
    const c = { ...classify(`${p.title}. ${p.summary ?? ''} ${p.body ?? ''}`), ...nature(p, SOURCES.find(x => x.id === p.source_id)) };
    let eventId = null, derived = null;
    // a) la publication cite explicitement une publication déjà suivie : même événement, source d'origine connue
    if (p.links.length) {
      const o = await one(`SELECT id, event_id FROM publications WHERE url = ANY($1) AND event_id IS NOT NULL AND id <> $2 ORDER BY id LIMIT 1`, [p.links, p.id]);
      if (o) { eventId = o.event_id; derived = o.id; }
    }
    // b) avis centré sur une vulnérabilité suivie
    if (!eventId && c.cves.length && c.cves.length <= 4) {
      const cve = c.cves.find(x => tracked.has(x));
      if (cve) { await ensureVulnEvent(cve, now); eventId = cve; }
    }
    // c) même sujet qu'une fiche récente
    const tk = tokens(p.title, p.summary);
    if (!eventId) {
      let best = 0;
      for (const e of recent) { if (e.kind !== c.kind) continue; const s = similar(tk, e.tokens); if (s > best) { best = s; eventId = e.id; } }
      if (best < 0.5) eventId = null;
    }
    // d) panne de service : même éditeur touché dans les 48 h, quelle que soit la langue de l'article
    if (!eventId && c.type === 'panne' && c.techs.length) {
      const m = recent.find(e => e.kind === c.kind && e.type === 'panne' && new Date(e.updated_at) > new Date(now - 2 * 864e5) && (e.techs ?? []).some(t => c.techs.includes(t)));
      if (m) eventId = m.id;
    }
    if (!eventId) {
      eventId = 'ev' + (await one(`SELECT nextval('event_seq') AS n`)).n;
      await q(`INSERT INTO events (id,kind,type,title,status,updated_at,first_seen_at,tokens) VALUES ($1,$2,$3,$4,'signale',$5,$5,$6)`, [eventId, c.kind, c.type, p.title, now, tk]);
      recent.push({ id: eventId, kind: c.kind, type: c.type, tokens: tk, updated_at: now, techs: c.techs });
    }
    await q(`UPDATE publications SET event_id=$2, derived_from=$3 WHERE id=$1`, [p.id, eventId, derived]);
    touched.add(eventId);
  }
}

export async function collect({ now = new Date(), only } = {}) {
  const run = await one(`INSERT INTO runs (started) VALUES ($1) RETURNING id`, [now]);
  const report = { started: now.toISOString(), sources: {} };
  const touched = new Set(), fresh = [];
  const by = f => SOURCES.filter(s => (s.format ?? 'feed') === f && (!only || only.includes(s.id)));
  const guard = async (src, fn) => { try { return await fn(); } catch (e) { await ko(src.id, e); report.sources[src.id] = { ok: false, erreur: String(e.message) }; return null; } };

  for (const src of by('kev')) await guard(src, () => collectKev(src, report));
  // flux en parallèle, par petits lots
  const feeds = by('feed');
  for (let i = 0; i < feeds.length; i += 6) {
    const res = await Promise.all(feeds.slice(i, i + 6).map(src => guard(src, () => collectFeed(src, now, report))));
    for (const r of res) if (r) fresh.push(...r);
  }
  // les CVE citées par une alerte CERT-FR sont suivies même hors KEV
  for (const p of await q(`SELECT title, summary, body FROM publications WHERE source_id='certfr-alerte' AND id = ANY($1)`, [fresh])) {
    for (const cve of classify(`${p.title} ${p.summary ?? ''} ${p.body ?? ''}`).cves.slice(0, 6)) await q(`INSERT INTO vulns (cve) VALUES ($1) ON CONFLICT DO NOTHING`, [cve]);
  }
  for (const src of by('nvd')) await guard(src, () => collectNvd(src, report));
  for (const src of by('epss')) await guard(src, () => collectEpss(src, report));

  for (const { cve } of await q(`SELECT cve FROM vulns`)) { await ensureVulnEvent(cve, now); touched.add(cve); }
  await assign(fresh, now, touched);
  // les incidents récents sont recalculés à chaque collecte : une règle de classement corrigée s'applique aussi aux fiches existantes
  for (const r of await q(`SELECT id FROM events WHERE kind='incident' AND NOT fictif AND updated_at > $1`, [new Date(now - 3 * 864e5)])) touched.add(r.id);
  let versions = 0;
  for (const id of touched) if (await rebuild(id, now)) versions++;
  Object.assign(report, { finished: new Date().toISOString(), publications_nouvelles: fresh.length, fiches_mises_a_jour: versions });
  await q(`UPDATE runs SET finished=now(), report=$2 WHERE id=$1`, [run.id, JSON.stringify(report)]);
  return report;
}
