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
