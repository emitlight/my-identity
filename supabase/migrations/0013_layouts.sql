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
