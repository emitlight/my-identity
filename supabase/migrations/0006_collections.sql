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
