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
