-- SENTINEL CYBER — schéma PostgreSQL (idempotent)

CREATE TABLE IF NOT EXISTS sources (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  org          text NOT NULL,
  kind         text NOT NULL,          -- officiel | editeur | recherche | presse | donnees
  url          text NOT NULL,
  site         text,
  enabled      boolean NOT NULL DEFAULT true,
  last_attempt timestamptz,
  last_success timestamptz,            -- dernière collecte réussie
  last_error   text,
  last_item_at timestamptz,            -- date de la donnée la plus récente reçue
  items        integer NOT NULL DEFAULT 0
);

CREATE SEQUENCE IF NOT EXISTS event_seq START 1000;

CREATE TABLE IF NOT EXISTS events (
  id            text PRIMARY KEY,
  kind          text NOT NULL,         -- incident | vuln | actu
  type          text NOT NULL,
  fictif        boolean NOT NULL DEFAULT false,
  title         text NOT NULL,
  status        text NOT NULL,         -- confirme | signale | revendique | conteste
  status_reason text,
  severity      text NOT NULL DEFAULT 'inconnue',
  severity_reason text,
  incident_date timestamptz,           -- date de l'incident (si connue)
  disclosed_at  timestamptz,           -- date de divulgation publique
  updated_at    timestamptz NOT NULL,  -- dernière mise à jour de la fiche
  first_seen_at timestamptz NOT NULL,
  tokens        text[] NOT NULL DEFAULT '{}',
  data          jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS events_updated ON events (updated_at DESC);

CREATE TABLE IF NOT EXISTS publications (
  id           serial PRIMARY KEY,
  source_id    text NOT NULL REFERENCES sources(id),
  guid         text NOT NULL,
  url          text NOT NULL,
  title        text NOT NULL,
  summary      text,
  body         text,
  lang         text,
  published_at timestamptz,            -- date annoncée par la source (peut manquer)
  collected_at timestamptz NOT NULL,   -- date d'apparition dans SENTINEL
  event_id     text REFERENCES events(id) ON DELETE SET NULL,
  derived_from integer,                -- publication d'origine reprise par celle-ci
  links        text[] NOT NULL DEFAULT '{}',
  UNIQUE (source_id, guid)
);
CREATE INDEX IF NOT EXISTS publications_event ON publications (event_id);
CREATE INDEX IF NOT EXISTS publications_url ON publications (url);

-- Historique complet : une ligne par version publiée d'une fiche.
CREATE TABLE IF NOT EXISTS event_versions (
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  n        integer NOT NULL,
  at       timestamptz NOT NULL,
  note     text,
  hash     text NOT NULL,
  claims   jsonb NOT NULL,
  PRIMARY KEY (event_id, n)
);

CREATE TABLE IF NOT EXISTS vulns (
  cve        text PRIMARY KEY,
  kev        jsonb,
  nvd        jsonb,
  epss       real,
  epss_pct   real,
  epss_date  text,
  nvd_at     timestamptz,
  wanted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
  id       serial PRIMARY KEY,
  started  timestamptz NOT NULL,
  finished timestamptz,
  report   jsonb
);
