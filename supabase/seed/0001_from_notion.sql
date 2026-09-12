-- ============================================================
-- 노션 이관 — 2026-09-12 실사 기준
--
-- 사용법: Supabase SQL Editor 에 통째로 붙여넣고 Run.
--         아래 MY_EMAIL 만 본인 계정으로 맞으면 된다.
--         (먼저 앱에 한 번 로그인해서 계정이 만들어져 있어야 한다)
--
-- 여러 번 실행해도 중복되지 않는다. 이미 있는 제목은 건너뛴다.
--
-- 원본 형태를 그대로 옮기지 않는다. 같은 형태로 옮기면 같은 결과가 난다.
-- 노션의 17개는 성격이 4가지로 섞여 있었고, 분기·월이 날짜가 아니라
-- 텍스트 태그라서 마감을 계산할 수 없었다. 그래서:
--   · 목표 → goals (분기·월을 실제 날짜로)
--   · 루틴 → habits (Status 를 떼고 스트릭으로)
--   · 아이템 → collection_items
--   · '구체적인 목표' 텍스트에 갇힌 실행 단위 → tasks
-- ============================================================

do $$
declare
  MY_EMAIL text := 'hayoung.lee@softcamp.co.kr';   -- ← 본인 계정

  uid uuid;
  r_softcamp uuid; r_law uuid; r_study uuid; r_fit uuid; r_life uuid;
  g_cash uuid; g_parent uuid;
  c_places uuid; c_golf uuid; c_countries uuid; c_wish uuid; c_music uuid;
  a_interior uuid;
