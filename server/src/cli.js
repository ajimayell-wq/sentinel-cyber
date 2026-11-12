// node src/cli.js migrate | collect | export <dossier> | all <dossier>
import { migrate, pool } from './db.js';
import { collect } from './collect.js';
import { exportStatic } from './export.js';
import { seedDemo } from './demo.js';

const [cmd, arg] = process.argv.slice(2);
try {
  if (cmd === 'migrate' || cmd === 'all') { await migrate(); await seedDemo(); }
  if (cmd === 'collect' || cmd === 'all') {
    const r = await collect();
    for (const [id, s] of Object.entries(r.sources)) console.log(s.ok ? '  OK ' : '  ÉCHEC', id.padEnd(16), s.ok ? `${s.items} éléments${s.nouvelles != null ? `, ${s.nouvelles} nouvelles` : ''}` : s.erreur);
    console.log(`Collecte : ${r.publications_nouvelles} publications nouvelles, ${r.fiches_mises_a_jour} fiches créées ou mises à jour.`);
  }
  if (cmd === 'export' || cmd === 'all') {
    const s = await exportStatic(arg ?? 'public');
    const k = t => s.events.filter(e => e.kind === t).length;
    console.log(`Instantané : ${s.events.length} fiches (${k('incident')} incidents, ${k('vuln')} vulnérabilités, ${k('actu')} actualités), ${s.sources.filter(x => x.last_success).length}/${s.sources.length} sources joignables.`);
  }
  if (cmd === 'apercu' || cmd === 'all') {
    const { rows } = await pool.query(`SELECT e.type, e.status, e.title, e.data->'sectors' AS s, e.data->'countries' AS c, e.data->'actor'->>'name' AS a,
      (SELECT count(*) FROM publications p WHERE p.event_id=e.id) AS n, (SELECT string_agg(DISTINCT p.source_id, ',') FROM publications p WHERE p.event_id=e.id) AS src
      FROM events e WHERE kind='incident' AND NOT fictif ORDER BY n DESC, COALESCE(disclosed_at, first_seen_at) DESC LIMIT 45`);
    console.log('Aperçu des incidents (les plus couverts d’abord) :');
    for (const r of rows) console.log(` ${String(r.n).padStart(2)} pub. [${r.status}/${r.type}] ${r.title.slice(0, 96)} | ${(r.c ?? []).map(x => x.code).join(',')} | ${(r.s ?? []).join(',')} | ${r.a ?? ''} | ${r.src}`);
  }
} catch (e) { console.error(e); process.exitCode = 1; } finally { await pool.end(); }
