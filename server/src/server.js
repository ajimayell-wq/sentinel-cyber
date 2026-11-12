// API HTTP + collecte planifiée. Aucune donnée personnelle : la liste de surveillance reste sur le téléphone.
import http from 'node:http';
import zlib from 'node:zlib';
import { migrate, q, one } from './db.js';
import { collect } from './collect.js';
import { snapshot, eventJson, eventDiff } from './export.js';
import { seedDemo } from './demo.js';
import { env } from './config.js';

let cache = { at: 0, body: null };
async function snap() {
  if (Date.now() - cache.at > 30000) cache = { at: Date.now(), body: JSON.stringify(await snapshot()) };
  return cache.body;
}

async function assistant({ question, watch = [] }) {
  if (!env('ANTHROPIC_API_KEY')) return { status: 501, body: { error: 'assistant_non_configure', message: 'Aucune clé ANTHROPIC_API_KEY sur le serveur : l’application utilise sa recherche locale.' } };
  const words = String(question).toLowerCase().split(/[^\p{L}\p{N}-]+/u).filter(w => w.length > 3);
  const all = JSON.parse(await snap()).events;
  const score = e => { const t = JSON.stringify([e.title, e.summary, e.sectors, e.countries, e.techs, e.cves, e.type, e.status]).toLowerCase(); return words.filter(w => t.includes(w)).length + (watch.some(w => t.includes(String(w).toLowerCase())) ? 2 : 0); };
  const top = all.map(e => [score(e), e]).sort((a, b) => b[0] - a[0] || (a[1].updated_at < b[1].updated_at ? 1 : -1)).slice(0, 14).map(x => x[1]);
  const docs = top.map(e => ({ id: e.id, fictif: e.fictif, titre: e.title, type: e.type, statut: e.status, motif: e.status_reason, gravite: e.severity, divulgation: e.disclosed_at, maj: e.updated_at, pays: e.countries.map(c => c.name), secteurs: e.sectors, technologies: e.techs,
    affirmations: e.versions.at(-1).claims.map(c => ({ sujet: c.label, valeur: c.v, statut: c.st, source: c.src })), historique: e.versions.map(v => ({ n: v.n, date: v.at, note: v.note })) }));
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ model: env('ANTHROPIC_MODEL', 'claude-sonnet-5-5'), max_tokens: 900,
      system: `Tu es l'assistant de SENTINEL CYBER. Date du jour : ${new Date().toISOString().slice(0, 10)}. Réponds en français, brièvement, UNIQUEMENT à partir des fiches fournies. Après chaque affirmation importante, cite la fiche entre crochets, par exemple [ev1042] ou [CVE-2025-1234]. Donne des dates explicites. Distingue confirmé, signalé, revendiqué et contesté. Si les fiches ne permettent pas de répondre, dis-le. Signale toute fiche fictive comme telle. Liste de surveillance de l'utilisateur : ${watch.join(', ') || 'vide'}.`,
      messages: [{ role: 'user', content: `Fiches indexées :\n${JSON.stringify(docs)}\n\nQuestion : ${question}` }] }) });
  if (!r.ok) return { status: 502, body: { error: 'assistant_indisponible', message: `Service IA : HTTP ${r.status}` } };
  const answer = (await r.json()).content?.map(c => c.text ?? '').join('') ?? '';
  return { status: 200, body: { answer, refs: top.filter(e => answer.includes(`[${e.id}]`)).map(e => ({ id: e.id, title: e.title })) } };
}

const server = http.createServer(async (req, res) => {
  const send = (status, body, type = 'application/json; charset=utf-8') => {
    const buf = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const gz = /gzip/.test(req.headers['accept-encoding'] ?? '') && buf.length > 1024;
    res.writeHead(status, { 'content-type': type, 'access-control-allow-origin': '*', 'cache-control': 'no-store', ...(gz ? { 'content-encoding': 'gzip' } : {}) });
    res.end(gz ? zlib.gzipSync(buf) : buf);
  };
  try {
    const url = new URL(req.url, 'http://x'); const p = url.pathname.replace(/\/+$/, '');
    let m;
    if (p === '/health') return send(200, { ok: true, last_run: await one(`SELECT started, finished FROM runs ORDER BY id DESC LIMIT 1`) });
    if (p === '/api/snapshot' || p === '/api/snapshot.json') return send(200, await snap());
    if (p === '/api/sources') return send(200, await q(`SELECT * FROM sources WHERE enabled ORDER BY kind, name`));
    if (p === '/api/report.json') return send(200, (await one(`SELECT report FROM runs WHERE finished IS NOT NULL ORDER BY id DESC LIMIT 1`))?.report ?? {});
    if ((m = p.match(/^\/api\/events\/([\w-]+)$/))) { const e = await one(`SELECT * FROM events WHERE id=$1`, [m[1]]); return e ? send(200, await eventJson(e)) : send(404, { error: 'fiche_introuvable' }); }
    if ((m = p.match(/^\/api\/events\/([\w-]+)\/diff$/))) { const d = await eventDiff(m[1], +url.searchParams.get('from'), +url.searchParams.get('to')); return d ? send(200, d) : send(404, { error: 'versions_introuvables' }); }
    if (p === '/api/assistant' && req.method === 'POST') {
      let raw = ''; for await (const c of req) { raw += c; if (raw.length > 20000) return send(413, { error: 'trop_long' }); }
      const r = await assistant(JSON.parse(raw || '{}')); return send(r.status, r.body);
    }
    if (p === '/api/collect' && req.method === 'POST' && env('ADMIN_TOKEN') && req.headers.authorization === `Bearer ${env('ADMIN_TOKEN')}`) { tick(); return send(202, { ok: true }); }
    send(404, { error: 'route_inconnue' });
  } catch (e) { console.error(e); send(500, { error: 'erreur_serveur' }); }
});

let busy = false;
async function tick() {
  if (busy) return; busy = true;
  try { const r = await collect(); cache.at = 0; console.log(new Date().toISOString(), 'collecte :', r.publications_nouvelles, 'publications,', r.fiches_mises_a_jour, 'fiches mises à jour'); }
  catch (e) { console.error('collecte en échec', e); } finally { busy = false; }
}

await migrate();
await seedDemo();
server.listen(+env('PORT', 8080), () => console.log('SENTINEL CYBER — API sur le port', env('PORT', 8080)));
tick();
setInterval(tick, +env('COLLECT_MINUTES', 15) * 60000);