begin
  select id into uid from auth.users where lower(email) = lower(MY_EMAIL);
  if uid is null then
    raise exception '계정을 찾을 수 없습니다: %. 앱에 먼저 한 번 로그인해 주세요.', MY_EMAIL;
  end if;

  -- ----------------------------------------------------------
  -- 역할 — 모든 일정·할 일·목표가 여기 걸리고 색으로 구분된다
  -- ----------------------------------------------------------
  insert into public.roles (user_id, name, description, color, icon, sort_order)
  values
    (uid, '소프트캠프', '기술교육 플랫폼 운영 · 보안 솔루션 기술지원 · PM', '#3A7CA5', '🏢', 1),
    (uid, '로스쿨 준비', '2028년 3월 입학', '#7161D1', '⚖️', 2),
    (uid, '학습',       'TOPCIT · 자격증 · 언어',                  '#41916B', '📚', 3),
    (uid, '운동',       '수영 · 필라테스 · 골프',                  '#C2703F', '⛳', 4),
    (uid, '취미·일상',  '독서 · 고전영화 · 미드 · 세계사 · 반려묘', '#8E6BB8', '🎧', 5)
  on conflict (user_id, name) do nothing;

  select id into r_softcamp from public.roles where user_id = uid and name = '소프트캠프';
  select id into r_law      from public.roles where user_id = uid and name = '로스쿨 준비';
  select id into r_study    from public.roles where user_id = uid and name = '학습';
  select id into r_fit      from public.roles where user_id = uid and name = '운동';
  select id into r_life     from public.roles where user_id = uid and name = '취미·일상';

  -- ----------------------------------------------------------
  -- 핵심 가치 — 노션 페이지 상단에 걸어둔 문장
  -- ----------------------------------------------------------
  insert into public.core_values (user_id, title, description, sort_order)
  values (uid, '생각하는 대로 살지 않으면 사는 대로 생각하게 된다',
          '노션 My Identity 페이지 상단에 걸어둔 문장', 1)
  on conflict (user_id, title) do nothing;

  -- ----------------------------------------------------------
  -- 목표 — 분기·월 multi-select 를 실제 날짜로 바꾼다.
  -- 이 변환 하나로 마감 알림이 동작하기 시작한다.
  -- ----------------------------------------------------------

  -- 기한이 지났던 두 건(Microsoft 자격증, 업계 박람회)은 요청대로 기한을
  -- 비운다. 대신 last_activity_at 을 지금으로 두어 60일간은 조용히 둔다.
  -- 옮기자마자 "90일째 방치" 라고 떠들면 첫 화면이 잔소리가 된다.

  insert into public.goals
    (user_id, role_id, title, description, horizon, period_start, period_end,
     metric_key, metric_target, metric_unit, status)
  select * from (values
    (uid, r_life,     '1막 마무리',            '2027.10 대관식',                          'life'::goal_horizon, null::date, '2027-10-31'::date, null::text, null::numeric, null::text, 'active'::goal_status),
    (uid, null,       '2032년 유동현금 5억',   '장기 자산 목표',                           'life',   null, '2032-12-31', '유동현금', 500000000, '원', 'active'),
    (uid, r_law,      '로스쿨 입학',           '28년도 3월 입학',                          'life',   null, '2028-03-01', null, null, null, 'active'),
    (uid, r_study,    'TOPCIT 900점',          '900점 달성',                               'quarter','2026-07-01', '2026-09-30', 'TOPCIT', 900, '점', 'active'),
    (uid, r_life,     '언어 교환 동아리 가입', '모임 여러 곳 비교 후 1곳 가입 · 월 2회 참여','quarter','2026-07-01', '2026-09-30', null, null, null, 'active'),
    (uid, r_study,    'Microsoft 자격증',      '초급 과정 자격증 취득',                    'year',   null, null, null, null, null, 'active'),
    (uid, r_softcamp, '업계 박람회·세미나 네트워킹', '2~3곳 방문 · 명함 50장 · 15초 자기소개', 'year', null, null, '명함', 50, '장', 'active'),
    (uid, r_softcamp, '비즈니스 영어',         'SHIELD Gate 개념과 컨셉을 브리핑 가능하도록','year',   null, null, null, null, null, 'active'),
    (uid, r_softcamp, 'CC본부 R&R 정립',       '비즈니스 매너와 전문 업무 능력, 나의 R&R',  'year',   null, null, null, null, null, 'active')
  ) v(a,b,c,d,e,f,g,h,i,j,k)
  where not exists (select 1 from public.goals where user_id = uid and title = v.c);

  -- 5억 목표의 첫 마일스톤. 노션의 '구체적인 목표'에 적혀 있던 것을
  -- 하위 목표로 꺼낸다. 텍스트 안에 있으면 진척을 볼 수 없다.
  select id into g_parent from public.goals where user_id = uid and title = '2032년 유동현금 5억';
  insert into public.goals
    (user_id, parent_id, title, description, horizon, period_end, metric_key, metric_target, metric_unit, status)
  select uid, g_parent, '2026년까지 유동현금 3,000만원', '5억 목표의 첫 마일스톤',
         'year', '2026-12-31', '유동현금', 30000000, '원', 'active'
  where not exists (select 1 from public.goals where user_id = uid and title like '2026년까지 유동현금%');

  -- ----------------------------------------------------------
  -- 습관 — 노션에서는 Status='Not started' 로 굳어 있던 것들.
  -- 비타민을 매일 먹는 건 '완료'되는 종류의 일이 아니다.
  -- ----------------------------------------------------------
  insert into public.habits (user_id, role_id, title, cadence, target_per_period, sort_order)
  values
    (uid, r_fit,  '종합비타민',                  'daily',  1, 1),
    (uid, r_life, '요한복음 필사',               'daily',  1, 2),
    (uid, r_life, '읽기',                        'daily',  1, 3),
    (uid, r_life, '플레이리스트 · 음악 큐레이션', 'weekly', 1, 4)
  on conflict (user_id, title) do nothing;

  -- ----------------------------------------------------------
  -- 추구미 — 노션 'Future Wishlist' 가 이미 추구미 목록이었다
  -- ----------------------------------------------------------
  insert into public.aspirations (user_id, role_id, title, statement, domain, capture_cadence)
  values
    (uid, null,   '인테리어 및 공간 스타일링', '내 공간이 나를 닮아 있으면 좋겠다',   'space',  'monthly'),
    (uid, null,   '전원생활',                  '언젠가 흙을 밟으며 사는 삶',          'space',  'quarterly'),
    (uid, r_fit,  '서핑',                      '바다에서 노는 사람',                  'body',   'quarterly'),
    (uid, r_life, '재즈 피아노 연주',          'Berklee 에서 배운 것을 손으로 되찾기','other',  'quarterly'),
    (uid, r_life, '제철음식 탐방',             '계절을 먹는 사람',                    'other',  'quarterly')
  on conflict (user_id, title) do nothing;

  select id into a_interior from public.aspirations where user_id = uid and title like '인테리어%';

  -- ----------------------------------------------------------
  -- 컬렉션 — 노션 Lifelog 에 "저장된 장소 방문 및 리뷰 작성
  -- (맛집/공간 아카이빙)" 이 이미 적혀 있었다. 담을 그릇이 없었을 뿐이다.
  -- ----------------------------------------------------------
  insert into public.collections (user_id, slug, name, description, icon, kind, default_view, schema, sort_order)
  select * from (values
    (uid, 'places', '저장된 장소', '맛집 · 카페 · 공간 아카이빙', '📍', 'place'::collection_kind, 'map'::collection_view,
     '{"fields":[
        {"key":"category","label":"종류","type":"select","options":["한식","중식","일식","양식","카페","바","기타"],"filterable":true},
        {"key":"price_range","label":"가격대","type":"select","options":["1만 이하","1~3만","3~5만","5만+"],"filterable":true},
        {"key":"parking","label":"주차","type":"bool","filterable":true},
        {"key":"booking","label":"예약 필요","type":"bool"},
        {"key":"signature","label":"대표 메뉴","type":"text"},
        {"key":"hours","label":"영업시간","type":"text"}]}'::jsonb, 1),

    (uid, 'golf', '골프장', '수도권 중심', '⛳', 'place', 'map',
     '{"fields":[
        {"key":"holes","label":"홀수","type":"select","options":["9","18","27","36"],"filterable":true},
        {"key":"green_fee_weekday","label":"그린피(주중)","type":"number"},
        {"key":"green_fee_weekend","label":"그린피(주말)","type":"number"},
        {"key":"caddie","label":"캐디","type":"select","options":["캐디","노캐디","선택"],"filterable":true},
        {"key":"booking_difficulty","label":"부킹 난이도","type":"select","options":["쉬움","보통","어려움"]},
        {"key":"distance_min","label":"집에서(분)","type":"number"}]}'::jsonb, 2),

    (uid, 'countries', '다녀온 나라', '7개국 16개 도시', '🌏', 'place', 'map',
     '{"fields":[
        {"key":"country","label":"국가","type":"text","filterable":true},
        {"key":"year","label":"방문 시기","type":"text"}]}'::jsonb, 3),

    (uid, 'wishlist', '위시리스트', '사고 싶은 것', '🛍️', 'product', 'card',
     '{"fields":[
        {"key":"category","label":"분류","type":"select","options":["의류","화장품","전자기기","가구","기타"],"filterable":true},
        {"key":"price","label":"가격","type":"number"},
        {"key":"link","label":"링크","type":"text"}]}'::jsonb, 4),

    (uid, 'music', '음악', '플레이리스트 · 튠 리스트', '🎧', 'media', 'list',
     '{"fields":[
        {"key":"artist","label":"아티스트","type":"text","filterable":true},
        {"key":"mood","label":"무드","type":"text"}]}'::jsonb, 5)
  ) v(a,b,c,d,e,f,g,h,i)
  where not exists (select 1 from public.collections where user_id = uid and slug = v.b);

  select id into c_places    from public.collections where user_id = uid and slug = 'places';
  select id into c_golf      from public.collections where user_id = uid and slug = 'golf';
  select id into c_countries from public.collections where user_id = uid and slug = 'countries';
  select id into c_wish      from public.collections where user_id = uid and slug = 'wishlist';
  select id into c_music     from public.collections where user_id = uid and slug = 'music';

  -- 노션 '아이템' 카테고리
  insert into public.collection_items (user_id, collection_id, title, status, data)
  select * from (values
    (uid, c_wish,  'attire',    'wishlist'::item_status, '{"category":"의류"}'::jsonb),
    (uid, c_wish,  'cosmetics', 'wishlist', '{"category":"화장품"}'::jsonb),
    (uid, c_music, 'tune list', 'wishlist', '{}'::jsonb)
  ) v(a,b,c,d,e)
  where not exists (
    select 1 from public.collection_items where user_id = uid and collection_id = v.b and title = v.c);

  -- 다녀온 나라 — 이미 페이지에 정리되어 있던 것. 지도 뷰로 바로 쓸 수 있다.
  insert into public.collection_items
    (user_id, collection_id, title, status, region, lat, lng, data)
  select * from (values
    (uid, c_countries, '도쿄',         'visited'::item_status, '일본',       35.6762,  139.6503, '{"country":"일본"}'::jsonb),
    (uid, c_countries, '나고야',       'visited', '일본',       35.1815,  136.9066, '{"country":"일본"}'::jsonb),
    (uid, c_countries, '하마마츠',     'visited', '일본',       34.7108,  137.7261, '{"country":"일본"}'::jsonb),
    (uid, c_countries, '오키나와',     'visited', '일본',       26.2124,  127.6809, '{"country":"일본"}'::jsonb),
    (uid, c_countries, '보스턴',       'visited', '미국',       42.3601,  -71.0589, '{"country":"미국"}'::jsonb),
    (uid, c_countries, '뉴욕',         'visited', '미국',       40.7128,  -74.0060, '{"country":"미국"}'::jsonb),
    (uid, c_countries, '텍사스',       'visited', '미국',       null,     null,     '{"country":"미국"}'::jsonb),
    (uid, c_countries, '프라하',       'visited', '체코',       50.0755,   14.4378, '{"country":"체코"}'::jsonb),
    (uid, c_countries, '브르노',       'visited', '체코',       49.1951,   16.6068, '{"country":"체코"}'::jsonb),
    (uid, c_countries, '브라티슬라바', 'visited', '슬로바키아', 48.1486,   17.1077, '{"country":"슬로바키아"}'::jsonb),
    (uid, c_countries, '비엔나',       'visited', '오스트리아', 48.2082,   16.3738, '{"country":"오스트리아"}'::jsonb),
    (uid, c_countries, '부다페스트',   'visited', '헝가리',     47.4979,   19.0402, '{"country":"헝가리"}'::jsonb),
    (uid, c_countries, '다낭',         'visited', '베트남',     16.0544,  108.2022, '{"country":"베트남"}'::jsonb),
    (uid, c_countries, '하노이',       'visited', '베트남',     21.0285,  105.8542, '{"country":"베트남"}'::jsonb),
    (uid, c_countries, '사파',         'visited', '베트남',     22.3364,  103.8438, '{"country":"베트남"}'::jsonb)
  ) v(a,b,c,d,e,f,g,h)
  where not exists (
    select 1 from public.collection_items where user_id = uid and collection_id = v.b and title = v.c);

  -- ----------------------------------------------------------
  -- 할 일 — '구체적인 목표' 텍스트 안에 갇혀 있던 실행 단위들.
  -- 텍스트는 체크할 수 없고, 체크할 수 없으면 실행되지 않는다.
  -- ----------------------------------------------------------
  insert into public.tasks (user_id, role_id, title, status, notes)
  select * from (values
    (uid, r_study,    'TOPCIT 기출 1회분 풀기',              'todo'::task_status, '900점 목표'),
    (uid, r_study,    'Microsoft 초급 과정 시험일 확인',      'inbox', null),
    (uid, r_softcamp, '15초 자기소개 준비',                   'inbox', '박람회·세미나용'),
    (uid, r_softcamp, '참석할 업계 박람회 2~3곳 고르기',      'inbox', null),
    (uid, r_life,     '언어 교환 모임 3곳 비교',              'inbox', null),
    (uid, r_life,     '언어 교환 모임 1곳 가입',              'inbox', null),
    (uid, r_fit,      '종합비타민 아침 알람 설정',            'inbox', '식후 복용'),
    (uid, r_softcamp, 'SHIELD Gate 브리핑 스크립트 초안',     'inbox', '비즈니스 영어'),
    (uid, r_law,      '로스쿨 입시 일정·요강 정리',           'inbox', '2028년 3월 입학'),
    (uid, r_softcamp, 'My Expertise PM 경력표 실제 내용 채우기','inbox', '예시 자리표시자가 그대로 남아 있음')
  ) v(a,b,c,d,e)
  where not exists (select 1 from public.tasks where user_id = uid and title = v.c);

  -- ----------------------------------------------------------
  -- 맥락 서피싱 규칙 — 자료가 나를 기다리지 않고 나를 찾아오게 한다
  -- ----------------------------------------------------------
  insert into public.surfacing_rules (user_id, collection_id, label, trigger, priority)
  select * from (values
    (uid, c_places, '일정 지역에 저장해둔 장소',
     '{"type":"event_region","item_status":"wishlist"}'::jsonb, 1),
    (uid, c_golf, '주말 아침 골프장',
     '{"type":"day_of_week","days":[6,0]}'::jsonb, 2)
  ) v(a,b,c,d,e)
  where not exists (
    select 1 from public.surfacing_rules where user_id = uid and label = v.c);

  raise notice '이관 완료: 역할 5 · 목표 10 · 습관 4 · 추구미 5 · 컬렉션 5 · 항목 18 · 할 일 10 · 서피싱 규칙 2';
end $$;
