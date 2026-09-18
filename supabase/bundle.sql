-- ============================================================
-- My Identity — 전체 설치 SQL (자동 생성 · 직접 고치지 말 것)
-- 생성: scripts/bundle-sql.sh
--
-- Supabase SQL Editor 에 통째로 붙여넣고 Run.
-- 여러 번 실행해도 안전하다.
--
-- 먼저 앱에 한 번 로그인해서 계정이 만들어져 있어야 시드가 붙는다.
-- ============================================================

-- ┌─────────────────────────────────────────────────────────
-- │ 0001_foundation.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0001 · 기반: 확장, 공통 함수, 프로필
-- ============================================================

create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- updated_at 자동 갱신
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 테이블 하나를 "내 것만 보이는" 상태로 만드는 헬퍼.
--
-- 모든 테이블 생성 직후 반드시 호출한다. RLS 정책을 각 마이그레이션에
-- 손으로 적으면 언젠가 빠뜨리고, 빠뜨린 테이블은 전부 공개된다.
-- 테이블 추가와 정책 부여를 한 호출로 묶어서 그 실수를 구조적으로 막는다.
-- ------------------------------------------------------------
create or replace function public.own_rows(tbl regclass)
returns void
language plpgsql
as $$
declare
  t text := tbl::text;
begin
  execute format('alter table %s enable row level security', t);
  execute format('drop policy if exists own_rows on %s', t);
  execute format(
    'create policy own_rows on %s for all to authenticated
       using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  execute format('create index if not exists %s_user_id_idx on %s (user_id)',
                 replace(replace(t, 'public.', ''), '.', '_'), t);
end;
$$;

-- 테이블에 updated_at 트리거를 건다.
create or replace function public.auto_touch(tbl regclass)
returns void
language plpgsql
as $$
declare
  t text := tbl::text;
  n text := replace(replace(tbl::text, 'public.', ''), '.', '_');
begin
  execute format('drop trigger if exists %s_touch on %s', n, t);
  execute format('create trigger %s_touch before update on %s
                    for each row execute function public.touch_updated_at()', n, t);
end;
$$;

-- ------------------------------------------------------------
-- profiles — auth.users 1:1
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  user_id       uuid generated always as (id) stored,
  email         text,
  display_name  text,
  timezone      text not null default 'Asia/Seoul',
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
select public.auto_touch('public.profiles');

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ┌─────────────────────────────────────────────────────────
-- │ 0002_identity.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0002 · Identity Core (Layer 3)
--   가치 · 역할 · 목표 · 추구미
-- ============================================================

-- ------------------------------------------------------------
-- roles — 삶을 나누는 축. 색이 전 앱에서 공통으로 쓰인다.
-- ------------------------------------------------------------
create table if not exists public.roles (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text not null,
  description          text,
  color                text not null default '#3A7CA5',
  icon                 text,
  weekly_target_hours  numeric,
  active               boolean not null default true,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
select public.own_rows('public.roles');
select public.auto_touch('public.roles');
-- 같은 이름의 역할이 둘 있는 것은 의미가 없다. 이관 스크립트를 두 번
-- 돌렸을 때 조용히 중복되는 것을 막는 역할도 한다.
create unique index if not exists roles_name_uniq on public.roles (user_id, name);

-- ------------------------------------------------------------
-- core_values — 판단 기준. 회고 화면에 상시 노출된다.
-- (values 는 SQL 예약어라 core_values 로 둔다)
-- ------------------------------------------------------------
create table if not exists public.core_values (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
select public.own_rows('public.core_values');
select public.auto_touch('public.core_values');
create unique index if not exists core_values_title_uniq on public.core_values (user_id, title);

-- ------------------------------------------------------------
-- goals — 정량 목표. 연 → 분기 → 월 계층.
-- ------------------------------------------------------------
do $ident$ begin
  create type goal_horizon as enum ('life', 'year', 'quarter', 'month');
exception when duplicate_object then null; end $ident$;
do $ident$ begin
  create type goal_status  as enum ('active', 'done', 'dropped', 'paused');
exception when duplicate_object then null; end $ident$;

create table if not exists public.goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  role_id        uuid references public.roles(id) on delete set null,
  parent_id      uuid references public.goals(id) on delete set null,
  title          text not null,
  description    text,
  horizon        goal_horizon not null default 'quarter',
  period_start   date,
  period_end     date,
  metric_key     text,
  metric_target  numeric,
  metric_unit    text,
  status         goal_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
select public.own_rows('public.goals');
select public.auto_touch('public.goals');
create index if not exists goals_parent_idx on public.goals (parent_id);

-- metric_current 은 컬럼으로 두지 않는다. 손으로 갱신하는 숫자는 반드시
-- 방치되고, 방치된 진척도는 없는 것만 못하다. metric_logs 에서 집계한다.

-- ------------------------------------------------------------
-- aspirations — 추구미
--
-- goals 와 분리한 이유: 목표는 숫자로 끝나고 추구미는 증거로 쌓인다.
-- 수명 주기가 달라서 한 테이블에 두면 둘 다 어정쩡해진다.
-- ------------------------------------------------------------
do $ident$ begin
  create type aspiration_domain as enum
    ('space', 'routine', 'style', 'body', 'work', 'relationship', 'other');
exception when duplicate_object then null; end $ident$;
do $ident$ begin
  create type aspiration_status as enum ('active', 'achieved', 'archived');
exception when duplicate_object then null; end $ident$;
do $ident$ begin
  create type capture_cadence   as enum ('monthly', 'quarterly', 'off');
exception when duplicate_object then null; end $ident$;

create table if not exists public.aspirations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  role_id          uuid references public.roles(id) on delete set null,
  title            text not null,
  statement        text,
  description      text,
  domain           aspiration_domain not null default 'other',
  cover_url        text,
  status           aspiration_status not null default 'active',
  capture_cadence  capture_cadence not null default 'monthly',
  last_captured_at timestamptz,
  started_at       date not null default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
select public.own_rows('public.aspirations');
select public.auto_touch('public.aspirations');
create unique index if not exists aspirations_title_uniq on public.aspirations (user_id, title);

-- ------------------------------------------------------------
-- aspiration_refs — 레퍼런스 (되고 싶은 모습)
-- ------------------------------------------------------------
create table if not exists public.aspiration_refs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  aspiration_id  uuid not null references public.aspirations(id) on delete cascade,
  image_url      text,
  source_url     text,
  caption        text,

  -- why 는 not null 이다. 이미지만 모으면 핀터레스트가 되고, 핀터레스트는
  -- 아무것도 바꾸지 않는다. 소파를 고를 때 실제로 꺼내 쓰는 건 사진이 아니라
  -- "조명이 낮고 따뜻해서" 라는 이 문장이다.
  why            text not null,

  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint aspiration_refs_why_not_blank check (length(btrim(why)) > 0)
);
select public.own_rows('public.aspiration_refs');
select public.auto_touch('public.aspiration_refs');
create index if not exists aspiration_refs_aspiration_idx on public.aspiration_refs (aspiration_id, sort_order);

-- ------------------------------------------------------------
-- aspiration_evidence — 증거 (실제 내 모습)
--
-- 이 화면의 주인공. angle_key 로 같은 앵글끼리 묶어 Before/Now 를 만든다.
-- ------------------------------------------------------------
do $ident$ begin
  create type evidence_kind as enum ('photo', 'log', 'milestone');
exception when duplicate_object then null; end $ident$;

create table if not exists public.aspiration_evidence (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  aspiration_id  uuid not null references public.aspirations(id) on delete cascade,
  captured_on    date not null default current_date,
  kind           evidence_kind not null default 'photo',
  image_url      text,
  angle_key      text,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
select public.own_rows('public.aspiration_evidence');
select public.auto_touch('public.aspiration_evidence');
create index if not exists aspiration_evidence_timeline_idx
  on public.aspiration_evidence (aspiration_id, captured_on desc);
create index if not exists aspiration_evidence_angle_idx
  on public.aspiration_evidence (aspiration_id, angle_key, captured_on);


-- ┌─────────────────────────────────────────────────────────
-- │ 0003_work.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0003 · 프로젝트 · 할 일 · 습관
-- ============================================================

do $ident$ begin
  create type project_area   as enum ('business', 'personal', 'hobby');
exception when duplicate_object then null; end $ident$;
do $ident$ begin
  create type project_status as enum ('active', 'done', 'paused', 'dropped');
exception when duplicate_object then null; end $ident$;

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_id     uuid references public.roles(id) on delete set null,
  goal_id     uuid references public.goals(id) on delete set null,
  title       text not null,
  description text,
  area        project_area not null default 'personal',
  status      project_status not null default 'active',
  due_date    date,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
select public.own_rows('public.projects');
select public.auto_touch('public.projects');

-- ------------------------------------------------------------
-- tasks
--
-- 핵심 규약: title 외의 모든 것이 nullable 이고 기본 status 는 'inbox' 다.
-- 분류를 강요하는 순간 입력을 안 하게 되고, 입력을 안 하면 나머지가 전부
-- 무의미해진다. 정리는 나중에 해도 되고, 안 해도 시스템은 돌아간다.
-- ------------------------------------------------------------
do $ident$ begin
  create type task_status as enum ('inbox', 'todo', 'doing', 'done', 'dropped');
exception when duplicate_object then null; end $ident$;
do $ident$ begin
  create type task_energy as enum ('high', 'low');
exception when duplicate_object then null; end $ident$;

create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete set null,
  role_id       uuid references public.roles(id) on delete set null,
  title         text not null,
  notes         text,
  status        task_status not null default 'inbox',
  priority      int not null default 0 check (priority between 0 and 3),
  due_at        timestamptz,
  scheduled_for date,
  estimate_min  int,
  energy        task_energy,
  recurrence    jsonb,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint tasks_title_not_blank check (length(btrim(title)) > 0)
);
select public.own_rows('public.tasks');
select public.auto_touch('public.tasks');
create index if not exists tasks_today_idx   on public.tasks (user_id, scheduled_for) where status <> 'done';
create index if not exists tasks_due_idx     on public.tasks (user_id, due_at)        where status <> 'done';
create index if not exists tasks_inbox_idx   on public.tasks (user_id, created_at desc) where status = 'inbox';
create index if not exists tasks_project_idx on public.tasks (project_id);

-- 완료 시각을 앱이 아니라 DB 가 채운다. 여러 진입점(웹, 알림 액션, 크론)에서
-- 상태를 바꾸므로 한 곳에서 보장해야 한다.
create or replace function public.stamp_task_completion()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and coalesce(old.status, 'inbox') <> 'done' then
    new.completed_at = coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_stamp_completion on public.tasks;
create trigger tasks_stamp_completion
  before insert or update of status on public.tasks
  for each row execute function public.stamp_task_completion();

-- ------------------------------------------------------------
-- habits — 추구미에 연결된다. 스트릭이 곧 진척 신호다.
-- ------------------------------------------------------------
do $ident$ begin
  create type habit_cadence as enum ('daily', 'weekly', 'custom');
exception when duplicate_object then null; end $ident$;

create table if not exists public.habits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  role_id           uuid references public.roles(id) on delete set null,
  aspiration_id     uuid references public.aspirations(id) on delete set null,
  title             text not null,
  cadence           habit_cadence not null default 'daily',
  target_per_period int not null default 1,
  color             text,
  active            boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
select public.own_rows('public.habits');
select public.auto_touch('public.habits');
create unique index if not exists habits_title_uniq on public.habits (user_id, title);
create index if not exists habits_aspiration_idx on public.habits (aspiration_id);

create table if not exists public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  habit_id   uuid not null references public.habits(id) on delete cascade,
  logged_on  date not null default current_date,
  value      numeric not null default 1,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, logged_on)
);
select public.own_rows('public.habit_logs');
select public.auto_touch('public.habit_logs');
create index if not exists habit_logs_recent_idx on public.habit_logs (habit_id, logged_on desc);


-- ┌─────────────────────────────────────────────────────────
-- │ 0004_calendar.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0004 · 캘린더
--
-- 이 서비스가 일정의 원본(source of truth)이다. 구글 연동은 나중의
-- 선택적 미러링일 뿐이다. 일정이 이 DB 안에 있어야 맥락 서피싱이
-- 동작한다 — 외부 캘린더에만 있으면 "대전 출장 → 대전 맛집" 을
-- 만들 수 없다. 캘린더 소유는 편의가 아니라 구조 문제다.
-- ============================================================

do $ident$ begin
  create type event_source as enum ('local', 'google');
exception when duplicate_object then null; end $ident$;

create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  role_id          uuid references public.roles(id) on delete set null,
  project_id       uuid references public.projects(id) on delete set null,
  title            text not null,
  description      text,
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  all_day          boolean not null default false,

  location         text,
  -- region 은 서피싱 트리거의 매칭 키다. 자연어 입력에서 "대전 출장" 의
  -- '대전' 이 여기 들어가고, 이 값으로 컬렉션이 Today 에 올라온다.
  region           text,
  lat              double precision,
  lng              double precision,

  recurrence       jsonb,
  reminder_minutes int[] not null default '{30}',

  source           event_source not null default 'local',
  external_id      text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint events_title_not_blank check (length(btrim(title)) > 0),
  constraint events_time_order check (ends_at is null or ends_at >= starts_at)
);
select public.own_rows('public.events');
select public.auto_touch('public.events');

