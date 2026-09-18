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
