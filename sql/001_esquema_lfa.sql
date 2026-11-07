-- LFA / Modelo relacional PostgreSQL, preparado para implementar en una futura base administrada.
-- NO ejecutado ni desplegado. No incorpora credenciales ni políticas de acceso público.
-- Todas las fuentes y fechas de corte quedan registradas para auditar estadísticas.

create table if not exists lfa_sources (
  id text primary key,
  title text not null,
  url text,
  last_checked_at timestamptz,
  evidence_type text not null check(evidence_type in ('owner_confirmed','historical_document','sleeper_api','legacy_unverified','editorial')),
  notes text
);

create table if not exists lfa_franchises (
  id text primary key,
  official_name text not null unique,
  manager_name text not null,
  logo_path text,
  inception_year smallint,
  manager_stable boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists lfa_aliases (
  id bigint generated always as identity primary key,
  franchise_id text not null references lfa_franchises(id) on delete cascade,
  label text not null,
  label_kind text not null check(label_kind in ('team_name','manager','sleeper_user')),
  unique(franchise_id,label,label_kind)
);

create table if not exists lfa_seasons (
  year smallint primary key check(year>=2018),
  era text not null check(era in ('prehistoria','profesional')),
  official boolean not null,
  champion_franchise_id text references lfa_franchises(id),
  champion_name_as_recorded text not null,
  runner_up_franchise_id text references lfa_franchises(id),
  runner_up_name_as_recorded text,
  champion_final_score numeric(9,2),
  runner_up_final_score numeric(9,2),
  story text,
  source_id text references lfa_sources(id),
  validation text not null default 'pending_review' check(validation in ('verified','pending_review','rejected'))
);

create table if not exists lfa_standings (
  season_year smallint not null references lfa_seasons(year) on delete cascade,
  franchise_id text not null references lfa_franchises(id),
  rank smallint,
  wins smallint,
  losses smallint,
  ties smallint default 0,
  points_for numeric(12,2),
  points_against numeric(12,2),
  source_id text references lfa_sources(id),
  validation text not null default 'pending_review' check(validation in ('verified','pending_review','rejected')),
  primary key(season_year,franchise_id)
);

create table if not exists lfa_games (
  id bigint generated always as identity primary key,
  season_year smallint not null references lfa_seasons(year),
  week smallint not null check(week>=1 and week<=22),
  phase text not null check(phase in ('regular','playoffs','final','other')),
  franchise_a_id text not null references lfa_franchises(id),
  franchise_b_id text not null references lfa_franchises(id),
  score_a numeric(9,2),
  score_b numeric(9,2),
  sleeper_matchup_id text,
  source_id text references lfa_sources(id),
  validation text not null default 'pending_review' check(validation in ('verified','pending_review','rejected')),
  check(franchise_a_id<>franchise_b_id)
);
create index if not exists idx_lfa_games_season_week on lfa_games(season_year,week);
create index if not exists idx_lfa_games_a on lfa_games(franchise_a_id);
create index if not exists idx_lfa_games_b on lfa_games(franchise_b_id);

create table if not exists lfa_sleeper_mappings (
  season_year smallint not null,
  sleeper_league_id text not null,
  sleeper_roster_id integer not null,
  sleeper_user_id text,
  franchise_id text not null references lfa_franchises(id),
  verified_by_commissioner boolean not null default false,
  verified_at timestamptz,
  primary key(season_year,sleeper_league_id,sleeper_roster_id),
  unique(season_year,sleeper_league_id,franchise_id)
);

create table if not exists lfa_drafts (
  id text primary key,
  season_year smallint not null,
  sleeper_draft_id text,
  draft_type text,
  source_id text references lfa_sources(id)
);
create table if not exists lfa_draft_picks (
  draft_id text not null references lfa_drafts(id) on delete cascade,
  pick_number integer not null,
  round integer,
  franchise_id text references lfa_franchises(id),
  player_id text,
  player_name text,
  source_id text references lfa_sources(id),
  primary key(draft_id,pick_number)
);

create table if not exists lfa_events (
  id text primary key,
  season_year smallint,
  event_date date,
  kind text not null check(kind in ('trade','waiver','draft','award','milestone','note','other')),
  headline text not null,
  body text,
  franchise_id text references lfa_franchises(id),
  source_id text references lfa_sources(id),
  validation text not null default 'pending_review' check(validation in ('verified','pending_review','rejected'))
);

create table if not exists lfa_stories (
  id text primary key,
  title text not null,
  body text not null,
  tone text not null check(tone in ('statistical','editorial','folklore')),
  published_at timestamptz,
  source_id text references lfa_sources(id),
  public boolean not null default false
);

-- Legacy snapshot: no combinar con las estadísticas vigentes antes de una auditoría.
create table if not exists lfa_legacy_h2h_snapshots (
  id bigint generated always as identity primary key,
  source_id text not null references lfa_sources(id),
  as_of_date date,
  franchise_a_id text references lfa_franchises(id),
  franchise_b_id text references lfa_franchises(id),
  wins_a integer,
  wins_b integer,
  playoff_wins_a integer,
  playoff_wins_b integer,
  validation text not null default 'pending_review' check(validation in ('verified','pending_review','rejected')),
  check(franchise_a_id<>franchise_b_id)
);

-- Siguiente etapa: decidir autenticación, RLS y permisos de escritura antes de exponer una API
-- Nunca habilitar inserciones públicas a tablas históricas y editoriales.
