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
