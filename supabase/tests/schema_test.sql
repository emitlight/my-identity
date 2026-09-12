-- ============================================================
-- 스키마 검증 — scripts/test-db.sh 로 실행한다.
--
-- RLS 는 키가 유출돼도 남의 데이터가 안 나가게 하는 마지막 방어선이다.
-- 테이블을 추가할 때마다 여기에 한 줄을 추가하는 것이 규약이다.
-- ============================================================
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on

\set ME   '''11111111-1111-1111-1111-111111111111'''
\set THEM '''22222222-2222-2222-2222-222222222222'''

insert into auth.users (id, email) values (:ME, 'me@example.com'), (:THEM, 'other@example.com');

insert into public.roles       (user_id, name)  values (:ME, '사업가'),   (:THEM, '남의역할');
insert into public.tasks       (user_id, title) values (:ME, '내 할일'),  (:THEM, '남의 할일');
insert into public.projects    (user_id, title) values (:ME, '내 프로젝트'), (:THEM, '남의 프로젝트');
insert into public.notes       (user_id, body)  values (:ME, '내 메모'),  (:THEM, '남의 메모');
insert into public.collections (user_id, slug, name) values (:ME,'a','내 컬렉션'), (:THEM,'b','남의 컬렉션');
insert into public.events (user_id, title, starts_at, region) values
  (:ME, '대전 출장', now(), '대전'), (:THEM, '남의 일정', now(), '서울');
insert into public.aspirations (user_id, title) values (:ME, '우드톤 작업 공간'), (:THEM, '남의 추구미');

\echo '=== RLS: 사용자 A 에게 자기 행만 보이는가 ==='
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

  select format('%-20s %s', t, case when n = want then 'PASS' else format('FAIL (%s, 기대 %s)', n, want) end)
  from (
    select 'roles' t, count(*) n, 1 want from public.roles
    union all select 'tasks',              count(*), 1 from public.tasks
    union all select 'projects',           count(*), 1 from public.projects
    union all select 'notes',              count(*), 1 from public.notes
    union all select 'collections',        count(*), 1 from public.collections
    union all select 'events',             count(*), 1 from public.events
    union all select 'aspirations',        count(*), 1 from public.aspirations
    union all select 'profiles',           count(*), 1 from public.profiles
    union all select 'notification_rules', count(*), 8 from public.notification_rules
  ) s order by t;
commit;

\echo ''
\echo '=== 쓰기 방어 · 제약 · 트리거 ==='
do $$
declare ok text;
begin
  -- 남의 user_id 로 삽입 시도
  begin
    set local role authenticated;
    perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
    insert into public.tasks (user_id, title) values ('22222222-2222-2222-2222-222222222222', '침투');
    ok := 'FAIL';
  exception when insufficient_privilege then ok := 'PASS';
  end;
  raise notice '%', format('%-28s %s', '남의 행 삽입 차단', ok);
  reset role;
end $$;

update public.tasks set status = 'done' where title = '내 할일';
select format('%-28s %s', '완료시각 자동 기록',
       case when completed_at is not null then 'PASS' else 'FAIL' end)
from public.tasks where title = '내 할일';

update public.tasks set status = 'todo' where title = '내 할일';
select format('%-28s %s', '완료 취소시 시각 제거',
       case when completed_at is null then 'PASS' else 'FAIL' end)
from public.tasks where title = '내 할일';

do $$
declare aid uuid;
begin
  select id into aid from public.aspirations where title = '우드톤 작업 공간';
  begin
    insert into public.aspiration_refs (user_id, aspiration_id, why)
    values ('11111111-1111-1111-1111-111111111111', aid, '   ');
    raise notice '%', format('%-28s %s', '레퍼런스 why 공백 차단', 'FAIL');
  exception when check_violation then
    raise notice '%', format('%-28s %s', '레퍼런스 why 공백 차단', 'PASS');
  end;
end $$;

do $$
declare hid uuid;
begin
  insert into public.habits (user_id, title)
  values ('11111111-1111-1111-1111-111111111111', '6시 기상') returning id into hid;
  insert into public.habit_logs (user_id, habit_id, logged_on)
  values ('11111111-1111-1111-1111-111111111111', hid, current_date);
  begin
    insert into public.habit_logs (user_id, habit_id, logged_on)
    values ('11111111-1111-1111-1111-111111111111', hid, current_date);
    raise notice '%', format('%-28s %s', '습관 하루 중복 차단', 'FAIL');
  exception when unique_violation then
    raise notice '%', format('%-28s %s', '습관 하루 중복 차단', 'PASS');
  end;