create index if not exists events_range_idx  on public.events (user_id, starts_at);
create index if not exists events_region_idx on public.events (user_id, region) where region is not null;
create unique index if not exists events_external_idx
  on public.events (user_id, source, external_id)
  where external_id is not null;


-- ┌─────────────────────────────────────────────────────────
-- │ 0005_notes.sql
-- └─────────────────────────────────────────────────────────
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


-- ┌─────────────────────────────────────────────────────────
-- │ 0006_collections.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0006 · 컬렉션 — 흩어진 자료 (맛집 · 골프장 · 읽을 책 …)
--
-- 글이 아니라 레코드로 저장한다. 글로 저장하면 필터 · 지도 · 미방문
-- 표시가 전부 불가능해지고, "읽으러 들어가야 하는 물건" 이 된다.
-- 매거진은 저장 형식이 아니라 보기 형식이다.
-- ============================================================

do $ident$ begin
  create type collection_kind as enum ('place', 'media', 'product', 'person', 'generic');
exception when duplicate_object then null; end $ident$;
do $ident$ begin
  create type collection_view as enum ('map', 'list', 'card', 'magazine');
exception when duplicate_object then null; end $ident$;
do $ident$ begin
  create type item_status     as enum ('wishlist', 'visited', 'owned', 'dropped');
exception when duplicate_object then null; end $ident$;

create table if not exists public.collections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  slug         text not null,
  name         text not null,
  description  text,
  icon         text,
  cover_url    text,
  kind         collection_kind not null default 'generic',

  -- 타입별 필드 정의. 입력 폼과 필터 UI 가 여기서 자동 생성된다.
  -- 새 컬렉션(와인, 장비, 영화…)이 생겨도 코드를 고칠 필요가 없다.
  --   { "fields": [
  --       { "key":"price_range", "label":"가격대", "type":"select",
  --         "options":["1만 이하","1~3만"], "filterable":true },
  --       { "key":"parking", "label":"주차", "type":"bool", "filterable":true } ]}
  schema       jsonb not null default '{"fields": []}',

  default_view collection_view not null default 'list',
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, slug)
);
select public.own_rows('public.collections');
select public.auto_touch('public.collections');

create table if not exists public.collection_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  collection_id     uuid not null references public.collections(id) on delete cascade,

  title             text not null,
  subtitle          text,
  summary           text,
  body              text,            -- 매거진 상세 페이지 본문 (Markdown)
  cover_url         text,
  images            text[] not null default '{}',
  tags              text[] not null default '{}',
  rating            numeric check (rating is null or rating between 0 and 5),
  status            item_status not null default 'wishlist',

  address           text,
  region            text,            -- events.region 과 매칭되는 서피싱 키
  lat               double precision,
  lng               double precision,
  url               text,

  data              jsonb not null default '{}',  -- collections.schema 의 값

  visited_at        timestamptz,
  last_surfaced_at  timestamptz,     -- 같은 항목을 반복 추천하지 않기 위해

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint collection_items_title_not_blank check (length(btrim(title)) > 0)
);
select public.own_rows('public.collection_items');
select public.auto_touch('public.collection_items');

create index if not exists collection_items_list_idx   on public.collection_items (collection_id, status);
create index if not exists collection_items_region_idx on public.collection_items (user_id, region) where region is not null;
create index if not exists collection_items_tags_idx   on public.collection_items using gin (tags);
create index if not exists collection_items_data_idx   on public.collection_items using gin (data);
create index if not exists collection_items_search_idx
  on public.collection_items using gin ((title || ' ' || coalesce(summary, '')) gin_trgm_ops);

-- 같은 곳을 여러 번 가면 기록이 쌓인다. "3번 갔고 평점이 오르는 중" 이 보인다.
create table if not exists public.collection_item_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_id    uuid not null references public.collection_items(id) on delete cascade,
  event_id   uuid references public.events(id) on delete set null,
  logged_on  date not null default current_date,
  rating     numeric check (rating is null or rating between 0 and 5),
  note       text,
  cost       numeric,
  photos     text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select public.own_rows('public.collection_item_logs');
select public.auto_touch('public.collection_item_logs');
create index if not exists collection_item_logs_item_idx on public.collection_item_logs (item_id, logged_on desc);

-- ------------------------------------------------------------
-- surfacing_rules — 맥락 서피싱
--
-- 이 서비스가 노션과 갈라지는 지점. 자료가 읽히기를 기다리지 않고
-- 일정 · 요일 · 위치에 맞춰 스스로 Today 에 올라온다.
--
-- trigger 예시:
--   {"type":"event_region",  "match":"대전", "item_status":"wishlist"}
--   {"type":"day_of_week",   "days":[6], "at":"08:00"}
--   {"type":"nearby",        "radius_km":5}
--   {"type":"stale",         "days_since_view":90}
-- ------------------------------------------------------------
create table if not exists public.surfacing_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  label         text,
  trigger       jsonb not null,
  priority      int not null default 0,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
select public.own_rows('public.surfacing_rules');
select public.auto_touch('public.surfacing_rules');


-- ┌─────────────────────────────────────────────────────────
-- │ 0007_notifications.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0007 · 비서 엔진 — 푸시 구독 · 알림 규칙 · 발송 이력
-- ============================================================

-- ------------------------------------------------------------
-- push_subscriptions — 기기별 1행 (폰 · 노트북 각각)
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (endpoint)
);
select public.own_rows('public.push_subscriptions');
select public.auto_touch('public.push_subscriptions');

-- ------------------------------------------------------------
-- notification_rules
-- ------------------------------------------------------------
do $ident$ begin
  create type notification_kind as enum (
    'morning_brief',      -- 07:30 아침 브리핑
    'event_reminder',     -- 일정 N분 전
    'habit_nudge',        -- 습관 미체크
    'evening_review',     -- 21:30 저녁 회고
    'weekly_review',      -- 일 09:00 주간 리뷰
    'evidence_capture',   -- 추구미 증거 사진 요청
    'aspiration_drift',   -- 루틴 이탈 → 레퍼런스 재노출
    'context_surface',    -- 맥락 서피싱
    'due_soon'            -- 마감 임박
  );
exception when duplicate_object then null; end $ident$;
do $ident$ begin
  create type notification_channel as enum ('webpush', 'email');
exception when duplicate_object then null; end $ident$;

create table if not exists public.notification_rules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       notification_kind not null,
  channel    notification_channel not null default 'webpush',
  -- 로컬 시각 "HH:MM". 크론은 UTC 로 돌지만 판단은 profiles.timezone 기준.
  at_local   text,
  days       int[],                       -- 0=일 … 6=토. null 이면 매일
  config     jsonb not null default '{}',
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);
select public.own_rows('public.notification_rules');
select public.auto_touch('public.notification_rules');

-- ------------------------------------------------------------
-- notifications — 발송 이력
--
-- reason 과 clicked_at 이 이 테이블의 목적이다.
-- reason: 모든 알림에 "왜 지금 이게 왔는지" 가 한 줄로 들어간다.
--         이유 없는 알림은 결국 전체 알림을 끄게 만든다.
-- clicked_at: 아무도 안 누르는 알림 종류를 찾아서 끄기 위해 쌓는다.
--         Phase 1 부터 쌓아야 한 달 뒤에 판단할 근거가 생긴다.
-- ------------------------------------------------------------
do $ident$ begin
  create type notification_status as enum ('queued', 'sent', 'failed', 'skipped');
exception when duplicate_object then null; end $ident$;

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          notification_kind not null,
  title         text not null,
  body          text,
  url           text,
  reason        text,
  status        notification_status not null default 'queued',
  error         text,
  -- 같은 규칙이 같은 날 두 번 발송되지 않게 막는 키. 예: 'morning_brief:2026-09-13'
  dedupe_key    text,
  sent_at       timestamptz,
  read_at       timestamptz,
  clicked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
