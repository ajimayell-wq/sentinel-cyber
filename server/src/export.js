// Instantané complet servi à l'application (API et miroir statique partagent ce format).
import fs from 'node:fs';
import path from 'node:path';
import { q, one } from './db.js';
import { attackInfo } from './attack.js';
import { diff } from './model.js';

export async function eventJson(e) {
  const pubs = e.fictif ? e.data.demo_pubs : await q(
    `SELECT p.id, p.source_id, s.name AS src, s.kind, p.title, p.url, p.summary, p.lang, p.published_at, p.collected_at, p.derived_from
     FROM publications p JOIN sources s ON s.id=p.source_id WHERE p.event_id=$1 ORDER BY COALESCE(p.published_at,p.collected_at) DESC, p.id DESC LIMIT 40`, [e.id]);
  const versions = await q(`SELECT n, at, note, claims FROM event_versions WHERE event_id=$1 ORDER BY n DESC LIMIT 40`, [e.id]);
  const { demo_pubs, ...data } = e.data;
  const { tokens, data: _d, ...row } = e;
  return { ...row, ...data, pubs, versions: versions.reverse() };
}

export async function snapshot({ days = 45, limit = 300, actu = 200 } = {}) {
  // quota par famille : un flux bavard ne doit évincer ni les incidents ni les vulnérabilités
  const rows = await q(`SELECT * FROM (
      SELECT e.*, row_number() OVER (PARTITION BY kind ORDER BY updated_at DESC, COALESCE(disclosed_at, first_seen_at) DESC) AS rk
      FROM events e WHERE (updated_at > now() - $1::interval OR fictif) AND EXISTS (SELECT 1 FROM event_versions v WHERE v.event_id=e.id)) t
    WHERE fictif OR rk <= CASE kind WHEN 'actu' THEN $2::int ELSE $3::int END ORDER BY updated_at DESC`, [`${days} days`, actu, limit]);
  const events = [];
  for (const e of rows) events.push(await eventJson(e));
  const sources = await q(`SELECT id,name,org,kind,site,url,last_attempt,last_success,last_error,last_item_at,items FROM sources WHERE enabled ORDER BY kind, name`);
  const run = await one(`SELECT started, finished FROM runs WHERE finished IS NOT NULL ORDER BY id DESC LIMIT 1`);
  return { format: 1, generated_at: new Date().toISOString(), last_run: run, sources, events, attack: attackInfo([...new Set(events.flatMap(e => e.attack ?? []))]) };
}

export async function eventDiff(id, from, to) {
  const v = await q(`SELECT n, at, claims FROM event_versions WHERE event_id=$1 AND n = ANY($2)`, [id, [from, to]]);
  const a = v.find(x => x.n === from), b = v.find(x => x.n === to);
  return a && b ? { event: id, from: { n: a.n, at: a.at }, to: { n: b.n, at: b.at }, changes: diff(a.claims, b.claims) } : null;
}

export async function exportStatic(dir) {
  const snap = await snapshot();
  fs.mkdirSync(path.join(dir, 'api'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'api', 'snapshot.json'), JSON.stringify(snap));
  const run = await one(`SELECT report FROM runs WHERE finished IS NOT NULL ORDER BY id DESC LIMIT 1`);
  fs.writeFileSync(path.join(dir, 'api', 'report.json'), JSON.stringify(run?.report ?? {}, null, 1));
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>SENTINEL CYBER — miroir de données</title><body style="font:16px system-ui;background:#0b1220;color:#dbe4f0;padding:2rem"><h1>SENTINEL CYBER</h1><p>Miroir statique de l'API. Instantané du ${snap.generated_at} : ${snap.events.length} fiches.</p><p><a style="color:#7fb0ff" href="api/snapshot.json">api/snapshot.json</a> · <a style="color:#7fb0ff" href="api/report.json">api/report.json</a></p>`);
  return snap;
}
