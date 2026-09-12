-- ============================================================
-- 0007 · 비서 엔진 — 푸시 구독 · 알림 규칙 · 발송 이력
-- ============================================================

-- ------------------------------------------------------------
-- push_subscriptions — 기기별 1행 (폰 · 노트북 각각)
-- ------------------------------------------------------------
create table public.push_subscriptions (
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
create type notification_channel as enum ('webpush', 'email');

create table public.notification_rules (
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
create type notification_status as enum ('queued', 'sent', 'failed', 'skipped');

create table public.notifications (
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
create unique index notifications_dedupe_idx
  on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
create index notifications_recent_idx on public.notifications (user_id, created_at desc);

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
create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.seed_default_notification_rules();