select public.own_rows('public.notifications');
select public.auto_touch('public.notifications');
create unique index if not exists notifications_dedupe_idx
  on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists notifications_recent_idx on public.notifications (user_id, created_at desc);

-- ------------------------------------------------------------
-- 기본 알림 규칙 — 가입 즉시 비서가 동작해야 한다.
-- 설정 화면에 들어가서 규칙을 만들어야 알림이 온다면, 아무도 안 만든다.
-- ------------------------------------------------------------
create or replace function public.seed_default_notification_rules()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notification_rules (user_id, kind, at_local, days) values
    (new.id, 'morning_brief',    '07:30', null),
    (new.id, 'habit_nudge',      '12:00', null),
    (new.id, 'evening_review',   '21:30', null),
    (new.id, 'weekly_review',    '09:00', '{0}'),
    (new.id, 'evidence_capture', '10:00', null),
    (new.id, 'event_reminder',   null,    null),
    (new.id, 'context_surface',  '07:30', null),
    (new.id, 'due_soon',         null,    null)
  on conflict (user_id, kind) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.seed_default_notification_rules();


-- ┌─────────────────────────────────────────────────────────
-- │ 0008_storage.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0008 · 스토리지 — 증거 사진, 레퍼런스 이미지, 컬렉션 사진
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', false, 20971520,
  array['image/jpeg','image/png','image/webp','image/avif','image/heic','image/gif']
)
on conflict (id) do nothing;

-- 경로 규약: media/{user_id}/{domain}/{filename}
-- 첫 번째 폴더가 소유자 uuid 이므로 그것만으로 접근을 가른다.
drop policy if exists "own media read" on storage.objects;
create policy "own media read"
  on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own media insert" on storage.objects;
create policy "own media insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own media update" on storage.objects;
create policy "own media update"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own media delete" on storage.objects;
create policy "own media delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);


-- ┌─────────────────────────────────────────────────────────
-- │ 0009_goal_activity.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0009 · 방치 감지
--
-- 기한 없는 목표는 알림을 걸 근거가 없어서 목록 아래로 가라앉는다.
-- 노션의 17개가 전부 'Not started' 로 굳은 경로가 정확히 그것이다.
-- 마감 대신 "마지막 움직임"을 기준으로 한 번씩 물어본다.
-- ============================================================

alter table public.goals
  add column if not exists last_activity_at timestamptz not null default now(),
  -- 방치 알림을 며칠 침묵 후 보낼지. null 이면 이 목표는 묻지 않는다.
  add column if not exists stale_after_days int default 60;

create index if not exists goals_stale_idx on public.goals (user_id, last_activity_at)
  where status = 'active';

-- 목표 자체가 수정되면 움직인 것으로 본다.
-- 단, last_activity_at 을 명시적으로 지정한 UPDATE 는 존중한다. 그러지 않으면
-- 노션 이관 시 원본의 마지막 수정 시각을 넣을 수 없고, 옮기자마자 전부
-- "방금 움직인 목표"가 되어 방치 감지가 무력해진다.
create or replace function public.touch_goal_activity()
returns trigger
language plpgsql
as $$
begin
  new.last_activity_at = now();
  return new;
end;
$$;

drop trigger if exists goals_touch_activity on public.goals;
create trigger goals_touch_activity
  before update on public.goals
  for each row
  when (old.* is distinct from new.*
        and old.last_activity_at is not distinct from new.last_activity_at)
  execute function public.touch_goal_activity();

-- 지표가 기록되면 그 지표를 쓰는 목표가 움직인 것이다.
create or replace function public.touch_goal_by_metric()
returns trigger
language plpgsql
as $$
begin
  update public.goals
     set last_activity_at = now()
   where user_id = new.user_id
     and metric_key = new.metric_key
     and status = 'active';
  return new;
end;
$$;

drop trigger if exists metric_logs_touch_goal on public.metric_logs;
create trigger metric_logs_touch_goal
  after insert on public.metric_logs
  for each row execute function public.touch_goal_by_metric();

-- 목표에 걸린 프로젝트의 할 일이 완료되면 그 목표가 움직인 것이다.
create or replace function public.touch_goal_by_task()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and coalesce(old.status, 'inbox') <> 'done'
     and new.project_id is not null then
    update public.goals g
       set last_activity_at = now()
      from public.projects p
     where p.id = new.project_id
       and g.id = p.goal_id
       and g.status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_touch_goal on public.tasks;
create trigger tasks_touch_goal
  after update of status on public.tasks
  for each row execute function public.touch_goal_by_task();

-- 알림 종류 추가
alter type notification_kind add value if not exists 'goal_stale';


-- ┌─────────────────────────────────────────────────────────
-- │ 0010_today.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0010 · Today 스냅샷
--
-- Today 는 테이블마다 쿼리를 날리지 않고 한 번에 받아온다.
-- 폰에서 1.5초 안에 떠야 하고, 느리면 안 쓰게 된다.
-- ============================================================

-- ------------------------------------------------------------
-- 연속 일수. 오늘 체크했으면 오늘부터, 아니면 어제부터 거슬러 센다.
-- (오늘 아직 안 했다고 어제까지의 스트릭이 0이 되면 안 된다)
-- ------------------------------------------------------------
create or replace function public.habit_streak(p_habit uuid, p_as_of date)
returns int
language sql
stable
security invoker
as $$
  with anchor as (
    select p_as_of - (
      case when exists (
        select 1 from public.habit_logs
         where habit_id = p_habit and logged_on = p_as_of
      ) then 0 else 1 end
    ) as d
  ),
  runs as (
    select l.logged_on,
           ((row_number() over (order by l.logged_on desc)) - 1)::int as offset_n
      from public.habit_logs l, anchor a
     where l.habit_id = p_habit
       and l.logged_on <= a.d
  )
  select coalesce(count(*), 0)::int
    from runs r, anchor a
   where r.logged_on = a.d - r.offset_n;
$$;

-- ------------------------------------------------------------
-- Today 한 번에 받아오기
-- ------------------------------------------------------------
create or replace function public.today_snapshot(p_today date, p_tz text default 'Asia/Seoul')
returns jsonb
language plpgsql
stable
security invoker
as $$
declare
  uid   uuid := auth.uid();
  from_ts timestamptz := (p_today::text || ' 00:00:00')::timestamp at time zone p_tz;
  to_ts   timestamptz := ((p_today + 1)::text || ' 00:00:00')::timestamp at time zone p_tz;
  result jsonb;
