-- ============================================================
-- 노션 이관 2 — 페이지 본문 (나 자신)
--
-- 0001 을 먼저 돌린 뒤 이 파일을 실행한다.
-- 아래 MY_EMAIL 만 본인 계정으로 맞으면 된다.
--
-- 0001 은 데이터베이스 두 개(비전보드 · 커리어)를 옮겼다.
-- 이 파일은 My Identity 페이지 본문에 있던 것들을 옮긴다 —
-- 자기소개, My Expertise, 그리고 이모지 불릿으로 나열되어 있던
-- 일상 취미 · 운동 · 자산 · 언어 목록 20개.
-- ============================================================

do $$
declare
  MY_EMAIL text := 'hayoung.lee@softcamp.co.kr';   -- ← 본인 계정

  uid uuid;
  r_softcamp uuid; r_study uuid; r_fit uuid; r_life uuid;
  c_places uuid; c_golf uuid; c_wish uuid; c_watch uuid; c_books uuid;
  h_read uuid; h_bible uuid; h_music uuid;
  g_cash uuid; g_save uuid; g_english uuid;
begin
  select id into uid from auth.users where lower(email) = lower(MY_EMAIL);
  if uid is null then
    raise exception '계정을 찾을 수 없습니다: %. 앱에 먼저 한 번 로그인해 주세요.', MY_EMAIL;
  end if;

  select id into r_softcamp from public.roles where user_id = uid and name = '소프트캠프';
  select id into r_study    from public.roles where user_id = uid and name = '학습';
  select id into r_fit      from public.roles where user_id = uid and name = '운동';
  select id into r_life     from public.roles where user_id = uid and name = '취미·일상';
  if r_life is null then
    raise exception '0001_from_notion.sql 을 먼저 실행해 주세요.';
  end if;

  -- ----------------------------------------------------------
  -- 프로필 — 노션 'Dlgkdud' 소개글
  --
  -- 생년월일과 입사일을 날짜 컬럼으로 둔다. 서사 안의 문장으로 두면
  -- 아무 일도 일어나지 않지만, 날짜로 두면 생일과 근속 기념일에
  -- 비서가 먼저 말을 건다.
  -- ----------------------------------------------------------
  update public.profiles set
    birth_date        = '1996-09-19',
    birth_place       = '경기도 성남',
    career_started_at = '2024-12-23',
    company           = '(주)소프트캠프',
    job_title         = '기술교육 플랫폼 운영 관리 · 보안 솔루션 기술지원',
    bio = E'1996년 9월 19일 오전 11시, 경기도 성남에서 태어났다.\n\n'
       || E'**학력**\n'
       || E'오리초등학교 → 불곡중학교 → 불곡고등학교 → '
       || E'Berklee College of Music (Electronic Production & Design) → '
       || E'명지전문대학 (부동산경영과) → 한국외국어대학교 글로벌캠퍼스\n\n'
       || E'**전공**\n'
       || E'체코·슬로바키아학 · 이중전공 Software & AI\n\n'
       || E'**커리어**\n'
       || E'2024년 12월 23일부터 (주)소프트캠프에서 기술교육 플랫폼 운영 관리와 '
       || E'보안 솔루션 기술지원 직무로 커리어를 쌓고 있다.'
  where id = uid;

  -- ----------------------------------------------------------
  -- My Expertise — 전문 영역. 구조가 아니라 서사라서 메모로 둔다.
  -- ----------------------------------------------------------
  insert into public.notes (user_id, role_id, title, kind, body, tags, pinned)
  select uid, r_softcamp, 'My Expertise', 'note',
    E'## 1. 기술 교육 플랫폼 구축 및 운영\n'
 || E'- 사내 임직원 및 기술 파트너사 대상의 기술 교육 플랫폼 구축 및 총괄 운영\n'
 || E'- 문서보안 엔드포인트 및 보안 SaaS 제품군 대상 기술 커리큘럼 설계\n'
 || E'- 교육 효과 극대화를 위한 베네핏 프로그램 및 수료 체계 운영 관리\n\n'
 || E'## 2. 기술 콘텐츠 기획 및 제작\n'
 || E'- 복잡한 보안 메커니즘을 시각화한 영상 교육 콘텐츠 기획·제작·편집\n'
 || E'- 파트너사의 제품 이해도를 높이기 위한 기술 가이드 및 매뉴얼 자산화\n\n'
 || E'## 3. 프로젝트 매니징 (PM)\n'
 || E'- 기술 파트너사 및 고객사 대상 원격·방문 기술지원 솔루션 제공\n'
 || E'- 프로젝트 전반의 기술 이슈 트래킹 및 리스크 매니지먼트\n\n'
 || E'---\n\n'
 || E'> PM 경력표는 노션에서 예시 자리표시자 상태로 남아 있었다.\n'
 || E'> 실제 프로젝트로 채우는 것이 할 일 목록에 있다.',
    array['커리어', '소프트캠프'], true
  where not exists (select 1 from public.notes where user_id = uid and title = 'My Expertise');

  -- ----------------------------------------------------------
  -- 컬렉션 추가 — 본 것과 읽은 것을 담을 곳
  -- ----------------------------------------------------------
  insert into public.collections (user_id, slug, name, description, icon, kind, default_view, schema, sort_order)
  values
    (uid, 'watch', '본 것', '고전 영화 · 미드 · 다큐멘터리', '🎥', 'media', 'card',
     '{"fields":[
        {"key":"type","label":"종류","type":"select","options":["영화","시리즈","다큐"],"filterable":true},
        {"key":"year","label":"제작연도","type":"text"},
        {"key":"director","label":"감독·제작","type":"text"},
        {"key":"where","label":"어디서","type":"text"}]}'::jsonb, 6),

    (uid, 'books', '읽은 책', '소설 · 세계사 · 그 외', '📚', 'media', 'list',
     '{"fields":[
        {"key":"author","label":"저자","type":"text","filterable":true},
        {"key":"genre","label":"분야","type":"select","options":["소설","역사","경제","기술","그 외"],"filterable":true},
        {"key":"pages","label":"쪽수","type":"number"},
        {"key":"quote","label":"인상 깊은 구절","type":"text"}]}'::jsonb, 7)
  on conflict (user_id, slug) do nothing;

  select id into c_places from public.collections where user_id = uid and slug = 'places';
  select id into c_golf   from public.collections where user_id = uid and slug = 'golf';
  select id into c_wish   from public.collections where user_id = uid and slug = 'wishlist';
  select id into c_watch  from public.collections where user_id = uid and slug = 'watch';
  select id into c_books  from public.collections where user_id = uid and slug = 'books';

  select id into h_read  from public.habits where user_id = uid and title = '읽기';
  select id into h_bible from public.habits where user_id = uid and title = '요한복음 필사';
  select id into h_music from public.habits where user_id = uid and title = '플레이리스트 · 음악 큐레이션';

  select id into g_cash    from public.goals where user_id = uid and title = '2032년 유동현금 5억';
  select id into g_save    from public.goals where user_id = uid and title like '2026년까지 유동현금%';
  select id into g_english from public.goals where user_id = uid and title = '비즈니스 영어';

  -- ----------------------------------------------------------
  -- 관심사 20개 — 노션 페이지의 이모지 불릿 목록
  --
  -- 연결(habit/collection/goal)이 있으면 마지막 활동이 계산되고,
  -- 없으면 "아직 아무것도 없음"이 그대로 보인다. 둘 다 정보다.
  -- ----------------------------------------------------------
  insert into public.interests
    (user_id, role_id, title, area, emoji, note, status, habit_id, collection_id, goal_id, sort_order)
  values
    -- 🧠 일상 취미
    (uid, r_life, '소설 읽기',        'lifelog', '📚', null, 'active', h_read,  c_books, null, 1),
    (uid, r_life, '고전 영화 보기',   'lifelog', '🎥', null, 'active', null,    c_watch, null, 2),
    (uid, r_life, '미드 시청',        'lifelog', '📺', null, 'active', null,    c_watch, null, 3),
    (uid, r_life, '세계사 공부',      'lifelog', '🌏', null, 'active', null,    c_books, null, 4),
    (uid, r_life, '반려동물 케어',    'lifelog', '😼', '고양이 두 마리', 'active', null, null, null, 5),
    (uid, r_life, '성경 읽기',        'lifelog', '🏛️', '요한복음 필사', 'active', h_bible, null, null, 6),
    (uid, r_life, '다큐멘터리 시청',  'lifelog', '🎞️', null, 'active', null,   c_watch, null, 7),
    (uid, r_life, '음악 큐레이션',    'lifelog', '🎧', '플레이리스트 세팅', 'active', h_music, null, null, 8),
    (uid, r_life, '저장된 장소 방문·리뷰', 'lifelog', '📍', '맛집 · 공간 아카이빙', 'active', null, c_places, null, 9),

    -- 🏃 운동
    (uid, r_fit,  '수영',             'workout', '🏊', null, 'active', null, null,   null, 1),
    (uid, r_fit,  '필라테스',         'workout', '🧘', null, 'active', null, null,   null, 2),
    (uid, r_fit,  '골프',             'workout', '⛳', null, 'active', null, c_golf, null, 3),

    -- 💰 자산 · 소비
    (uid, null,   '미국 주식 투자',   'finance', '📈', null, 'active', null, null,   g_cash, 1),
    (uid, null,   '목표액 저축·자산 관리', 'finance', '🐖', null, 'active', null, null, g_save, 2),
    (uid, null,   '합리적인 쇼핑',    'finance', '🛍️', '맞춤형 쇼핑 플랫폼 활용', 'active', null, c_wish, null, 3),

    -- 🌐 공부하고 싶은 언어
    (uid, r_study, '영어',            'language', '🇺🇸', 'SHIELD Gate 브리핑 가능 수준까지', 'active', null, null, g_english, 1),
    (uid, r_study, '스페인어',        'language', '🇪🇸', null, 'someday', null, null, null, 2),
    (uid, r_study, '일본어',          'language', '🇯🇵', null, 'someday', null, null, null, 3),
    (uid, r_study, '중국어',          'language', '🇨🇳', null, 'someday', null, null, null, 4),
    (uid, r_study, '체코어',          'language', '🇨🇿', '학부 전공', 'someday', null, null, null, 5)
  on conflict (user_id, title) do nothing;

  raise notice '이관 2 완료: 프로필 · My Expertise 메모 · 컬렉션 2 · 관심사 20';
end $$;
