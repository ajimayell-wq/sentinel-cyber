import pg from 'pg';
import fs from 'node:fs';
import { SOURCES, env } from './config.js';

pg.types.setTypeParser(1184, v => new Date(v).toISOString()); // timestamptz -> ISO
export const pool = new pg.Pool({ connectionString: env('DATABASE_URL', 'postgres://postgres@localhost:5432/sentinel'), max: 5 });
export const q = (text, params) => pool.query(text, params).then(r => r.rows);
export const one = (text, params) => q(text, params).then(r => r[0] ?? null);

export async function migrate() {
  await pool.query(fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  for (const s of SOURCES) {
    await q(`INSERT INTO sources (id,name,org,kind,url,site) VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (id) DO UPDATE SET name=$2, org=$3, kind=$4, url=$5, site=$6, enabled=true`,
      [s.id, s.name, s.org, s.kind, s.urls[0], s.site ?? null]);
  }
  await q(`UPDATE sources SET enabled=false WHERE id <> ALL($1)`, [SOURCES.map(s => s.id)]);
}
