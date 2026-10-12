-- ============================================================
-- 0015 · 매일 한 편 — 나만을 위한 일간지
--
-- 이 앱은 지금까지 "내가 넣은 것을 되돌려주는" 쪽이었다. 여기서부터는
-- 한 방향이 더 생긴다. 매일 아침 한 편씩, 내가 넣지 않은 것이 올라온다.
--
-- 재료는 노션 My Identity 에 적혀 있던 관심사다. 그것이 topics 가 된다.
-- 다만 목록만으로는 같은 글이 반복된다. 그래서 두 가지를 더 둔다.
--   · angle   — 그 주제를 어떤 각도로 쓸지. 매번 다른 각을 고를 수 있게.
--   · editor_notes — 편집자(앱)가 묻고 내가 답하는 칸.
--
-- editor_notes 가 메일을 대신한다. 메일로 물으면 답장이 돌아올 곳이
-- 없다. 여기서 묻고 여기서 답하면 다음 호에 바로 반영된다.
-- ============================================================

-- ------------------------------------------------------------
-- topics — 발행 주제 풀
-- ------------------------------------------------------------
create table if not exists public.topics (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,

  -- 노션 My Identity 의 다섯 칸을 그대로 옮긴 구분
  area          text not null default 'lifelog',
  title         text not null,
  emoji         text,

  -- 어떤 각도로 쓸 것인지. 비어 있으면 생성기가 알아서 잡는다.
  angle         text,

  -- 1~5. 클수록 자주 걸린다. 요즘 꽂힌 주제를 올려두는 손잡이.
  weight        int not null default 3,
  active        boolean not null default true,

  -- 같은 주제가 연달아 나오지 않게 하는 기준
  last_issued_on date,
  issued_count  int not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint topics_title_not_blank check (length(btrim(title)) > 0),
  constraint topics_weight_range check (weight between 1 and 5)
);

select public.own_rows('public.topics');
select public.auto_touch('public.topics');

create unique index if not exists topics_title_uniq
  on public.topics (user_id, title);
-- 다음 주제 고르기: 활성 + 오래 안 나온 순
create index if not exists topics_pick_idx
  on public.topics (user_id, active, last_issued_on nulls first);

-- ------------------------------------------------------------
-- editor_notes — 편집 회의
--
-- question : 앱이 나에게 묻는다 ("요즘 어느 쪽이 더 궁금하세요?")
-- request  : 내가 앱에 시킨다 ("내일은 이 얘기 써줘")
-- feedback : 발행된 글에 대한 내 반응. 다음 호의 재료가 된다.
-- ------------------------------------------------------------
do $ident$ begin
  create type editor_note_kind as enum ('question', 'request', 'feedback');
exception when duplicate_object then null; end $ident$;

do $ident$ begin
  create type editor_note_status as enum ('open', 'answered', 'closed');
exception when duplicate_object then null; end $ident$;

create table if not exists public.editor_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  kind        editor_note_kind not null,
  topic_id    uuid references public.topics(id) on delete set null,
  post_id     uuid references public.posts(id) on delete set null,

  body        text not null,
  answer      text,
  status      editor_note_status not null default 'open',

  created_at  timestamptz not null default now(),
  answered_at timestamptz,

  constraint editor_notes_body_not_blank check (length(btrim(body)) > 0),
  -- 답이 있으면 답한 시각이 있어야 한다. 목록 정렬이 무너지지 않게.
  constraint editor_notes_answered_has_date
    check (status <> 'answered' or answered_at is not null)
);

select public.own_rows('public.editor_notes');

create index if not exists editor_notes_open_idx
  on public.editor_notes (user_id, status, created_at desc);

-- ------------------------------------------------------------
-- issue_runs — 발행 기록
--
-- 크론이 조용히 실패하면 "오늘 글이 안 올라왔네"로만 보이고 왜인지
-- 알 수가 없다. 성공이든 실패든 한 줄씩 남긴다.
-- ------------------------------------------------------------
create table if not exists public.issue_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ran_on      date not null,
  topic_id    uuid references public.topics(id) on delete set null,
  post_id     uuid references public.posts(id) on delete set null,
  ok          boolean not null default false,
  detail      text,
  tokens_in   int,
  tokens_out  int,
  created_at  timestamptz not null default now()
);

select public.own_rows('public.issue_runs');

-- 하루 한 편. 크론이 두 번 돌아도 두 편이 되지 않는다.
create unique index if not exists issue_runs_one_per_day
  on public.issue_runs (user_id, ran_on) where ok;

-- ------------------------------------------------------------
-- posts 확장 — 자동 발행분을 구별한다
-- ------------------------------------------------------------
do $ident$ begin
  create type post_kind as enum ('auto', 'mine');
exception when duplicate_object then null; end $ident$;

alter table public.posts add column if not exists kind post_kind not null default 'mine';
alter table public.posts add column if not exists topic_id uuid references public.topics(id) on delete set null;
alter table public.posts add column if not exists lede text;
alter table public.posts add column if not exists model text;
alter table public.posts add column if not exists reading_minutes int;
alter table public.posts add column if not exists generated_at timestamptz;

create index if not exists posts_kind_idx
  on public.posts (user_id, kind, published_at desc);

