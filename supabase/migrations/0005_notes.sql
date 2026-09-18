-- ============================================================
-- 0005 · 메모 · 회고 · 수치 기록
-- ============================================================

do $ident$ begin
  create type note_kind as enum ('quick', 'note', 'idea', 'meeting', 'retro');
exception when duplicate_object then null; end $ident$;

create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role_id    uuid references public.roles(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  event_id   uuid references public.events(id) on delete set null,
  title      text,
  body       text not null default '',
  kind       note_kind not null default 'quick',
  tags       text[] not null default '{}',
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.own_rows('public.notes');
select public.auto_touch('public.notes');
create index if not exists notes_recent_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_tags_idx   on public.notes using gin (tags);

-- 한국어 검색.
--
-- Postgres 에 한국어 형태소 사전이 없으므로 to_tsvector 만으로는
-- "맛집을" 로 저장된 글이 "맛집" 검색에 안 잡힌다. 조사가 붙기 때문이다.
-- 그래서 trigram 을 주 검색 경로로 쓴다. 부분 일치가 되고 오타에도 강하다.
create index if not exists notes_search_idx
  on public.notes using gin ((coalesce(title, '') || ' ' || body) gin_trgm_ops);

-- ------------------------------------------------------------
-- journal_entries — 회고
-- ------------------------------------------------------------
do $ident$ begin
  create type journal_kind as enum ('daily', 'weekly', 'monthly');
exception when duplicate_object then null; end $ident$;

create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  kind       journal_kind not null default 'daily',
  mood       int check (mood between 1 and 5),
  energy     int check (energy between 1 and 5),
  highlights text,
  lowlights  text,
  gratitude  text,
  body       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date, kind)
);
select public.own_rows('public.journal_entries');
select public.auto_touch('public.journal_entries');

-- ------------------------------------------------------------
-- metric_logs — 체중 · 지출 · 매출 · 독서시간 · 라운딩 스코어…
--
-- 종류마다 테이블을 만들면 새 지표를 추가할 때마다 마이그레이션이 필요하고,
-- 그러면 결국 지표를 안 늘리게 된다. 한 테이블에 metric_key 로 받는다.
-- goals 의 진척도가 여기서 집계된다.
-- ------------------------------------------------------------
create table if not exists public.metric_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_id     uuid references public.roles(id) on delete set null,
  metric_key  text not null,
  value       numeric not null,
  unit        text,
  recorded_at timestamptz not null default now(),
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
select public.own_rows('public.metric_logs');
select public.auto_touch('public.metric_logs');
create index if not exists metric_logs_key_idx on public.metric_logs (user_id, metric_key, recorded_at desc);