end $$;

do $$
begin
  insert into public.notifications (user_id, kind, title, dedupe_key)
  values ('11111111-1111-1111-1111-111111111111', 'morning_brief', '아침', 'morning_brief:test');
  begin
    insert into public.notifications (user_id, kind, title, dedupe_key)
    values ('11111111-1111-1111-1111-111111111111', 'morning_brief', '아침 또', 'morning_brief:test');
    raise notice '%', format('%-28s %s', '알림 중복 발송 차단', 'FAIL');
  exception when unique_violation then
    raise notice '%', format('%-28s %s', '알림 중복 발송 차단', 'PASS');
  end;
end $$;

\echo ''
\echo '=== RLS 미적용 테이블 (있으면 안 됨) ==='
select coalesce(string_agg(c.relname, ', '), '없음 · PASS')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

\echo ''
\echo '=== Today 스냅샷 · 스트릭 ==='
do $$
declare hid uuid; snap jsonb; me uuid := '11111111-1111-1111-1111-111111111111';
begin
  -- 연속 3일 체크 후 하루 건너뛰고 2일
  insert into public.habits (user_id, title) values (me, '스트릭 테스트') returning id into hid;
  insert into public.habit_logs (user_id, habit_id, logged_on) values
    (me, hid, current_date),
    (me, hid, current_date - 1),
    (me, hid, current_date - 2),
    (me, hid, current_date - 5);
  raise notice '%', format('%-28s %s', '스트릭 = 3 (갭 무시)',
    case when public.habit_streak(hid, current_date) = 3 then 'PASS'
         else 'FAIL (' || public.habit_streak(hid, current_date) || ')' end);

  -- 오늘 미체크여도 어제까지의 스트릭은 유지되어야 한다
  delete from public.habit_logs where habit_id = hid and logged_on = current_date;
  raise notice '%', format('%-28s %s', '오늘 미체크시 스트릭 2',
    case when public.habit_streak(hid, current_date) = 2 then 'PASS'
         else 'FAIL (' || public.habit_streak(hid, current_date) || ')' end);
end $$;

do $$
declare snap jsonb; me uuid := '11111111-1111-1111-1111-111111111111';
begin
  -- 기한이 지난 목표와 조용한 목표를 하나씩
  insert into public.goals (user_id, title, horizon, period_end, status)
    values (me, 'Microsoft 자격증', 'quarter', current_date - 60, 'active');
  insert into public.goals (user_id, title, horizon, period_end, status)
    values (me, 'TOPCIT 900점', 'quarter', current_date + 10, 'active');
  insert into public.goals (user_id, title, horizon, period_end, status, stale_after_days)
    values (me, '로스쿨', 'life', null, 'active', 30);
  update public.goals set last_activity_at = now() - interval '90 days' where title = '로스쿨';

  perform set_config('request.jwt.claim.sub', me::text, true);
  snap := public.today_snapshot(current_date);

  raise notice '%', format('%-28s %s', 'Today 스냅샷 생성',
    case when snap ? 'alerts' then 'PASS' else 'FAIL' end);
  raise notice '%', format('%-28s %s', '기한 초과 경고 감지',
    case when snap->'alerts' @> '[{"kind":"overdue"}]'::jsonb then 'PASS' else 'FAIL' end);
  raise notice '%', format('%-28s %s', '마감 임박 경고 감지',
    case when snap->'alerts' @> '[{"kind":"due_soon"}]'::jsonb then 'PASS' else 'FAIL' end);
  raise notice '%', format('%-28s %s', '방치 목표 감지',
    case when snap->'alerts' @> '[{"kind":"stale"}]'::jsonb then 'PASS' else 'FAIL' end);
  raise notice '%', format('%-28s %s', '경고 3건 전부',
    case when jsonb_array_length(snap->'alerts') = 3 then 'PASS'
         else 'FAIL (' || jsonb_array_length(snap->'alerts') || ')' end);
end $$;