begin
  if uid is null then
    return jsonb_build_object('error', 'unauthenticated');
  end if;

  select jsonb_build_object(
    'today', p_today,

    'roles', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.sort_order, r.name)
        from public.roles r
       where r.user_id = uid and r.active
    ), '[]'::jsonb),

    -- 오늘 일정. 하나도 없으면 다음 일정 하나를 대신 보여준다.
    -- "오늘 일정 없음"만 뜨는 화면은 아무것도 알려주지 않는다.
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.all_day desc, e.starts_at)
        from public.events e
       where e.user_id = uid
         and e.starts_at >= from_ts and e.starts_at < to_ts
    ), '[]'::jsonb),

    'next_event', (
      select to_jsonb(e)
        from public.events e
       where e.user_id = uid and e.starts_at >= to_ts
       order by e.starts_at
       limit 1
    ),

    -- 오늘 할 일 + 마감이 지난 것. 오늘 배정하지 않았어도 마감이 지났으면
    -- 오늘의 문제다.
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.priority desc, t.due_at nulls last, t.created_at)
        from public.tasks t
       where t.user_id = uid
         and t.status in ('todo', 'doing')
         and (t.scheduled_for <= p_today or t.due_at < to_ts)
    ), '[]'::jsonb),

    'inbox_count', (
      select count(*) from public.tasks
       where user_id = uid and status = 'inbox'
    ),

    'habits', coalesce((
      select jsonb_agg(
               to_jsonb(h)
               || jsonb_build_object(
                    'done_today', exists (
                      select 1 from public.habit_logs hl
                       where hl.habit_id = h.id and hl.logged_on = p_today),
                    'streak', public.habit_streak(h.id, p_today))
               order by h.sort_order, h.title)
        from public.habits h
       where h.user_id = uid and h.active
    ), '[]'::jsonb),

    -- ── 본지 피드 ────────────────────────────────────────────
    -- 모아둔 자료가 Today 아래에 사진 기사로 깔린다. 목록을 찾아
    -- 들어가야 보이는 자료는 결국 안 보게 되고, 그게 노션에서
    -- 일어난 일이다. 표지 아래로 흐르면 매일 눈에 들어온다.
    'feed', coalesce((
      select jsonb_agg(f order by f.sort_order, f.name)
      from (
        select c.id, c.slug, c.name, c.icon, c.cover_url, c.kind, c.sort_order,
               (select count(*) from public.collection_items ci
                 where ci.collection_id = c.id) as total,
               (select count(*) from public.collection_items ci
                 where ci.collection_id = c.id and ci.status = 'wishlist') as unseen,
               greatest(
                 (select max(ci.created_at) from public.collection_items ci
                   where ci.collection_id = c.id),
                 (select max(cl.logged_on)::timestamptz
                    from public.collection_item_logs cl
                    join public.collection_items ci2 on ci2.id = cl.item_id
                   where ci2.collection_id = c.id)
               ) as last_active
          from public.collections c
         where c.user_id = uid
      ) f
    ), '[]'::jsonb),

    -- ── 낱장 기사 ────────────────────────────────────────────
    -- 피드는 컬렉션(서랍)을 보여준다. 서랍만 늘어놓으면 결국 열어보지
    -- 않게 되므로, 서랍 안의 낱장 몇 개를 지면에 직접 깐다.
    -- 사진이 있는 것 · 아직 안 해본 것 · 최근에 넣은 것 순.
    'highlights', coalesce((
      select jsonb_agg(h order by h.rank, h.created_at desc)
      from (
        select ci.id, ci.title, ci.subtitle, ci.summary, ci.cover_url,
               ci.region, ci.rating, ci.status, ci.created_at,
               c.slug as collection_slug, c.name as collection_name,
               c.kind as collection_kind,
               -- 지면에 올릴 순서. 사진이 있는 것 > 할 말이 있는 것 >
               -- 아직 안 해본 것. 노션에서 넘어온 항목 중에는 'attire'
               -- 처럼 분류 이름만 적힌 한 단어짜리가 섞여 있는데, 그런
               -- 것이 표지 옆 자리를 차지하면 지면이 우스워진다.
               (case when ci.cover_url is not null then 0 else 2 end
                + case when coalesce(ci.subtitle, ci.summary, ci.region) is not null
                         or ci.rating is not null then 0 else 1 end
                + case when ci.status = 'wishlist' then 0 else 1 end) as rank
          from public.collection_items ci
          join public.collections c on c.id = ci.collection_id
         where ci.user_id = uid
         order by rank, ci.created_at desc
         limit 8
      ) h
    ), '[]'::jsonb),

    -- 추구미 한 꼭지. 레퍼런스가 모여 있고 증거를 찍을 때가 된 것을
    -- 우선으로 올린다.
    'aspiration', (
      select jsonb_build_object(
               'id', a.id, 'title', a.title, 'statement', a.statement,
               'cover_url', a.cover_url,
               'refs', (select count(*) from public.aspiration_refs r
                         where r.aspiration_id = a.id),
               'evidence', (select count(*) from public.aspiration_evidence e
                             where e.aspiration_id = a.id),
               'due_capture', a.capture_cadence <> 'off' and (
                 a.last_captured_at is null
                 or a.last_captured_at < now() - case a.capture_cadence
                      when 'monthly' then interval '30 days'
                      else interval '90 days' end))
        from public.aspirations a
       where a.user_id = uid and a.status = 'active'
       order by a.last_captured_at nulls first, a.started_at
       limit 1
    ),

    -- 노션이 3개월간 하지 않은 말을 여기서 한다.
    'alerts', coalesce((
      select jsonb_agg(a.card order by a.rank, a.card->>'title')
      from (
        -- 기한이 지난 목표
        select 1 as rank,
               jsonb_build_object(
                 'kind', 'overdue',
                 'title', g.title,
                 'body', to_char(g.period_end, 'MM월 DD일') || ' 마감 · '
                         || (p_today - g.period_end) || '일 경과',
                 'href', '/goals/' || g.id) as card
          from public.goals g
         where g.user_id = uid and g.status = 'active'
           and g.period_end is not null and g.period_end < p_today

        union all
        -- 한 달 안에 마감.
        -- 2주로 잡으면 분기 목표가 "18일 남음" 상태에서 아무 신호 없이
        -- 지나간다. 노션에서 TOPCIT 이 정확히 그렇게 마감을 넘겼다.
        select 2,
               jsonb_build_object(
                 'kind', 'due_soon',
                 'title', g.title,
                 'body', (g.period_end - p_today) || '일 남음',
                 'href', '/goals/' || g.id)
          from public.goals g
         where g.user_id = uid and g.status = 'active'
           and g.period_end is not null
           and g.period_end >= p_today and g.period_end <= p_today + 30

        union all
        -- 기한 없이 오래 조용한 목표.
        -- 마감이 없으면 알림 근거가 없어 목록 아래로 가라앉는다.
        select 3,
               jsonb_build_object(
                 'kind', 'stale',
                 'title', g.title,
                 'body', extract(day from now() - g.last_activity_at)::int
                         || '일째 움직임 없음',
                 'href', '/goals/' || g.id)
          from public.goals g
         where g.user_id = uid and g.status = 'active'
           and g.period_end is null
           and g.stale_after_days is not null
           and g.last_activity_at < now() - make_interval(days => g.stale_after_days)

        union all
        -- ── 맥락 서피싱 ────────────────────────────────────────
        -- 노션으로 불가능한 유일한 것. 저장해둔 자료가 읽히기를
        -- 기다리지 않고, 오늘 일정의 지역에 맞춰 스스로 올라온다.
        --
        --   캘린더에 "대전 출장"  →  대전에 저장해둔 미방문 맛집 3곳
        --
        -- rank 0 이라 경고 중 가장 위에 온다. 기한 경고보다 위인 이유는
        -- 이것만이 '지금 바로 쓸 수 있는' 정보이기 때문이다.
        select 0,
               jsonb_build_object(
                 'kind', 'surface',
                 'title', '오늘 ' || x.region || '이네요',
                 'body', x.cname || ' · 아직 안 가본 곳 ' || x.cnt || '군데',
                 'href', '/collections/' || x.cslug || '?region=' || x.region,
                 -- 이름 세 개를 같이 올린다. "3군데"만으로는 열어볼 이유가
                 -- 안 생기고, 이름이 보이면 그 자리에서 정해진다.
                 'chips', coalesce(x.picks, '[]'::jsonb),
                 'image', x.image)
          from (
            select ev.region,
                   c.name as cname,
                   c.slug as cslug,
                   (select count(*) from public.collection_items ci
                     where ci.collection_id = c.id
                       and ci.region = ev.region
                       and ci.status = 'wishlist') as cnt,
                   (select jsonb_agg(p.title order by p.rn)
                      from (select ci.title,
                                   row_number() over (
                                     order by ci.rating desc nulls last,
                                              ci.created_at desc) as rn
                              from public.collection_items ci
                             where ci.collection_id = c.id
                               and ci.region = ev.region
                               and ci.status = 'wishlist') p
                     where p.rn <= 3) as picks,
                   (select ci.cover_url from public.collection_items ci
                     where ci.collection_id = c.id
                       and ci.region = ev.region
                       and ci.status = 'wishlist'
                       and ci.cover_url is not null
                     order by ci.rating desc nulls last, ci.created_at desc
                     limit 1) as image
              from public.surfacing_rules sr
              join public.collections c on c.id = sr.collection_id
              join public.events ev
                on ev.user_id = uid
               and ev.region is not null
               and ev.starts_at >= from_ts and ev.starts_at < to_ts
             where sr.user_id = uid and sr.enabled
               and sr.trigger->>'type' = 'event_region'
             group by ev.region, c.id, c.name, c.slug
          ) x
         where x.cnt > 0

        union all
        -- 요일 트리거 — "토요일 아침엔 골프장"
        select 0,
               jsonb_build_object(
                 'kind', 'surface',
                 'title', c.name,
                 'body', '저장해둔 ' || y.cnt || '곳',
                 'href', '/collections/' || c.slug,
                 'chips', coalesce((
                   select jsonb_agg(p.title order by p.rn)
                     from (select ci.title,
                                  row_number() over (
                                    order by ci.rating desc nulls last,
                                             ci.created_at desc) as rn
                             from public.collection_items ci
                            where ci.collection_id = c.id) p
                    where p.rn <= 3), '[]'::jsonb),
                 'image', (
                   select ci.cover_url from public.collection_items ci
                    where ci.collection_id = c.id and ci.cover_url is not null
                    order by ci.rating desc nulls last, ci.created_at desc
                    limit 1))
          from public.surfacing_rules sr
          join public.collections c on c.id = sr.collection_id
          join lateral (
            select count(*) as cnt from public.collection_items ci
             where ci.collection_id = c.id
          ) y on y.cnt > 0
         where sr.user_id = uid and sr.enabled
           and sr.trigger->>'type' = 'day_of_week'
           and (sr.trigger->'days') @> to_jsonb(extract(dow from p_today)::int)
      ) a
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;


-- ┌─────────────────────────────────────────────────────────
-- │ 0011_identity.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0011 · 나 자신
--
-- 노션 My Identity 페이지 본문에 있던 것들. 데이터베이스 두 개만
-- 옮기고 정작 "나에 대한 것"을 빠뜨렸던 부분을 채운다.
-- ============================================================

-- ------------------------------------------------------------
-- 프로필 확장
--
-- 생년월일과 입사일은 서사가 아니라 동작하는 데이터다. 여기 있으면
-- 생일과 근속 기념일에 비서가 먼저 말을 건다. bio 안의 문장으로
-- 두면 아무 일도 일어나지 않는다.
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists birth_date        date,
  add column if not exists birth_place       text,
  add column if not exists career_started_at date,
  add column if not exists company           text,
  add column if not exists job_title         text,
  -- 학력 · 전공 같은 서사. Markdown.
  add column if not exists bio               text;

-- ------------------------------------------------------------
-- interests — 내가 하는 · 하고 싶은 활동 영역
--
-- 목표도 습관도 컬렉션도 아닌 것들이 있다. "수영", "미국 주식 투자",
-- "스페인어" 같은 것. 노션에서는 이게 이모지 붙은 불릿 목록이었고,
-- 목록은 아무것도 하지 않는다.
--
-- 그래서 각 관심사를 실제 표현(습관 · 컬렉션 · 목표)에 연결한다.
-- 연결이 셋 다 비어 있으면 "말만 있고 아직 아무것도 없는 것"이고,
-- 연결이 있으면 마지막 활동 시각을 계산할 수 있다.
-- 그러면 목록이 거울이 된다 — 운동 셋 중 골프만 하고 있고 수영과
-- 필라테스는 반년째 조용하다는 것이 보인다.
-- ------------------------------------------------------------
do $ident$ begin
  create type interest_area as enum
    ('lifelog', 'workout', 'finance', 'language', 'other');
exception when duplicate_object then null; end $ident$;
do $ident$ begin
  create type interest_status as enum ('active', 'someday', 'paused', 'dropped');
exception when duplicate_object then null; end $ident$;

create table if not exists public.interests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  role_id       uuid references public.roles(id) on delete set null,
  title         text not null,
  area          interest_area not null default 'other',
  note          text,
  emoji         text,
  status        interest_status not null default 'active',

  -- 실제 표현으로의 연결
  habit_id      uuid references public.habits(id) on delete set null,
  collection_id uuid references public.collections(id) on delete set null,
  goal_id       uuid references public.goals(id) on delete set null,
  aspiration_id uuid references public.aspirations(id) on delete set null,

  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
select public.own_rows('public.interests');
select public.auto_touch('public.interests');
create unique index if not exists interests_title_uniq on public.interests (user_id, title);
create index if not exists interests_area_idx on public.interests (user_id, area, sort_order);

-- ------------------------------------------------------------
-- 관심사별 마지막 활동
--
-- 연결된 습관의 마지막 체크 / 컬렉션의 마지막 항목 / 목표의 마지막 움직임
-- 중 가장 최근 것. null 이면 아직 아무 일도 없었다는 뜻이고, 그 자체가
-- 보여줄 가치가 있는 정보다.
-- ------------------------------------------------------------
create or replace function public.interest_last_active(p_interest uuid)
returns timestamptz
language sql
stable
security invoker
as $$
  select greatest(
    (select max(hl.logged_on)::timestamptz
       from public.habit_logs hl join public.interests i on i.habit_id = hl.habit_id
      where i.id = p_interest),
    (select max(ci.created_at)
       from public.collection_items ci join public.interests i on i.collection_id = ci.collection_id
      where i.id = p_interest),
    (select max(cl.logged_on)::timestamptz
       from public.collection_item_logs cl
       join public.collection_items ci on ci.id = cl.item_id
       join public.interests i on i.collection_id = ci.collection_id
      where i.id = p_interest),
    (select max(g.last_activity_at)
       from public.goals g join public.interests i on i.goal_id = g.id
      where i.id = p_interest)
  );
$$;

-- ------------------------------------------------------------
-- 기념일 알림 종류
-- ------------------------------------------------------------
alter type notification_kind add value if not exists 'anniversary';

-- ------------------------------------------------------------
-- 관심사 + 마지막 활동을 한 번에
--
-- interest_last_active 를 행마다 부르면 20번 왕복한다. 아이덴티티
-- 화면은 자주 보는 곳이 아니지만, 느린 화면은 결국 안 보게 된다.
-- ------------------------------------------------------------
create or replace function public.interests_view()
returns table (
  id          uuid,
  title       text,
  area        interest_area,
  emoji       text,
  note        text,
  status      interest_status,
  role_id     uuid,
  sort_order  int,
  linked      boolean,
  last_active timestamptz
)
language sql
stable
security invoker
as $$
  select i.id, i.title, i.area, i.emoji, i.note, i.status, i.role_id, i.sort_order,
         (i.habit_id is not null or i.collection_id is not null
          or i.goal_id is not null or i.aspiration_id is not null) as linked,
         greatest(
           (select max(hl.logged_on)::timestamptz from public.habit_logs hl
             where hl.habit_id = i.habit_id),
           (select max(ci.created_at) from public.collection_items ci
             where ci.collection_id = i.collection_id),
           (select max(cl.logged_on)::timestamptz
              from public.collection_item_logs cl
              join public.collection_items ci2 on ci2.id = cl.item_id
             where ci2.collection_id = i.collection_id),
           (select g.last_activity_at from public.goals g where g.id = i.goal_id)
         ) as last_active
    from public.interests i
   where i.user_id = auth.uid()
   order by i.area, i.sort_order, i.title;
$$;


-- ┌─────────────────────────────────────────────────────────
-- │ 0012_profile_cover.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0012 · 프로필 표지
--
-- 노션 My Identity 페이지에는 표지 사진이 걸려 있었다. 문서의 일부이고,
-- 이 앱에서 유일하게 확보된 실제 사진이기도 하다. '나' 화면의 표지로
-- 그대로 옮긴다.
--
-- 다른 사진(컬렉션 항목·추구미 레퍼런스)은 본인이 직접 넣는다. 여기는
-- 원본 페이지가 이미 가지고 있던 한 장만 산다.
-- ============================================================
alter table public.profiles
  add column if not exists cover_url text;


-- ┌─────────────────────────────────────────────────────────
-- │ 0013_layouts.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 0013 · 화면 배치
--
-- 지면의 카드 자리를 사용자가 직접 정한다. 맥 바탕화면 아이콘처럼
-- 격자에 물리되, 어디에 둘지는 본인이 끌어서 정하는 방식.
--
-- 왜 서버에 두는가: 폰과 노트북에서 같은 배치를 봐야 한다.
-- localStorage 에 두면 기기마다 다른 지면이 되고, 그러면 배치를 다시
-- 맞추는 일이 생겨서 결국 아무도 안 만지게 된다.
--
-- 한 줄에 한 화면(surface)씩. 지금은 'today' 하나지만 컬렉션 상세나
-- '나' 화면도 같은 방식으로 붙일 수 있다.
-- ============================================================

create table if not exists public.layouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  -- 어느 화면의 배치인가 ('today' …)
  surface     text not null,

  -- [{ id, x, y, w, h }] — 격자 단위. 12칸 기준.
  -- 카드가 사라지면 그 항목은 읽을 때 무시되고, 새 카드는 뒤에 붙는다.
  -- 배치를 저장해둔 뒤 컬렉션을 지웠다고 화면이 깨지면 안 된다.
  items       jsonb not null default '[]'::jsonb,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint layouts_items_is_array check (jsonb_typeof(items) = 'array')
);

create unique index if not exists layouts_user_surface_uniq
  on public.layouts (user_id, surface);

select public.own_rows('public.layouts');
select public.auto_touch('public.layouts');


-- ============================================================
-- 노션 이관 데이터
-- ============================================================

-- ┌─────────────────────────────────────────────────────────
-- │ 0001_from_notion.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 노션 이관 — 2026-09-12 실사 기준
--
-- 사용법: Supabase SQL Editor 에 통째로 붙여넣고 Run.
--         아래 MY_EMAIL 만 본인 계정으로 맞으면 된다.
--         (먼저 앱에 한 번 로그인해서 계정이 만들어져 있어야 한다)
--
-- 여러 번 실행해도 중복되지 않는다. 이미 있는 제목은 건너뛴다.
--
-- 원본 형태를 그대로 옮기지 않는다. 같은 형태로 옮기면 같은 결과가 난다.
-- 노션의 17개는 성격이 4가지로 섞여 있었고, 분기·월이 날짜가 아니라
-- 텍스트 태그라서 마감을 계산할 수 없었다. 그래서:
--   · 목표 → goals (분기·월을 실제 날짜로)
--   · 루틴 → habits (Status 를 떼고 스트릭으로)
--   · 아이템 → collection_items
--   · '구체적인 목표' 텍스트에 갇힌 실행 단위 → tasks
-- ============================================================

do $$
declare
  MY_EMAIL text := 'hayoung.lee@softcamp.co.kr';   -- ← 본인 계정

  uid uuid;
  r_softcamp uuid; r_law uuid; r_study uuid; r_fit uuid; r_life uuid;
  g_cash uuid; g_parent uuid;
  c_places uuid; c_golf uuid; c_countries uuid; c_wish uuid; c_music uuid;
  a_interior uuid;
begin
  select id into uid from auth.users where lower(email) = lower(MY_EMAIL);
  if uid is null then
    raise exception '계정을 찾을 수 없습니다: %. 앱에 먼저 한 번 로그인해 주세요.', MY_EMAIL;
  end if;

  -- ----------------------------------------------------------
  -- 역할 — 모든 일정·할 일·목표가 여기 걸리고 색으로 구분된다
  -- ----------------------------------------------------------
  insert into public.roles (user_id, name, description, color, icon, sort_order)
  values
    (uid, '소프트캠프', '기술교육 플랫폼 운영 · 보안 솔루션 기술지원 · PM', '#3A7CA5', '🏢', 1),
    (uid, '로스쿨 준비', '2028년 3월 입학', '#7161D1', '⚖️', 2),
    (uid, '학습',       'TOPCIT · 자격증 · 언어',                  '#41916B', '📚', 3),
    (uid, '운동',       '수영 · 필라테스 · 골프',                  '#C2703F', '⛳', 4),
    (uid, '취미·일상',  '독서 · 고전영화 · 미드 · 세계사 · 반려묘', '#8E6BB8', '🎧', 5)
  on conflict (user_id, name) do nothing;

  select id into r_softcamp from public.roles where user_id = uid and name = '소프트캠프';
  select id into r_law      from public.roles where user_id = uid and name = '로스쿨 준비';
  select id into r_study    from public.roles where user_id = uid and name = '학습';
  select id into r_fit      from public.roles where user_id = uid and name = '운동';
  select id into r_life     from public.roles where user_id = uid and name = '취미·일상';

  -- ----------------------------------------------------------
  -- 핵심 가치 — 노션 페이지 상단에 걸어둔 문장
  -- ----------------------------------------------------------
  insert into public.core_values (user_id, title, description, sort_order)
  values (uid, '생각하는 대로 살지 않으면 사는 대로 생각하게 된다',
          '노션 My Identity 페이지 상단에 걸어둔 문장', 1)
  on conflict (user_id, title) do nothing;

  -- ----------------------------------------------------------
  -- 목표 — 분기·월 multi-select 를 실제 날짜로 바꾼다.
  -- 이 변환 하나로 마감 알림이 동작하기 시작한다.
  -- ----------------------------------------------------------

  -- 기한이 지났던 두 건(Microsoft 자격증, 업계 박람회)은 요청대로 기한을
  -- 비운다. 대신 last_activity_at 을 지금으로 두어 60일간은 조용히 둔다.
  -- 옮기자마자 "90일째 방치" 라고 떠들면 첫 화면이 잔소리가 된다.

  insert into public.goals
    (user_id, role_id, title, description, horizon, period_start, period_end,
     metric_key, metric_target, metric_unit, status)
  select * from (values
    (uid, r_life,     '1막 마무리',            '2027.10 대관식',                          'life'::goal_horizon, null::date, '2027-10-31'::date, null::text, null::numeric, null::text, 'active'::goal_status),
    (uid, null,       '2032년 유동현금 5억',   '장기 자산 목표',                           'life',   null, '2032-12-31', '유동현금', 500000000, '원', 'active'),
    (uid, r_law,      '로스쿨 입학',           '28년도 3월 입학',                          'life',   null, '2028-03-01', null, null, null, 'active'),
    (uid, r_study,    'TOPCIT 900점',          '900점 달성',                               'quarter','2026-07-01', '2026-09-30', 'TOPCIT', 900, '점', 'active'),
    (uid, r_life,     '언어 교환 동아리 가입', '모임 여러 곳 비교 후 1곳 가입 · 월 2회 참여','quarter','2026-07-01', '2026-09-30', null, null, null, 'active'),
    (uid, r_study,    'Microsoft 자격증',      '초급 과정 자격증 취득',                    'year',   null, null, null, null, null, 'active'),
    (uid, r_softcamp, '업계 박람회·세미나 네트워킹', '2~3곳 방문 · 명함 50장 · 15초 자기소개', 'year', null, null, '명함', 50, '장', 'active'),
    (uid, r_softcamp, '비즈니스 영어',         'SHIELD Gate 개념과 컨셉을 브리핑 가능하도록','year',   null, null, null, null, null, 'active'),
    (uid, r_softcamp, 'CC본부 R&R 정립',       '비즈니스 매너와 전문 업무 능력, 나의 R&R',  'year',   null, null, null, null, null, 'active')
  ) v(a,b,c,d,e,f,g,h,i,j,k)
  where not exists (select 1 from public.goals where user_id = uid and title = v.c);

  -- 5억 목표의 첫 마일스톤. 노션의 '구체적인 목표'에 적혀 있던 것을
  -- 하위 목표로 꺼낸다. 텍스트 안에 있으면 진척을 볼 수 없다.
  select id into g_parent from public.goals where user_id = uid and title = '2032년 유동현금 5억';
  insert into public.goals
    (user_id, parent_id, title, description, horizon, period_end, metric_key, metric_target, metric_unit, status)
  select uid, g_parent, '2026년까지 유동현금 3,000만원', '5억 목표의 첫 마일스톤',
         'year', '2026-12-31', '유동현금', 30000000, '원', 'active'
  where not exists (select 1 from public.goals where user_id = uid and title like '2026년까지 유동현금%');

  -- ----------------------------------------------------------
  -- 습관 — 노션에서는 Status='Not started' 로 굳어 있던 것들.
  -- 비타민을 매일 먹는 건 '완료'되는 종류의 일이 아니다.
  -- ----------------------------------------------------------
  insert into public.habits (user_id, role_id, title, cadence, target_per_period, sort_order)
  values
    (uid, r_fit,  '종합비타민',                  'daily',  1, 1),
    (uid, r_life, '요한복음 필사',               'daily',  1, 2),
    (uid, r_life, '읽기',                        'daily',  1, 3),
    (uid, r_life, '플레이리스트 · 음악 큐레이션', 'weekly', 1, 4)
  on conflict (user_id, title) do nothing;

  -- ----------------------------------------------------------
  -- 추구미 — 노션 'Future Wishlist' 가 이미 추구미 목록이었다
  -- ----------------------------------------------------------
  insert into public.aspirations (user_id, role_id, title, statement, domain, capture_cadence)
  values
    (uid, null,   '인테리어 및 공간 스타일링', '내 공간이 나를 닮아 있으면 좋겠다',   'space',  'monthly'),
    (uid, null,   '전원생활',                  '언젠가 흙을 밟으며 사는 삶',          'space',  'quarterly'),
    (uid, r_fit,  '서핑',                      '바다에서 노는 사람',                  'body',   'quarterly'),
    (uid, r_life, '재즈 피아노 연주',          'Berklee 에서 배운 것을 손으로 되찾기','other',  'quarterly'),
    (uid, r_life, '제철음식 탐방',             '계절을 먹는 사람',                    'other',  'quarterly')
  on conflict (user_id, title) do nothing;

  select id into a_interior from public.aspirations where user_id = uid and title like '인테리어%';

  -- ----------------------------------------------------------
  -- 컬렉션 — 노션 Lifelog 에 "저장된 장소 방문 및 리뷰 작성
  -- (맛집/공간 아카이빙)" 이 이미 적혀 있었다. 담을 그릇이 없었을 뿐이다.
  -- ----------------------------------------------------------
  insert into public.collections (user_id, slug, name, description, icon, kind, default_view, schema, sort_order)
  select * from (values
    (uid, 'places', '저장된 장소', '맛집 · 카페 · 공간 아카이빙', '📍', 'place'::collection_kind, 'map'::collection_view,
     '{"fields":[
        {"key":"category","label":"종류","type":"select","options":["한식","중식","일식","양식","카페","바","기타"],"filterable":true},
        {"key":"price_range","label":"가격대","type":"select","options":["1만 이하","1~3만","3~5만","5만+"],"filterable":true},
        {"key":"parking","label":"주차","type":"bool","filterable":true},
        {"key":"booking","label":"예약 필요","type":"bool"},
        {"key":"signature","label":"대표 메뉴","type":"text"},
        {"key":"hours","label":"영업시간","type":"text"}]}'::jsonb, 1),

    (uid, 'golf', '골프장', '수도권 중심', '⛳', 'place', 'map',
     '{"fields":[
        {"key":"holes","label":"홀수","type":"select","options":["9","18","27","36"],"filterable":true},
        {"key":"green_fee_weekday","label":"그린피(주중)","type":"number"},
        {"key":"green_fee_weekend","label":"그린피(주말)","type":"number"},
        {"key":"caddie","label":"캐디","type":"select","options":["캐디","노캐디","선택"],"filterable":true},
        {"key":"booking_difficulty","label":"부킹 난이도","type":"select","options":["쉬움","보통","어려움"]},
        {"key":"distance_min","label":"집에서(분)","type":"number"}]}'::jsonb, 2),

    (uid, 'countries', '다녀온 나라', '7개국 16개 도시', '🌏', 'place', 'map',
     '{"fields":[
        {"key":"country","label":"국가","type":"text","filterable":true},
        {"key":"year","label":"방문 시기","type":"text"}]}'::jsonb, 3),

    (uid, 'wishlist', '위시리스트', '사고 싶은 것', '🛍️', 'product', 'card',
     '{"fields":[
        {"key":"category","label":"분류","type":"select","options":["의류","화장품","전자기기","가구","기타"],"filterable":true},
        {"key":"price","label":"가격","type":"number"},
        {"key":"link","label":"링크","type":"text"}]}'::jsonb, 4),

    (uid, 'music', '음악', '플레이리스트 · 튠 리스트', '🎧', 'media', 'list',
     '{"fields":[
        {"key":"artist","label":"아티스트","type":"text","filterable":true},
        {"key":"mood","label":"무드","type":"text"}]}'::jsonb, 5)
  ) v(a,b,c,d,e,f,g,h,i)
  where not exists (select 1 from public.collections where user_id = uid and slug = v.b);

  select id into c_places    from public.collections where user_id = uid and slug = 'places';
  select id into c_golf      from public.collections where user_id = uid and slug = 'golf';
  select id into c_countries from public.collections where user_id = uid and slug = 'countries';
  select id into c_wish      from public.collections where user_id = uid and slug = 'wishlist';
  select id into c_music     from public.collections where user_id = uid and slug = 'music';

  -- 노션 '아이템' 카테고리
  insert into public.collection_items (user_id, collection_id, title, status, data)
  select * from (values
    (uid, c_wish,  'attire',    'wishlist'::item_status, '{"category":"의류"}'::jsonb),
    (uid, c_wish,  'cosmetics', 'wishlist', '{"category":"화장품"}'::jsonb),
    (uid, c_music, 'tune list', 'wishlist', '{}'::jsonb)
  ) v(a,b,c,d,e)
  where not exists (
    select 1 from public.collection_items where user_id = uid and collection_id = v.b and title = v.c);

  -- 다녀온 나라 — 이미 페이지에 정리되어 있던 것. 지도 뷰로 바로 쓸 수 있다.
  insert into public.collection_items
    (user_id, collection_id, title, status, region, lat, lng, data)
  select * from (values
    (uid, c_countries, '도쿄',         'visited'::item_status, '일본',       35.6762,  139.6503, '{"country":"일본"}'::jsonb),
    (uid, c_countries, '나고야',       'visited', '일본',       35.1815,  136.9066, '{"country":"일본"}'::jsonb),
    (uid, c_countries, '하마마츠',     'visited', '일본',       34.7108,  137.7261, '{"country":"일본"}'::jsonb),
    (uid, c_countries, '오키나와',     'visited', '일본',       26.2124,  127.6809, '{"country":"일본"}'::jsonb),
    (uid, c_countries, '보스턴',       'visited', '미국',       42.3601,  -71.0589, '{"country":"미국"}'::jsonb),
    (uid, c_countries, '뉴욕',         'visited', '미국',       40.7128,  -74.0060, '{"country":"미국"}'::jsonb),
    (uid, c_countries, '텍사스',       'visited', '미국',       null,     null,     '{"country":"미국"}'::jsonb),
    (uid, c_countries, '프라하',       'visited', '체코',       50.0755,   14.4378, '{"country":"체코"}'::jsonb),
    (uid, c_countries, '브르노',       'visited', '체코',       49.1951,   16.6068, '{"country":"체코"}'::jsonb),
    (uid, c_countries, '브라티슬라바', 'visited', '슬로바키아', 48.1486,   17.1077, '{"country":"슬로바키아"}'::jsonb),
    (uid, c_countries, '비엔나',       'visited', '오스트리아', 48.2082,   16.3738, '{"country":"오스트리아"}'::jsonb),
    (uid, c_countries, '부다페스트',   'visited', '헝가리',     47.4979,   19.0402, '{"country":"헝가리"}'::jsonb),
    (uid, c_countries, '다낭',         'visited', '베트남',     16.0544,  108.2022, '{"country":"베트남"}'::jsonb),
    (uid, c_countries, '하노이',       'visited', '베트남',     21.0285,  105.8542, '{"country":"베트남"}'::jsonb),
    (uid, c_countries, '사파',         'visited', '베트남',     22.3364,  103.8438, '{"country":"베트남"}'::jsonb)
  ) v(a,b,c,d,e,f,g,h)
  where not exists (
    select 1 from public.collection_items where user_id = uid and collection_id = v.b and title = v.c);

  -- ----------------------------------------------------------
  -- 할 일 — '구체적인 목표' 텍스트 안에 갇혀 있던 실행 단위들.
  -- 텍스트는 체크할 수 없고, 체크할 수 없으면 실행되지 않는다.
  -- ----------------------------------------------------------
  insert into public.tasks (user_id, role_id, title, status, notes)
  select * from (values
    (uid, r_study,    'TOPCIT 기출 1회분 풀기',              'todo'::task_status, '900점 목표'),
    (uid, r_study,    'Microsoft 초급 과정 시험일 확인',      'inbox', null),
    (uid, r_softcamp, '15초 자기소개 준비',                   'inbox', '박람회·세미나용'),
    (uid, r_softcamp, '참석할 업계 박람회 2~3곳 고르기',      'inbox', null),
    (uid, r_life,     '언어 교환 모임 3곳 비교',              'inbox', null),
    (uid, r_life,     '언어 교환 모임 1곳 가입',              'inbox', null),
    (uid, r_fit,      '종합비타민 아침 알람 설정',            'inbox', '식후 복용'),
    (uid, r_softcamp, 'SHIELD Gate 브리핑 스크립트 초안',     'inbox', '비즈니스 영어'),
    (uid, r_law,      '로스쿨 입시 일정·요강 정리',           'inbox', '2028년 3월 입학'),
    (uid, r_softcamp, 'My Expertise PM 경력표 실제 내용 채우기','inbox', '예시 자리표시자가 그대로 남아 있음')
  ) v(a,b,c,d,e)
  where not exists (select 1 from public.tasks where user_id = uid and title = v.c);

  -- ----------------------------------------------------------
  -- 맥락 서피싱 규칙 — 자료가 나를 기다리지 않고 나를 찾아오게 한다
  -- ----------------------------------------------------------
  insert into public.surfacing_rules (user_id, collection_id, label, trigger, priority)
  select * from (values
    (uid, c_places, '일정 지역에 저장해둔 장소',
     '{"type":"event_region","item_status":"wishlist"}'::jsonb, 1),
    (uid, c_golf, '주말 아침 골프장',
     '{"type":"day_of_week","days":[6,0]}'::jsonb, 2)
  ) v(a,b,c,d,e)
  where not exists (
    select 1 from public.surfacing_rules where user_id = uid and label = v.c);

  raise notice '이관 완료: 역할 5 · 목표 10 · 습관 4 · 추구미 5 · 컬렉션 5 · 항목 18 · 할 일 10 · 서피싱 규칙 2';
