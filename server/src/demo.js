// Scénario de démonstration ENTIÈREMENT FICTIF (organisations, groupe, chiffres et liens inventés).
// Il sert à montrer la comparaison de versions ; il est marqué fictif=true et affiché comme tel partout.
import { q } from './db.js';
import { sha } from './parse.js';

const U = 'https://exemple.invalid/fictif/';
const S1 = { src: 'Orvane Logiciels (fictif) — communiqué n° 1', url: U + 'orvane/communique-1' };
const S2 = { src: 'Orvane Logiciels (fictif) — communiqué n° 2', url: U + 'orvane/communique-2' };
const S3 = { src: 'Orvane Logiciels (fictif) — communiqué n° 3', url: U + 'orvane/communique-3' };
const G = { src: 'Site de fuite du groupe « Cendre Noire » (fictif)', url: U + 'cendre-noire/annonce' };
const M = { src: 'CyberDépêche (média fictif)', url: U + 'cyberdepeche/article' };

const c = (k, label, v, st, s, extra = {}) => ({ k, label, v, st, ...s, ...extra });

export async function seedDemo(now = new Date()) {
  const t = h => new Date(now - h * 36e5).toISOString();
  const base = [
    c('nature', 'Nature de l’incident', 'Intrusion dans l’environnement de support client', 'confirme', S1, { basis: 'Communiqué n° 1, premier paragraphe' }),
    c('produit', 'Produit concerné', 'OrvaneSync (service hébergé)', 'confirme', S1),
  ];
  const v1 = [...base,
    c('donnees', 'Données clients', 'Aucune donnée client touchée à ce stade', 'confirme', S1, { basis: 'Communiqué n° 1 — formulation de l’éditeur, enquête en cours' }),
    c('sauvegardes', 'Sauvegardes', 'Non affectées selon l’éditeur', 'confirme', S1, { basis: 'Communiqué n° 1' }),
    c('date_intrusion', 'Date de l’intrusion', 'Non communiquée', 'signale', S1),
    c('perimetre', 'Clients concernés', 'Non communiqué', 'signale', S1),
  ];
  const v2 = [...v1,
    c('impact#groupe', 'Volume de données — version du groupe', '1,2 To de données, « tous les clients »', 'revendique', G, { topic: 'impact', basis: 'Annonce sur le site de fuite ; aucun échantillon vérifié' }),
    c('acteur', 'Groupe cité', 'Cendre Noire — revendication non vérifiée', 'revendique', G),
    c('reprise', 'Reprise par la presse', 'CyberDépêche reprend la revendication sans élément nouveau', 'signale', M, { basis: 'L’article cite uniquement le site de fuite : une seule source initiale' }),
  ];
  const v3 = [...base,
    c('sauvegardes', 'Sauvegardes', 'TOUCHÉES : les sauvegardes hébergées du 3 au 9 du mois ont été consultées et en partie supprimées', 'confirme', S2, { basis: 'Communiqué n° 2, section « Ce que nous avons appris »' }),
    c('date_intrusion', 'Date de l’intrusion', 'Premier accès établi 11 jours avant la détection', 'confirme', S2, { basis: 'Communiqué n° 2, chronologie' }),
    c('perimetre', 'Clients concernés', '41 clients notifiés individuellement', 'confirme', S2, { basis: 'Communiqué n° 2' }),
    c('vecteur', 'Vecteur initial', 'Compte de support compromis, sans authentification multifacteur', 'confirme', S2, { basis: 'Communiqué n° 2' }),
    ...v2.slice(-3),
  ];
  const v4 = [...v3.filter(x => x.k !== 'reprise'),
    c('impact#editeur', 'Volume de données — version de l’éditeur', '310 Go, limités à 41 clients', 'confirme', S3, { topic: 'impact', basis: 'Communiqué n° 3 : journaux de sortie réseau analysés par un prestataire' }),
    c('impact#presse', 'Volume de données — version de la presse', 'Environ 120 clients, selon une source anonyme', 'conteste', M, { topic: 'impact', basis: 'Source anonyme unique, démentie par l’éditeur dans le communiqué n° 3' }),
    c('mesures', 'Mesures annoncées', 'Rotation de toutes les clés d’API ; MFA imposée aux comptes de support', 'confirme', S3),
  ];
  const versions = [
    [72, 'Création de la fiche — l’éditeur confirme une intrusion', v1],
    [48, 'Revendication publiée par un groupe ; reprise par un média', v2],
    [26, 'NOUVEAU FAIT : les sauvegardes ont été touchées · Retrait : « aucune donnée client touchée »', v3],
    [5, 'Versions contradictoires sur l’ampleur · mesures annoncées', v4],
  ];
  const pubs = [
    { id: -1, source_id: 'fictif', src: S1.src, kind: 'editeur', title: 'Incident de sécurité sur notre environnement de support', url: S1.url, published_at: t(72), collected_at: t(71.6), summary: 'Communiqué fictif : l’éditeur confirme une intrusion et indique que les sauvegardes ne sont pas affectées.' },
    { id: -2, source_id: 'fictif', src: G.src, kind: 'presse', title: 'Annonce de revendication', url: G.url, published_at: t(49), collected_at: t(48), summary: 'Revendication fictive : 1,2 To de données annoncés, sans preuve vérifiable.' },
    { id: -3, source_id: 'fictif', src: M.src, kind: 'presse', title: 'Un groupe affirme avoir vidé les serveurs d’Orvane', url: M.url, published_at: t(48.5), collected_at: t(48), derived_from: -2, summary: 'Article fictif reprenant la revendication.' },
    { id: -4, source_id: 'fictif', src: S2.src, kind: 'editeur', title: 'Mise à jour : nos sauvegardes ont été touchées', url: S2.url, published_at: t(26.4), collected_at: t(26), summary: 'Communiqué fictif : l’éditeur corrige sa première déclaration, les sauvegardes hébergées ont été consultées et en partie supprimées.' },
    { id: -5, source_id: 'fictif', src: S3.src, kind: 'editeur', title: 'Point d’étape : périmètre et mesures', url: S3.url, published_at: t(5.3), collected_at: t(5), summary: 'Communiqué fictif : 310 Go et 41 clients selon l’éditeur, qui dément le chiffre de 120 clients.' },
  ];
  const data = {
    countries: [], sectors: ['Technologie'], techs: ['OrvaneSync'], cves: [],
    actor: { name: 'Cendre Noire (fictif)', confidence: 'revendication non vérifiée', source: G.src, url: G.url },
    attack: ['T1078', 'T1490', 'T1567'],
    summary: 'Scénario fictif. Un éditeur confirme une intrusion ; une mise à jour révèle ensuite que ses sauvegardes ont été touchées, puis les sources se contredisent sur l’ampleur de la fuite.',
    summary_src: 'Scénario de démonstration',
    defense: [
      'Vérifier l’intégrité des sauvegardes hébergées chez le fournisseur et réaliser un test de restauration isolé.',
      'S’assurer qu’une copie hors ligne ou immuable existe et qu’elle est antérieure au premier accès.',
      'Renouveler les clés d’API et secrets partagés avec le fournisseur.',
      'Examiner les journaux d’accès des comptes de support du fournisseur sur les 30 derniers jours.',
      'Imposer l’authentification multifacteur sur les accès de tierce maintenance.',
    ],
    demo_pubs: pubs,
  };
  await q(`INSERT INTO events (id,kind,type,fictif,title,status,status_reason,severity,severity_reason,incident_date,disclosed_at,updated_at,first_seen_at,data)
           VALUES ('demo-fictif','incident','fuite',true,$1,'confirme',$2,'elevee',$3,$4,$5,$6,$5,$7)
           ON CONFLICT (id) DO UPDATE SET title=$1, status_reason=$2, severity_reason=$3, incident_date=$4, disclosed_at=$5, updated_at=$6, first_seen_at=$5, data=$7`,
    ['[FICTIF] Orvane Logiciels : intrusion confirmée, sauvegardes touchées', 'Scénario fictif : confirmé par les communiqués (inventés) de l’éditeur.',
      'Scénario fictif : sauvegardes touchées et données de 41 clients.', t(72 + 11 * 24), t(72), t(5), JSON.stringify(data)]);
  await q(`DELETE FROM event_versions WHERE event_id='demo-fictif'`);
  let n = 0;
  for (const [h, note, claims] of versions) await q(`INSERT INTO event_versions (event_id,n,at,note,hash,claims) VALUES ('demo-fictif',$1,$2,$3,$4,$5)`, [++n, t(h), note, sha(JSON.stringify(claims)), JSON.stringify(claims)]);
}
