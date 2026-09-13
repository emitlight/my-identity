-- ============================================================
-- 노션 이관 3 — 남은 전부
--
-- 0001, 0002 를 먼저 돌린 뒤 실행한다.
--
-- 1차·2차에서 빠졌던 것들:
--   · 비전보드 '5월 연휴 가족여행' 과 그 안에 텍스트로 갇혀 있던 할 일
--   · '종합비타민' 의 두 번째 실행 항목 (복용 전후 컨디션 기록)
--   · '읽기' 의 목적 (뇌의 힘 기르기)
--   · 별도 '메모' 페이지 — 버킷리스트 with M, 개인 할 일
-- ============================================================

do $$
declare
  MY_EMAIL text := 'hayoung.lee@softcamp.co.kr';   -- ← 본인 계정

  uid uuid;
  r_life uuid; r_fit uuid;
  c_bucket uuid; c_books uuid;
  p_trip uuid;
begin
  select id into uid from auth.users where lower(email) = lower(MY_EMAIL);
  if uid is null then
    raise exception '계정을 찾을 수 없습니다: %', MY_EMAIL;
  end if;

  select id into r_life from public.roles where user_id = uid and name = '취미·일상';
  select id into r_fit  from public.roles where user_id = uid and name = '운동';
  select id into c_books from public.collections where user_id = uid and slug = 'books';
  if r_life is null or c_books is null then
    raise exception '0001, 0002 를 먼저 실행해 주세요.';
  end if;

  -- ----------------------------------------------------------
  -- 5월 연휴 가족여행
  --
  -- 비전보드에 있었는데 1차 이관에서 빠졌다. 이건 목표가 아니라
  -- 프로젝트다 — 날짜가 있고 그 아래 실행 단위가 여럿 달린다.
  -- '구체적인 목표' 텍스트에 갇혀 있던 두 줄을 할 일로 꺼낸다.
  -- ----------------------------------------------------------
  insert into public.projects (user_id, role_id, title, description, area, status, due_date)
  select uid, r_life, '5월 연휴 가족여행', '예산 150만원 이내', 'personal', 'active', '2027-05-01'
  where not exists (select 1 from public.projects where user_id = uid and title = '5월 연휴 가족여행');

  select id into p_trip from public.projects where user_id = uid and title = '5월 연휴 가족여행';

  insert into public.tasks (user_id, role_id, project_id, title, status, due_at, notes)
  select * from (values
    (uid, r_life, p_trip, '항공·숙소 확정', 'todo'::task_status,
     '2027-03-31T23:59:00+09'::timestamptz, '예산 150만원 이내'),
    (uid, r_life, p_trip, '3일 일정표 만들기', 'inbox', null::timestamptz, null::text),
    -- 이 한 줄이 맥락 서피싱과 정확히 만나는 지점이다.
    -- 여행지를 캘린더에 넣으면 그 지역 저장 장소가 알아서 올라온다.
    (uid, r_life, p_trip, '여행지 맛집 찾기', 'inbox', null,
     '저장된 장소 컬렉션에 지역과 함께 넣어두면 여행 당일 아침에 알아서 올라옵니다')
  ) v(a,b,c,d,e,f,g)
  where not exists (select 1 from public.tasks where user_id = uid and title = v.d);

  -- 종합비타민의 두 번째 실행 항목
  insert into public.tasks (user_id, role_id, title, status, notes)
  select uid, r_fit, '복용 전후 컨디션 기록 시작', 'inbox', '종합비타민 30일 체크리스트와 함께'
  where not exists (select 1 from public.tasks where user_id = uid and title like '복용 전후 컨디션%');

  -- '읽기' 의 목적. 비전보드에 "뇌의 힘 기르기" 로 적혀 있었다.
  update public.interests
     set note = '뇌의 힘 기르기'
   where user_id = uid and title = '소설 읽기' and note is null;

  -- ----------------------------------------------------------
  -- 메모 페이지 — 버킷리스트 with M
  --
  -- 장소형 컬렉션으로 만든다. region 을 넣어두면 그 지역 일정이
  -- 잡히는 날 알아서 올라온다. "언젠가 가고 싶다"가 목록에만
  -- 남아 있으면 영영 안 간다.
  -- ----------------------------------------------------------
  insert into public.collections (user_id, slug, name, description, icon, kind, default_view, schema, sort_order)
  values (uid, 'bucket', '버킷리스트', '언젠가 하고 싶은 것', '🎯', 'place', 'list',
    '{"fields":[
       {"key":"area","label":"분류","type":"select","options":["여행·방문","생활·인테리어","경험","그 외"],"filterable":true},
       {"key":"with","label":"누구와","type":"text","filterable":true},
       {"key":"budget","label":"예상 예산","type":"number"}]}'::jsonb, 8)
  on conflict (user_id, slug) do nothing;

  select id into c_bucket from public.collections where user_id = uid and slug = 'bucket';

  insert into public.collection_items
    (user_id, collection_id, title, status, region, summary, body, data)
  select * from (values
    (uid, c_bucket, '제주도', 'wishlist'::item_status, '제주', null::text, null::text,
     '{"area":"여행·방문","with":"M"}'::jsonb),
    (uid, c_bucket, '부산', 'wishlist', '부산', '서면 방문 · 고급 호텔 레스토랑 식사',
     E'- 서면 방문\n- 컴플릿 후 부산 고급 호텔에서 레스토랑 식사',
     '{"area":"여행·방문","with":"M"}'::jsonb),
    (uid, c_bucket, '미국 보스턴', 'wishlist', null, 'Berklee 시절의 도시', null,
     '{"area":"여행·방문","with":"M"}'::jsonb),
    (uid, c_bucket, '미국 시애틀', 'wishlist', null, '사촌 방문 · 골프 라운딩',
     E'- 사촌 방문\n- 골프 라운딩', '{"area":"여행·방문","with":"M"}'::jsonb)
  ) v(a,b,c,d,e,f,g,h)
  where not exists (
    select 1 from public.collection_items where user_id = uid and collection_id = v.b and title = v.c);

  -- 버킷리스트도 서피싱 대상. 부산 일정이 잡히면 부산이 올라온다.
  insert into public.surfacing_rules (user_id, collection_id, label, trigger, priority)
  select uid, c_bucket, '일정 지역 버킷리스트', '{"type":"event_region"}'::jsonb, 3
  where not exists (
    select 1 from public.surfacing_rules where user_id = uid and label = '일정 지역 버킷리스트');

  -- 관심사로도 걸어둔다 — 아직 아무것도 안 했다는 게 보이게
  insert into public.interests (user_id, role_id, title, area, emoji, note, status, collection_id, sort_order)
  values (uid, r_life, '버킷리스트 실행', 'lifelog', '🎯', 'M 과 함께', 'active', c_bucket, 10)
  on conflict (user_id, title) do nothing;

  -- 메모 페이지 — 개인 할 일
  insert into public.tasks (user_id, role_id, title, status, notes)
  select uid, r_life, '철학 콘서트 1·2·3 읽기', 'inbox', '노션 메모 페이지에서'
  where not exists (select 1 from public.tasks where user_id = uid and title like '철학 콘서트%');

  insert into public.collection_items (user_id, collection_id, title, status, data)
  select uid, c_books, '철학 콘서트 1·2·3', 'wishlist', '{"genre":"그 외"}'::jsonb
  where not exists (
    select 1 from public.collection_items
     where user_id = uid and collection_id = c_books and title like '철학 콘서트%');

  raise notice '이관 3 완료: 프로젝트 1 · 할 일 5 · 버킷리스트 4 · 서피싱 규칙 1';
end $$;