end $$;


-- ┌─────────────────────────────────────────────────────────
-- │ 0002_profile_and_interests.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 노션 이관 2 — 페이지 본문 (나 자신)
--
-- 0001 을 먼저 돌린 뒤 이 파일을 실행한다.
-- 아래 MY_EMAIL 만 본인 계정으로 맞으면 된다.
--
-- 0001 은 데이터베이스 두 개(비전보드 · 커리어)를 옮겼다.
-- 이 파일은 My Identity 페이지 본문에 있던 것들을 옮긴다 —
-- 자기소개, My Expertise, 그리고 이모지 불릿으로 나열되어 있던
-- 일상 취미 · 운동 · 자산 · 언어 목록 20개.
-- ============================================================

do $$
declare
  MY_EMAIL text := 'hayoung.lee@softcamp.co.kr';   -- ← 본인 계정

  uid uuid;
  r_softcamp uuid; r_study uuid; r_fit uuid; r_life uuid;
  c_places uuid; c_golf uuid; c_wish uuid; c_watch uuid; c_books uuid;
  h_read uuid; h_bible uuid; h_music uuid;
  g_cash uuid; g_save uuid; g_english uuid;
begin
  select id into uid from auth.users where lower(email) = lower(MY_EMAIL);
  if uid is null then
    raise exception '계정을 찾을 수 없습니다: %. 앱에 먼저 한 번 로그인해 주세요.', MY_EMAIL;
  end if;

  select id into r_softcamp from public.roles where user_id = uid and name = '소프트캠프';
  select id into r_study    from public.roles where user_id = uid and name = '학습';
  select id into r_fit      from public.roles where user_id = uid and name = '운동';
  select id into r_life     from public.roles where user_id = uid and name = '취미·일상';
  if r_life is null then
    raise exception '0001_from_notion.sql 을 먼저 실행해 주세요.';
  end if;

  -- ----------------------------------------------------------
  -- 프로필 — 노션 'Dlgkdud' 소개글
  --
  -- 생년월일과 입사일을 날짜 컬럼으로 둔다. 서사 안의 문장으로 두면
  -- 아무 일도 일어나지 않지만, 날짜로 두면 생일과 근속 기념일에
  -- 비서가 먼저 말을 건다.
  -- ----------------------------------------------------------
  update public.profiles set
    birth_date        = '1996-09-19',
    birth_place       = '경기도 성남',
    career_started_at = '2024-12-23',
    company           = '(주)소프트캠프',
    job_title         = '기술교육 플랫폼 운영 관리 · 보안 솔루션 기술지원',
    bio = E'1996년 9월 19일 오전 11시, 경기도 성남에서 태어났다.\n\n'
       || E'**학력**\n'
       || E'오리초등학교 → 불곡중학교 → 불곡고등학교 → '
       || E'Berklee College of Music (Electronic Production & Design) → '
       || E'명지전문대학 (부동산경영과) → 한국외국어대학교 글로벌캠퍼스\n\n'
       || E'**전공**\n'
       || E'체코·슬로바키아학 · 이중전공 Software & AI\n\n'
       || E'**커리어**\n'
       || E'2024년 12월 23일부터 (주)소프트캠프에서 기술교육 플랫폼 운영 관리와 '
       || E'보안 솔루션 기술지원 직무로 커리어를 쌓고 있다.'
  where id = uid;

  -- ----------------------------------------------------------
  -- My Expertise — 전문 영역. 구조가 아니라 서사라서 메모로 둔다.
  -- ----------------------------------------------------------
  insert into public.notes (user_id, role_id, title, kind, body, tags, pinned)
  select uid, r_softcamp, 'My Expertise', 'note',
    E'## 1. 기술 교육 플랫폼 구축 및 운영\n'
 || E'- 사내 임직원 및 기술 파트너사 대상의 기술 교육 플랫폼 구축 및 총괄 운영\n'
 || E'- 문서보안 엔드포인트 및 보안 SaaS 제품군 대상 기술 커리큘럼 설계\n'
 || E'- 교육 효과 극대화를 위한 베네핏 프로그램 및 수료 체계 운영 관리\n\n'
 || E'## 2. 기술 콘텐츠 기획 및 제작\n'
 || E'- 복잡한 보안 메커니즘을 시각화한 영상 교육 콘텐츠 기획·제작·편집\n'
 || E'- 파트너사의 제품 이해도를 높이기 위한 기술 가이드 및 매뉴얼 자산화\n\n'
 || E'## 3. 프로젝트 매니징 (PM)\n'
 || E'- 기술 파트너사 및 고객사 대상 원격·방문 기술지원 솔루션 제공\n'
 || E'- 프로젝트 전반의 기술 이슈 트래킹 및 리스크 매니지먼트\n\n'
 || E'---\n\n'
 || E'> PM 경력표는 노션에서 예시 자리표시자 상태로 남아 있었다.\n'
 || E'> 실제 프로젝트로 채우는 것이 할 일 목록에 있다.',
    array['커리어', '소프트캠프'], true
  where not exists (select 1 from public.notes where user_id = uid and title = 'My Expertise');

  -- ----------------------------------------------------------
  -- 컬렉션 추가 — 본 것과 읽은 것을 담을 곳
  -- ----------------------------------------------------------
  insert into public.collections (user_id, slug, name, description, icon, kind, default_view, schema, sort_order)
  values
    (uid, 'watch', '본 것', '고전 영화 · 미드 · 다큐멘터리', '🎥', 'media', 'card',
     '{"fields":[
        {"key":"type","label":"종류","type":"select","options":["영화","시리즈","다큐"],"filterable":true},
        {"key":"year","label":"제작연도","type":"text"},
        {"key":"director","label":"감독·제작","type":"text"},
        {"key":"where","label":"어디서","type":"text"}]}'::jsonb, 6),

    (uid, 'books', '읽은 책', '소설 · 세계사 · 그 외', '📚', 'media', 'list',
     '{"fields":[
        {"key":"author","label":"저자","type":"text","filterable":true},
        {"key":"genre","label":"분야","type":"select","options":["소설","역사","경제","기술","그 외"],"filterable":true},
        {"key":"pages","label":"쪽수","type":"number"},
        {"key":"quote","label":"인상 깊은 구절","type":"text"}]}'::jsonb, 7)
  on conflict (user_id, slug) do nothing;

  select id into c_places from public.collections where user_id = uid and slug = 'places';
  select id into c_golf   from public.collections where user_id = uid and slug = 'golf';
  select id into c_wish   from public.collections where user_id = uid and slug = 'wishlist';
  select id into c_watch  from public.collections where user_id = uid and slug = 'watch';
  select id into c_books  from public.collections where user_id = uid and slug = 'books';

  select id into h_read  from public.habits where user_id = uid and title = '읽기';
  select id into h_bible from public.habits where user_id = uid and title = '요한복음 필사';
  select id into h_music from public.habits where user_id = uid and title = '플레이리스트 · 음악 큐레이션';

  select id into g_cash    from public.goals where user_id = uid and title = '2032년 유동현금 5억';
  select id into g_save    from public.goals where user_id = uid and title like '2026년까지 유동현금%';
  select id into g_english from public.goals where user_id = uid and title = '비즈니스 영어';

  -- ----------------------------------------------------------
  -- 관심사 20개 — 노션 페이지의 이모지 불릿 목록
  --
  -- 연결(habit/collection/goal)이 있으면 마지막 활동이 계산되고,
  -- 없으면 "아직 아무것도 없음"이 그대로 보인다. 둘 다 정보다.
  -- ----------------------------------------------------------
  insert into public.interests
    (user_id, role_id, title, area, emoji, note, status, habit_id, collection_id, goal_id, sort_order)
  values
    -- 🧠 일상 취미
    (uid, r_life, '소설 읽기',        'lifelog', '📚', null, 'active', h_read,  c_books, null, 1),
    (uid, r_life, '고전 영화 보기',   'lifelog', '🎥', null, 'active', null,    c_watch, null, 2),
    (uid, r_life, '미드 시청',        'lifelog', '📺', null, 'active', null,    c_watch, null, 3),
    (uid, r_life, '세계사 공부',      'lifelog', '🌏', null, 'active', null,    c_books, null, 4),
    (uid, r_life, '반려동물 케어',    'lifelog', '😼', '고양이 두 마리', 'active', null, null, null, 5),
    (uid, r_life, '성경 읽기',        'lifelog', '🏛️', '요한복음 필사', 'active', h_bible, null, null, 6),
    (uid, r_life, '다큐멘터리 시청',  'lifelog', '🎞️', null, 'active', null,   c_watch, null, 7),
    (uid, r_life, '음악 큐레이션',    'lifelog', '🎧', '플레이리스트 세팅', 'active', h_music, null, null, 8),
    (uid, r_life, '저장된 장소 방문·리뷰', 'lifelog', '📍', '맛집 · 공간 아카이빙', 'active', null, c_places, null, 9),

    -- 🏃 운동
    (uid, r_fit,  '수영',             'workout', '🏊', null, 'active', null, null,   null, 1),
    (uid, r_fit,  '필라테스',         'workout', '🧘', null, 'active', null, null,   null, 2),
    (uid, r_fit,  '골프',             'workout', '⛳', null, 'active', null, c_golf, null, 3),

    -- 💰 자산 · 소비
    (uid, null,   '미국 주식 투자',   'finance', '📈', null, 'active', null, null,   g_cash, 1),
    (uid, null,   '목표액 저축·자산 관리', 'finance', '🐖', null, 'active', null, null, g_save, 2),
    (uid, null,   '합리적인 쇼핑',    'finance', '🛍️', '맞춤형 쇼핑 플랫폼 활용', 'active', null, c_wish, null, 3),

    -- 🌐 공부하고 싶은 언어
    (uid, r_study, '영어',            'language', '🇺🇸', 'SHIELD Gate 브리핑 가능 수준까지', 'active', null, null, g_english, 1),
    (uid, r_study, '스페인어',        'language', '🇪🇸', null, 'someday', null, null, null, 2),
    (uid, r_study, '일본어',          'language', '🇯🇵', null, 'someday', null, null, null, 3),
    (uid, r_study, '중국어',          'language', '🇨🇳', null, 'someday', null, null, null, 4),
    (uid, r_study, '체코어',          'language', '🇨🇿', '학부 전공', 'someday', null, null, null, 5)
  on conflict (user_id, title) do nothing;

  raise notice '이관 2 완료: 프로필 · My Expertise 메모 · 컬렉션 2 · 관심사 20';
