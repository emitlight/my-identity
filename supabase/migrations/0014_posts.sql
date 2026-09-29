-- ============================================================
-- 0014 · 글
--
-- 잡지에 실리는 '쓴 글'. 기존 세 가지와 겹치지 않는다.
--   notes            빠르게 적는 메모. 제목도 없어도 된다.
--   journal_entries  날짜에 묶인 회고. 형식이 정해져 있다.
--   collection_items 사물의 기록(장소·책·나라). 대상이 있다.
--   posts            ← 대상 없이 쓰는 글. 제목·표지·발행이 있다.
--
-- 초안과 발행을 나눈다. 쓰다 만 글이 지면에 올라가면 다시는 안 쓰게 된다.
-- ============================================================

do $ident$ begin
  create type post_status as enum ('draft', 'published');
exception when duplicate_object then null; end $ident$;

create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  role_id      uuid references public.roles(id) on delete set null,

  title        text not null,
  subtitle     text,
  -- 본문은 Markdown. 앱이 직접 조판하므로 HTML 은 저장하지 않는다.
  body         text not null default '',
  cover_url    text,
  tags         text[] not null default '{}',

  status       post_status not null default 'draft',
  published_at timestamptz,

  -- 주소에 쓰는 이름. 한글 제목이면 만들기 어려우므로 없으면 id 를 쓴다.
  slug         text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint posts_title_not_blank check (length(btrim(title)) > 0),
  -- 발행했으면 발행 시각이 있어야 한다. 없으면 목록 정렬이 무너진다.
  constraint posts_published_has_date
    check (status <> 'published' or published_at is not null)
);

select public.own_rows('public.posts');
select public.auto_touch('public.posts');

create unique index if not exists posts_slug_uniq
  on public.posts (user_id, slug) where slug is not null;
create index if not exists posts_feed_idx
  on public.posts (user_id, status, published_at desc);
-- 한국어 검색은 조사 때문에 형태소 사전 없이는 tsvector 가 안 맞는다.
-- notes 와 같은 이유로 trigram 을 쓴다.
create index if not exists posts_search_idx
  on public.posts using gin ((title || ' ' || coalesce(subtitle,'') || ' ' || body) gin_trgm_ops);

-- ------------------------------------------------------------
-- 발행 시각은 손으로 넣지 않는다. 상태가 바뀌는 순간 찍는다.
-- 여러 경로(에디터·목록의 발행 버튼)에서 상태를 바꾸므로 한 곳에서
-- 보장해야 한 쪽만 빠뜨리는 일이 안 생긴다.
-- ------------------------------------------------------------
create or replace function public.stamp_post_published()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_stamp_published on public.posts;
create trigger posts_stamp_published
  before insert or update of status on public.posts
  for each row execute function public.stamp_post_published();
