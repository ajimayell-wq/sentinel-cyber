// Fiches évolutives : classement, affirmations sourcées, versions et comparaison.
import { q, one } from './db.js';
import { SOURCES, TYPES, INCIDENT_TYPES, SECTORS, COUNTRIES, ACTORS, TECHS, RX, KIND_LABEL } from './config.js';
import { sha, excerpt } from './parse.js';

const uniq = a => [...new Set(a)];
const techRx = TECHS.map(t => [t, new RegExp(`(^|[^\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u')]);

export function classify(text) {
  const type = (TYPES.find(([, rx]) => rx.test(text)) ?? ['autre'])[0];
  return {
    type,
    kind: INCIDENT_TYPES.has(type) ? 'incident' : 'actu',
    sectors: SECTORS.filter(([, rx]) => rx.test(text)).map(([n]) => n),
    countries: COUNTRIES.filter(c => c[4].test(text)).map(([code, name, lat, lon]) => ({ code, name, lat, lon })),
    actor: (text.match(ACTORS) ?? [null])[0],
    cves: uniq((text.match(RX.cve) ?? []).map(c => c.toUpperCase())),
    attack: uniq(text.match(RX.attack) ?? []),
    techs: techRx.filter(([, rx]) => rx.test(text)).map(([t]) => t),
  };
}

// Statut porté par UNE publication : ce que la source permet d'affirmer, pas davantage.
function pubStatus(p, incident) {
  const text = `${p.title} ${p.summary ?? ''}`;
  if (!incident) return p.kind === 'officiel' || p.kind === 'editeur' ? 'confirme' : 'signale';
  if (RX.deny.test(text)) return 'conteste';
  if (p.kind === 'officiel') return 'confirme';
  if (RX.confirm.test(text)) return 'confirme';
  if (RX.claim.test(text)) return 'revendique';
  return 'signale';
}
const RANK = { conteste: 4, confirme: 3, revendique: 2, signale: 1 };

const NOT_INCIDENT = /\b(benchmark|exercise|exercice|drill|simulation|survey|study|raises?|funding|emerges from stealth|acquires?|acquisition|webinar|podcast|conference|award|recap|roundup|trends|how to|researchers? (find|found|bypass|discover|show|demonstrate|uncover|warn|hack|detail)s?)\b/i;
const EVENT = /\b(breach(ed|es)?|hacked|compromised?|confirms?|stolen|stole|steals?|leak(ed|s)?|outage|cyber ?attack|cyberattaque|piratage|fuite|hit by|shuts? down|offline|sabotage|data theft|vol de données|revendi)/i;

// Nature d'une publication, d'après son titre (et son résumé pour la presse). Le corps entier n'est jamais utilisé :
// un mot croisé au fil d'un long article ne dit rien du sujet. Un avis de sécurité n'est jamais un incident.
// Les actualités d'une autorité informent sans créer de fiche d'incident ; un billet d'éditeur ou de chercheur
// n'en crée une que si son titre décrit un événement (compromission, fuite, arrêt de service…).
export function nature(p, src = {}) {
  if (src.role === 'avis') return { kind: 'actu', type: 'maj' };
  const find = t => TYPES.find(([, rx]) => rx.test(t))?.[0];
  const expert = src.kind === 'recherche' || src.kind === 'editeur' || src.kind === 'officiel';
  const type = find(p.title) ?? (expert ? 'recherche' : find(`${p.title}. ${p.summary ?? ''}`) ?? 'autre');
  const incident = INCIDENT_TYPES.has(type) && !NOT_INCIDENT.test(p.title) && src.kind !== 'officiel' && (!expert || EVENT.test(p.title));
  if (incident) return { kind: 'incident', type };
  return { kind: 'actu', type: !INCIDENT_TYPES.has(type) ? type : expert && src.kind !== 'officiel' ? 'recherche' : 'autre' };
}

export function diff(a = [], b = []) {
  const A = new Map(a.map(c => [c.k, c])), B = new Map(b.map(c => [c.k, c]));
  const out = [];
  for (const [k, c] of B) {
    const o = A.get(k);
    if (!o) out.push({ op: 'add', k, label: c.label, after: c.v, st_after: c.st, src: c.src, url: c.url });
    else if ((o.h ?? o.v) !== (c.h ?? c.v) || o.st !== c.st) out.push({ op: 'mod', k, label: c.label, before: o.v, after: c.v, st_before: o.st, st_after: c.st, src: c.src, url: c.url });
  }
  for (const [k, c] of A) if (!B.has(k)) out.push({ op: 'del', k, label: c.label, before: c.v, st_before: c.st, src: c.src, url: c.url });
  return out;
}

const noteOf = d => d.slice(0, 3).map(x =>
  x.op === 'add' ? `Ajout : ${x.label}` : x.op === 'del' ? `Retrait : ${x.label}` : `${x.label} : ${x.before} → ${x.after}`).join(' · ') + (d.length > 3 ? ` · +${d.length - 3}` : '');

function cvssOf(nvd) {
  const m = nvd?.metrics ?? {}; const out = [];
  for (const key of ['cvssMetricV40', 'cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2']) {
    for (const x of m[key] ?? []) out.push({ v: x.cvssData?.version ?? key.slice(-2), score: x.cvssData?.baseScore, sev: x.cvssData?.baseSeverity ?? x.baseSeverity, vector: x.cvssData?.vectorString, source: x.source, primary: x.type === 'Primary' });
  }
  return out.filter(x => typeof x.score === 'number');
}
function versionsOf(nvd) {
  const out = [];
  for (const c of nvd?.configurations ?? []) for (const n of c.nodes ?? []) for (const m of n.cpeMatch ?? []) {
    if (!m.vulnerable) continue;
    const p = m.criteria.split(':'); const name = `${p[3]} ${p[4]}`.replace(/_/g, ' ');
    const lo = m.versionStartIncluding ? `≥ ${m.versionStartIncluding}` : m.versionStartExcluding ? `> ${m.versionStartExcluding}` : '';
    const hi = m.versionEndExcluding ? `< ${m.versionEndExcluding}` : m.versionEndIncluding ? `≤ ${m.versionEndIncluding}` : '';
    const exact = p[5] && p[5] !== '*' && p[5] !== '-' ? p[5] : '';
    out.push(`${name} ${[lo, hi].filter(Boolean).join(' et ') || exact || '(versions non précisées)'}`.trim());
  }
  return uniq(out).slice(0, 8);
}

async function buildVuln(ev, pubs) {
  const v = await one('SELECT * FROM vulns WHERE cve=$1', [ev.id]);
  const kev = v?.kev, nvd = v?.nvd, claims = [];
  const cv = cvssOf(nvd), main = cv.find(x => x.primary) ?? cv[0];
  const nvdUrl = `https://nvd.nist.gov/vuln/detail/${ev.id}`;
  const kevUrl = 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog';
  const desc = (nvd?.descriptions ?? []).find(d => d.lang === 'en')?.value ?? kev?.shortDescription ?? null;
  const patchRef = (nvd?.references ?? []).find(r => (r.tags ?? []).includes('Patch'));
  const advisory = (nvd?.references ?? []).find(r => (r.tags ?? []).includes('Vendor Advisory'));
  const versions = versionsOf(nvd);
  const vuln = {
    cve: ev.id, vendor: kev?.vendorProject ?? null, product: kev?.product ?? null, description: desc, versions,
    cvss: main?.score ?? null, cvss_sev: main?.sev ?? null, cvss_vector: main?.vector ?? null, cvss_version: main?.v ?? null, cvss_source: main?.source ?? null,
    epss: v?.epss ?? null, epss_pct: v?.epss_pct ?? null, epss_date: v?.epss_date ?? null,
    kev: kev ? { added: kev.dateAdded, due: kev.dueDate, ransomware: kev.knownRansomwareCampaignUse, action: kev.requiredAction, notes: kev.notes } : null,
    patch: patchRef ? 'oui' : 'non_documente', patch_url: patchRef?.url ?? advisory?.url ?? null,
    nvd_status: nvd?.vulnStatus ?? null, cwe: uniq((nvd?.weaknesses ?? []).flatMap(w => w.description.map(d => d.value)).filter(x => /^CWE-\d+/.test(x))),
  };
  if (vuln.vendor || vuln.product) claims.push({ k: 'produit', label: 'Produit concerné', v: [vuln.vendor, vuln.product].filter(Boolean).join(' — '), st: 'confirme', src: 'CISA KEV', url: kevUrl });
  if (versions.length) claims.push({ k: 'versions', label: 'Versions touchées', v: versions.join(' ; '), st: 'confirme', src: 'NVD', url: nvdUrl });
  const seen = new Set();
  for (const c of cv) {
    const who = c.source === 'nvd@nist.gov' ? 'NVD' : c.source; if (seen.has(who + c.v)) continue; seen.add(who + c.v);
    claims.push({ k: `cvss#${who}#${c.v}`, topic: 'cvss', label: `Score CVSS ${c.v} — ${who}`, v: `${c.score} (${c.sev ?? 'n/c'})`, st: 'confirme', src: who, url: nvdUrl });
  }
  if (v?.epss != null) claims.push({ k: 'epss', label: 'Score EPSS', v: `${v.epss.toFixed(3)} · ${Math.round(v.epss_pct * 100)}ᵉ centile`, h: String(Math.round(v.epss * 10)), st: 'confirme', src: 'FIRST EPSS', url: `https://api.first.org/data/v1/epss?cve=${ev.id}` });
  if (kev) {
    claims.push({ k: 'kev', label: 'Exploitation active', v: `Inscrite au catalogue CISA KEV le ${kev.dateAdded}`, st: 'confirme', src: 'CISA KEV', url: kevUrl });
    claims.push({ k: 'kev_ransom', label: 'Usage par des rançongiciels', v: kev.knownRansomwareCampaignUse === 'Known' ? 'Connu' : 'Non connu à ce jour', st: 'confirme', src: 'CISA KEV', url: kevUrl });
    if (kev.requiredAction) claims.push({ k: 'kev_action', label: 'Action requise (CISA)', v: `${kev.requiredAction} — échéance fédérale : ${kev.dueDate ?? 'non communiquée'}`, st: 'confirme', src: 'CISA KEV', url: kevUrl });
  }
  claims.push({ k: 'patch', label: 'Correctif', v: patchRef ? 'Correctif référencé par NVD' : advisory ? 'Avis éditeur référencé, correctif non confirmé par NVD' : 'Non documenté par les sources', st: patchRef ? 'confirme' : 'signale', src: 'NVD', url: vuln.patch_url ?? nvdUrl });

  const alert = pubs.find(p => p.source_id === 'certfr-alerte');
  const status = kev || alert ? 'confirme' : pubs.some(p => p.kind === 'officiel' || p.kind === 'editeur') ? 'confirme' : 'signale';
  const status_reason = kev ? 'Exploitation confirmée : inscription au catalogue CISA KEV.' : alert ? 'Alerte publiée par le CERT-FR.' : status === 'confirme' ? 'Vulnérabilité confirmée par un avis officiel ou éditeur ; exploitation non documentée.' : 'Signalée par une source, non confirmée par une autorité.';
  let severity = 'inconnue', why = 'Aucun score CVSS publié.';
  const s = vuln.cvss;
  if (s != null) { severity = s >= 9 ? 'critique' : s >= 7 ? 'elevee' : s >= 4 ? 'moyenne' : 'faible'; why = `CVSS ${s}.`; }
  if (kev) { if (severity !== 'critique') severity = 'elevee'; why += ' Exploitation active documentée (KEV).'; if (kev.knownRansomwareCampaignUse === 'Known') { severity = 'critique'; why += ' Usage connu par des rançongiciels.'; } }
  return {
    claims, status, status_reason, severity, severity_reason: why.trim(), type: kev ? 'vuln_exploitee' : 'vuln',
    title: kev ? `${kev.vendorProject} ${kev.product} — ${kev.vulnerabilityName.replace(new RegExp(`^${kev.vendorProject}\\s+`, 'i'), '')}` : (alert?.title ?? pubs[0]?.title ?? (desc ? excerpt(desc, 110) : ev.id)),
    disclosed_at: nvd?.published ? new Date(nvd.published + (/[zZ+]/.test(nvd.published.slice(19)) ? '' : 'Z')).toISOString() : null,
    data: { vuln, defense: kev?.requiredAction ? [kev.requiredAction] : [] },
  };
}

// Recalcule une fiche à partir de ses publications ; crée une version si les affirmations ont changé.
export async function rebuild(id, now = new Date()) {
  const ev = await one('SELECT * FROM events WHERE id=$1', [id]);
  if (!ev || ev.fictif) return false;
  const pubs = await q(`SELECT p.*, s.name AS src, s.kind, s.org FROM publications p JOIN sources s ON s.id=p.source_id
                        WHERE p.event_id=$1 ORDER BY COALESCE(p.published_at,p.collected_at), p.id`, [id]);
  if (!pubs.length && ev.kind !== 'vuln') return false;
  const incident = ev.kind === 'incident';
  // pays, secteurs et groupe : titres et résumés seulement ; identifiants CVE et ATT&CK : texte complet
  const full = classify(pubs.map(p => `${p.title}. ${p.summary ?? ''} ${p.body ?? ''}`).join(' '));
  const c = { ...classify(pubs.map(p => `${p.title}. ${p.summary ?? ''}`).join(' ')), cves: full.cves, attack: full.attack, type: ev.type };
  // une source nationale (DGSSI, presse marocaine…) rattache d'office ses publications à son pays
  for (const code of new Set(pubs.map(p => SOURCES.find(s => s.id === p.source_id)?.country).filter(Boolean))) {
    const k = COUNTRIES.find(x => x[0] === code);
    if (k && !c.countries.some(x => x.code === code)) c.countries = [...c.countries, { code, name: k[1], lat: k[2], lon: k[3] }];
  }
  let out = { claims: [], data: {} };
  if (ev.kind === 'vuln') out = await buildVuln(ev, pubs);

  for (const p of pubs) p.st = pubStatus(p, incident);
  const claims = out.claims;
  if (c.countries.length) claims.push({ k: 'pays', label: 'Pays mentionnés', v: c.countries.map(x => x.name).join(', '), st: 'signale', src: 'sources de la fiche' });
  if (incident && c.sectors.length) claims.push({ k: 'secteur', label: 'Secteurs mentionnés', v: c.sectors.join(', '), st: 'signale', src: 'sources de la fiche' });
  let actor = null;
  if (incident && c.actor) {
    const p = pubs.find(x => ACTORS.test(`${x.title} ${x.summary ?? ''} ${x.body ?? ''}`)) ?? pubs[0];
    const claimed = RX.claim.test(`${p.title} ${p.summary ?? ''}`);
    const confidence = claimed ? 'revendication non vérifiée' : p.kind === 'officiel' ? 'attribution par une autorité publique' : p.kind === 'editeur' || p.kind === 'recherche' ? 'attribution avancée par un éditeur ou une équipe de recherche' : 'mention rapportée par la presse, non corroborée';
    actor = { name: c.actor, confidence, source: p.src, url: p.url };
    claims.push({ k: 'acteur', label: 'Groupe cité', v: `${c.actor} — ${confidence}`, st: claimed ? 'revendique' : 'signale', src: p.src, url: p.url, pub: p.id });
  }
  if (ev.kind !== 'vuln' && c.cves.length) claims.push({ k: 'cve', label: 'CVE citées', v: c.cves.slice(0, 12).join(', '), st: 'signale', src: 'sources de la fiche' });
  for (const p of pubs.slice(0, 40)) claims.push({ k: `pub:${p.id}`, label: `Publication — ${p.src}`, v: p.title, st: p.st, src: p.src, url: p.url, pub: p.id });

  let status, status_reason, severity, severity_reason;
  if (ev.kind === 'vuln') ({ status, status_reason, severity, severity_reason } = out);
  else {
    const top = pubs.reduce((a, p) => (RANK[p.st] > RANK[a.st] ? p : a), pubs[0]);
    status = top.st;
    const n = uniq(pubs.map(p => p.source_id)).length;
    status_reason = status === 'conteste' ? `Version contestée ou démentie selon ${top.src}.`
      : status === 'confirme' ? (top.kind === 'officiel' ? `Publication d’une autorité publique : ${top.org}.` : top.kind === 'editeur' && !incident ? `Publication de l’éditeur : ${top.org}.` : `Confirmation rapportée par ${top.src}.`)
      : status === 'revendique' ? `Revendication rapportée par ${top.src}, sans confirmation de l’organisation visée.`
      : n > 1 ? `Signalé par ${n} sources, sans confirmation officielle.` : `Signalé par une seule source : ${top.src}.`;
    const sensitive = c.type === 'infra' || c.sectors.some(s => ['Santé', 'Énergie', 'Eau'].includes(s));
    severity = !incident ? 'inconnue' : status === 'confirme' ? (sensitive ? 'elevee' : 'moyenne') : 'inconnue';
    severity_reason = !incident ? 'Sans objet pour ce type de publication.' : severity === 'inconnue' ? 'Gravité non évaluée : l’impact n’est pas confirmé par les sources.' : sensitive ? 'Incident confirmé touchant un secteur essentiel.' : 'Incident confirmé ; ampleur à préciser selon les sources.';
  }

  const dated = pubs.map(p => p.published_at).filter(Boolean).sort();
  const data = {
    ...out.data, countries: c.countries, sectors: incident ? c.sectors : [], techs: uniq([...(out.data.vuln ? [out.data.vuln.vendor, out.data.vuln.product].filter(Boolean) : []), ...c.techs]),
    cves: ev.kind === 'vuln' ? [ev.id] : c.cves.slice(0, 12), actor, attack: c.attack,
    summary: pubs.find(p => p.summary)?.summary ?? out.data.vuln?.description ?? null,
    summary_src: pubs.find(p => p.summary)?.src ?? (out.data.vuln?.description ? 'NVD' : null),
  };
  const hash = sha(JSON.stringify(claims.map(x => [x.k, x.h ?? x.v, x.st])));
  const last = await one('SELECT n, hash, claims FROM event_versions WHERE event_id=$1 ORDER BY n DESC LIMIT 1', [id]);
  const changed = !last || last.hash !== hash;
  if (changed) {
    const d = last ? diff(last.claims, claims) : [];
    await q('INSERT INTO event_versions (event_id,n,at,note,hash,claims) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, (last?.n ?? 0) + 1, now, last ? noteOf(d) : 'Création de la fiche', hash, JSON.stringify(claims)]);
  }
  await q(`UPDATE events SET type=$2, title=$3, status=$4, status_reason=$5, severity=$6, severity_reason=$7, disclosed_at=$8, data=$9, updated_at=CASE WHEN $10 THEN $11 ELSE updated_at END WHERE id=$1`,
    [id, out.type ?? (ev.kind === 'vuln' ? ev.type : c.type), out.title ?? ev.title, status, status_reason, severity, severity_reason,
      out.disclosed_at ?? dated[0] ?? null, JSON.stringify(data), changed, now]);
  return changed;
}