end $$;


-- ┌─────────────────────────────────────────────────────────
-- │ 0003_remaining.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 노션 이관 3 — 남은 전부
--
-- 0001, 0002 를 먼저 돌린 뒤 실행한다.
--
-- 1차·2차에서 빠졌던 것들:
--   · 비전보드 '5월 연휴 가족여행' 과 그 안에 텍스트로 갇혀 있던 할 일
--   · '종합비타민' 의 두 번째 실행 항목 (복용 전후 컨디션 기록)
--   · '읽기' 의 목적 (뇌의 힘 기르기)
--   · 별도 '메모' 페이지 — 버킷리스트 with M, 개인 할 일
-- ============================================================

do $$
declare
  MY_EMAIL text := 'hayoung.lee@softcamp.co.kr';   -- ← 본인 계정

  uid uuid;
  r_life uuid; r_fit uuid;
  c_bucket uuid; c_books uuid;
  p_trip uuid;
begin
  select id into uid from auth.users where lower(email) = lower(MY_EMAIL);
  if uid is null then
    raise exception '계정을 찾을 수 없습니다: %', MY_EMAIL;
  end if;

  select id into r_life from public.roles where user_id = uid and name = '취미·일상';
  select id into r_fit  from public.roles where user_id = uid and name = '운동';
  select id into c_books from public.collections where user_id = uid and slug = 'books';
  if r_life is null or c_books is null then
    raise exception '0001, 0002 를 먼저 실행해 주세요.';
  end if;

  -- ----------------------------------------------------------
  -- 5월 연휴 가족여행
  --
  -- 비전보드에 있었는데 1차 이관에서 빠졌다. 이건 목표가 아니라
  -- 프로젝트다 — 날짜가 있고 그 아래 실행 단위가 여럿 달린다.
  -- '구체적인 목표' 텍스트에 갇혀 있던 두 줄을 할 일로 꺼낸다.
  -- ----------------------------------------------------------
  insert into public.projects (user_id, role_id, title, description, area, status, due_date)
  select uid, r_life, '5월 연휴 가족여행', '예산 150만원 이내', 'personal', 'active', '2027-05-01'
  where not exists (select 1 from public.projects where user_id = uid and title = '5월 연휴 가족여행');

  select id into p_trip from public.projects where user_id = uid and title = '5월 연휴 가족여행';

  insert into public.tasks (user_id, role_id, project_id, title, status, due_at, notes)
  select * from (values
    (uid, r_life, p_trip, '항공·숙소 확정', 'todo'::task_status,
     '2027-03-31T23:59:00+09'::timestamptz, '예산 150만원 이내'),
    (uid, r_life, p_trip, '3일 일정표 만들기', 'inbox', null::timestamptz, null::text),
    -- 이 한 줄이 맥락 서피싱과 정확히 만나는 지점이다.
    -- 여행지를 캘린더에 넣으면 그 지역 저장 장소가 알아서 올라온다.
    (uid, r_life, p_trip, '여행지 맛집 찾기', 'inbox', null,
     '저장된 장소 컬렉션에 지역과 함께 넣어두면 여행 당일 아침에 알아서 올라옵니다')
  ) v(a,b,c,d,e,f,g)
  where not exists (select 1 from public.tasks where user_id = uid and title = v.d);

  -- 종합비타민의 두 번째 실행 항목
  insert into public.tasks (user_id, role_id, title, status, notes)
  select uid, r_fit, '복용 전후 컨디션 기록 시작', 'inbox', '종합비타민 30일 체크리스트와 함께'
  where not exists (select 1 from public.tasks where user_id = uid and title like '복용 전후 컨디션%');

  -- '읽기' 의 목적. 비전보드에 "뇌의 힘 기르기" 로 적혀 있었다.
  update public.interests
     set note = '뇌의 힘 기르기'
   where user_id = uid and title = '소설 읽기' and note is null;

  -- ----------------------------------------------------------
  -- 메모 페이지 — 버킷리스트 with M
  --
  -- 장소형 컬렉션으로 만든다. region 을 넣어두면 그 지역 일정이
  -- 잡히는 날 알아서 올라온다. "언젠가 가고 싶다"가 목록에만
  -- 남아 있으면 영영 안 간다.
  -- ----------------------------------------------------------
  insert into public.collections (user_id, slug, name, description, icon, kind, default_view, schema, sort_order)
  values (uid, 'bucket', '버킷리스트', '언젠가 하고 싶은 것', '🎯', 'place', 'list',
    '{"fields":[
       {"key":"area","label":"분류","type":"select","options":["여행·방문","생활·인테리어","경험","그 외"],"filterable":true},
       {"key":"with","label":"누구와","type":"text","filterable":true},
       {"key":"budget","label":"예상 예산","type":"number"}]}'::jsonb, 8)
  on conflict (user_id, slug) do nothing;

  select id into c_bucket from public.collections where user_id = uid and slug = 'bucket';

  insert into public.collection_items
    (user_id, collection_id, title, status, region, summary, body, data)
  select * from (values
    (uid, c_bucket, '제주도', 'wishlist'::item_status, '제주', null::text, null::text,
     '{"area":"여행·방문","with":"M"}'::jsonb),
    (uid, c_bucket, '부산', 'wishlist', '부산', '서면 방문 · 고급 호텔 레스토랑 식사',
     E'- 서면 방문\n- 컴플릿 후 부산 고급 호텔에서 레스토랑 식사',
     '{"area":"여행·방문","with":"M"}'::jsonb),
    (uid, c_bucket, '미국 보스턴', 'wishlist', null, 'Berklee 시절의 도시', null,
     '{"area":"여행·방문","with":"M"}'::jsonb),
    (uid, c_bucket, '미국 시애틀', 'wishlist', null, '사촌 방문 · 골프 라운딩',
     E'- 사촌 방문\n- 골프 라운딩', '{"area":"여행·방문","with":"M"}'::jsonb)
  ) v(a,b,c,d,e,f,g,h)
  where not exists (
    select 1 from public.collection_items where user_id = uid and collection_id = v.b and title = v.c);

  -- 버킷리스트도 서피싱 대상. 부산 일정이 잡히면 부산이 올라온다.
  insert into public.surfacing_rules (user_id, collection_id, label, trigger, priority)
  select uid, c_bucket, '일정 지역 버킷리스트', '{"type":"event_region"}'::jsonb, 3
  where not exists (
    select 1 from public.surfacing_rules where user_id = uid and label = '일정 지역 버킷리스트');

  -- 관심사로도 걸어둔다 — 아직 아무것도 안 했다는 게 보이게
  insert into public.interests (user_id, role_id, title, area, emoji, note, status, collection_id, sort_order)
  values (uid, r_life, '버킷리스트 실행', 'lifelog', '🎯', 'M 과 함께', 'active', c_bucket, 10)
  on conflict (user_id, title) do nothing;

  -- 메모 페이지 — 개인 할 일
  insert into public.tasks (user_id, role_id, title, status, notes)
  select uid, r_life, '철학 콘서트 1·2·3 읽기', 'inbox', '노션 메모 페이지에서'
  where not exists (select 1 from public.tasks where user_id = uid and title like '철학 콘서트%');

  insert into public.collection_items (user_id, collection_id, title, status, data)
  select uid, c_books, '철학 콘서트 1·2·3', 'wishlist', '{"genre":"그 외"}'::jsonb
  where not exists (
    select 1 from public.collection_items
     where user_id = uid and collection_id = c_books and title like '철학 콘서트%');

  raise notice '이관 3 완료: 프로젝트 1 · 할 일 5 · 버킷리스트 4 · 서피싱 규칙 1';
