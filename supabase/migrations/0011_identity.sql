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
  add column birth_date        date,
  add column birth_place       text,
  add column career_started_at date,
  add column company           text,
  add column job_title         text,
  -- 학력 · 전공 같은 서사. Markdown.
  add column bio               text;

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
create type interest_area as enum
  ('lifelog', 'workout', 'finance', 'language', 'other');
create type interest_status as enum ('active', 'someday', 'paused', 'dropped');

create table public.interests (
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
create unique index interests_title_uniq on public.interests (user_id, title);
create index interests_area_idx on public.interests (user_id, area, sort_order);

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