-- ------------------------------------------------------------
-- 가입 시 주제 풀을 깔아준다.
--
-- 빈 주제 풀로 시작하면 첫날 아무것도 발행되지 않고, 그러면 왜 비었는지
-- 찾으러 들어가야 한다. 노션에 이미 적혀 있던 관심사를 기본값으로 둔다.
-- ------------------------------------------------------------
create or replace function public.seed_topics(p_user uuid)
returns int
language plpgsql
security definer set search_path = public
as $fn$
declare
  n int := 0;
begin
  insert into public.topics (user_id, area, title, emoji, angle, weight)
  values
    -- 🧠 일상 취미
    (p_user, 'lifelog', '읽기', '📚', '읽은 책 옆에 둘 다음 책 한 권과, 그 책이 왜 지금인지', 3),
    (p_user, 'lifelog', '고전 영화', '🎥', '오늘 밤 한 편. 줄거리 말고 그 영화가 발명한 것 하나', 3),
    (p_user, 'lifelog', '미드', '📺', '시즌 전체를 볼 가치가 있는지부터 판정', 2),
    (p_user, 'lifelog', '세계사', '🌏', '다녀온 나라(체코·슬로바키아·오스트리아·헝가리·일본·미국·베트남)와 이어지는 한 토막', 4),
    (p_user, 'lifelog', '고양이', '😼', '두 마리를 키우는 사람에게 실제로 쓸모 있는 것만', 3),
    (p_user, 'lifelog', '성경 읽기', '🏛️', '한 구절과 그 구절이 쓰인 시대의 맥락', 2),
    (p_user, 'lifelog', '다큐멘터리', '🎞️', '한 편과, 그 편이 다루지 않은 반대편', 2),
    (p_user, 'lifelog', '음악 큐레이션', '🎧', 'Berklee 전자음악 전공자에게 설명하듯. 곡 나열 말고 왜 그 순서인지', 5),
    (p_user, 'lifelog', '공간 아카이빙', '📍', '저장만 해두고 안 가본 곳을 꺼내 쓰는 법', 3),
    -- 💰 자산 · 소비
    (p_user, 'finance', '미국 주식', '📈', '종목 추천 아님. 구조와 용어를 하나씩', 3),
    (p_user, 'finance', '저축과 자산 관리', '🐖', '2032년 유동현금 5억이라는 목표에서 역산', 3),
    (p_user, 'finance', '합리적인 소비', '🛍️', '사는 법보다 안 사는 법', 2),
    -- 🏃 운동
    (p_user, 'workout', '수영', '🏊', '폼 한 가지를 물리로 설명', 2),
    (p_user, 'workout', '필라테스', '🧘', '해부학 한 조각', 2),
    (p_user, 'workout', '골프', '⛳', '스윙 말고 코스 전략과 규칙의 역사', 3),
    -- 🔮 미래의 취미
    (p_user, 'future', '서핑', '🏄', '아직 안 해본 사람 기준. 첫 한 달에 필요한 것', 2),
    (p_user, 'future', '재즈 피아노', '🎹', 'Berklee 화성학을 아는 사람에게. 보이싱과 곡 하나', 4),
    (p_user, 'future', '인테리어', '🛋️', '내년 10월 들어갈 집 기준. 동양과 현대가 섞인 우드톤', 5),
    (p_user, 'future', '전원생활', '🏡', '마당 있는 집의 실제 운영 — 텃밭·바베큐·겨울나기', 5),
    (p_user, 'future', '제철음식', '🥕', '이번 달에 나는 것 하나와 그걸 쓰는 법', 4),
    -- 🌐 언어
    (p_user, 'language', '영어', '🇺🇸', '업무 영어. 실제로 쓰는 표현만', 3),
    (p_user, 'language', '스페인어', '🇪🇸', '처음부터. 하루 한 조각', 2),
    (p_user, 'language', '일본어', '🇯🇵', '여행에서 바로 쓰는 것부터', 2),
    (p_user, 'language', '중국어', '🇨🇳', '한자를 아는 사람의 지름길', 2),
    (p_user, 'language', '체코어', '🇨🇿', '전공자에게. 잊은 것을 되살리는 쪽', 3),
    -- 😎 커리어
    (p_user, 'career', '보안 기술지원', '🔐', '소프트캠프 업무와 직접 닿는 보안 개념 하나', 4),
    (p_user, 'career', '기술교육 플랫폼', '🎓', '교육 운영자 관점의 제품론', 3),
    (p_user, 'career', 'AI와 소프트웨어', '🤖', 'Software&AI 이중전공자 기준. 유행어 말고 원리', 4),
    (p_user, 'career', '부동산', '🏢', '부동산경영 전공 + 내년 이사. 제도와 숫자', 3)
  on conflict (user_id, title) do nothing;

  get diagnostics n = row_count;
  return n;
end;
$fn$;

-- 이미 가입한 사람에게도 깔아준다 (중복은 on conflict 가 막는다)
do $$
declare u record;
begin
  for u in select id from auth.users loop
    perform public.seed_topics(u.id);
  end loop;
end $$;

-- 신규 가입 시에도 자동으로
create or replace function public.handle_new_user_topics()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
begin
  perform public.seed_topics(new.id);
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created_topics on auth.users;
create trigger on_auth_user_created_topics
  after insert on auth.users
  for each row execute function public.handle_new_user_topics();