end $$;


-- ┌─────────────────────────────────────────────────────────
-- │ 0004_missing.sql
-- └─────────────────────────────────────────────────────────
-- ============================================================
-- 노션 이관 4차 — My Identity 하위에서 빠졌던 것
--
-- 사용법: Supabase SQL Editor 에 통째로 붙여넣고 Run.
-- 여러 번 실행해도 중복되지 않는다.
--
-- 범위는 My Identity 페이지와 그 하위 페이지로 한정한다.
-- 형제 페이지인 `옛날 DB` 는 옮기지 않는다.
-- ============================================================

do $$
declare
  MY_EMAIL text := 'hayoung.lee@softcamp.co.kr';   -- ← 본인 계정
  uid uuid;
  r_softcamp uuid;
  n_habit int := 0;
begin
  select id into uid from auth.users where lower(email) = lower(MY_EMAIL);
  if uid is null then
    raise exception '계정을 찾지 못했습니다: %  (먼저 앱에 한 번 로그인하세요)', MY_EMAIL;
  end if;

  select id into r_softcamp from public.roles
   where user_id = uid and name like '%소프트캠프%' limit 1;

  -- ── 주간 업무 다이어리 ──────────────────────────────────
  -- 비전보드 '플레이리스트 세팅 및 음악 큐레이션' 행의 `구체적인 목표`
  -- 칸에 "주간 업무 다이어리 작성 쓰기" 가 들어 있었다. 음악 큐레이션과
  -- 아무 관계가 없는 내용이 남의 칸에 들어가 있어서 3차까지 놓쳤다.
  --
  -- 할 일이 아니라 습관으로 옮긴다. 매주 반복하는 행동이고, 할 일로
  -- 넣으면 한 번 체크한 뒤 사라져서 다음 주에 아무것도 남지 않는다.
  if not exists (
    select 1 from public.habits
     where user_id = uid and title = '주간 업무 다이어리'
  ) then
    insert into public.habits (user_id, role_id, title, cadence, target_per_period, sort_order)
    values (uid, r_softcamp, '주간 업무 다이어리', 'weekly', 1, 50);
    n_habit := 1;
  end if;

  -- ── 페이지 표지 ─────────────────────────────────────────
  -- 노션 My Identity 페이지에 걸려 있던 표지 사진.
  update public.profiles
     set cover_url = 'https://images.unsplash.com/photo-1676074920285-b18362d78fc6?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb'
   where user_id = uid and cover_url is null;

  raise notice '이관 4 완료: 습관 % · 프로필 표지', n_habit;
end $$;


