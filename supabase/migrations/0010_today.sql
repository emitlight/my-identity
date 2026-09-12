-- ============================================================
-- 0010 · Today 스냅샷
--
-- Today 는 테이블마다 쿼리를 날리지 않고 한 번에 받아온다.
-- 폰에서 1.5초 안에 떠야 하고, 느리면 안 쓰게 된다.
-- ============================================================

-- ------------------------------------------------------------
-- 연속 일수. 오늘 체크했으면 오늘부터, 아니면 어제부터 거슬러 센다.
-- (오늘 아직 안 했다고 어제까지의 스트릭이 0이 되면 안 된다)
-- ------------------------------------------------------------
create or replace function public.habit_streak(p_habit uuid, p_as_of date)
returns int
language sql
stable
security invoker
as $$
  with anchor as (
    select p_as_of - (
      case when exists (
        select 1 from public.habit_logs
         where habit_id = p_habit and logged_on = p_as_of
      ) then 0 else 1 end
    ) as d
  ),
  runs as (
    select l.logged_on,
           ((row_number() over (order by l.logged_on desc)) - 1)::int as offset_n
      from public.habit_logs l, anchor a
     where l.habit_id = p_habit
       and l.logged_on <= a.d
  )
  select coalesce(count(*), 0)::int
    from runs r, anchor a
   where r.logged_on = a.d - r.offset_n;
$$;

-- ------------------------------------------------------------
-- Today 한 번에 받아오기
-- ------------------------------------------------------------
create or replace function public.today_snapshot(p_today date, p_tz text default 'Asia/Seoul')
returns jsonb
language plpgsql
stable
security invoker
as $$
declare
  uid   uuid := auth.uid();
  from_ts timestamptz := (p_today::text || ' 00:00:00')::timestamp at time zone p_tz;
  to_ts   timestamptz := ((p_today + 1)::text || ' 00:00:00')::timestamp at time zone p_tz;
  result jsonb;
begin
  if uid is null then
    return jsonb_build_object('error', 'unauthenticated');
  end if;

  select jsonb_build_object(
    'today', p_today,

    'roles', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.sort_order, r.name)
        from public.roles r
       where r.user_id = uid and r.active
    ), '[]'::jsonb),

    -- 오늘 일정. 하나도 없으면 다음 일정 하나를 대신 보여준다.
    -- "오늘 일정 없음"만 뜨는 화면은 아무것도 알려주지 않는다.
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.all_day desc, e.starts_at)
        from public.events e
       where e.user_id = uid
         and e.starts_at >= from_ts and e.starts_at < to_ts
    ), '[]'::jsonb),

    'next_event', (
      select to_jsonb(e)
        from public.events e
       where e.user_id = uid and e.starts_at >= to_ts
       order by e.starts_at
       limit 1
    ),

    -- 오늘 할 일 + 마감이 지난 것. 오늘 배정하지 않았어도 마감이 지났으면
    -- 오늘의 문제다.
    'tasks', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.priority desc, t.due_at nulls last, t.created_at)
        from public.tasks t
       where t.user_id = uid
         and t.status in ('todo', 'doing')
         and (t.scheduled_for <= p_today or t.due_at < to_ts)
    ), '[]'::jsonb),

    'inbox_count', (
      select count(*) from public.tasks
       where user_id = uid and status = 'inbox'
    ),

    'habits', coalesce((
      select jsonb_agg(
               to_jsonb(h)
               || jsonb_build_object(
                    'done_today', exists (
                      select 1 from public.habit_logs hl
                       where hl.habit_id = h.id and hl.logged_on = p_today),
                    'streak', public.habit_streak(h.id, p_today))
               order by h.sort_order, h.title)
        from public.habits h
       where h.user_id = uid and h.active
    ), '[]'::jsonb),

    -- 노션이 3개월간 하지 않은 말을 여기서 한다.
    'alerts', coalesce((
      select jsonb_agg(a.card order by a.rank, a.card->>'title')
      from (
        -- 기한이 지난 목표
        select 1 as rank,
               jsonb_build_object(
                 'kind', 'overdue',
                 'title', g.title,
                 'body', to_char(g.period_end, 'MM월 DD일') || ' 마감 · '
                         || (p_today - g.period_end) || '일 경과',
                 'href', '/goals/' || g.id) as card
          from public.goals g
         where g.user_id = uid and g.status = 'active'
           and g.period_end is not null and g.period_end < p_today

        union all
        -- 한 달 안에 마감.
        -- 2주로 잡으면 분기 목표가 "18일 남음" 상태에서 아무 신호 없이
        -- 지나간다. 노션에서 TOPCIT 이 정확히 그렇게 마감을 넘겼다.
        select 2,
               jsonb_build_object(
                 'kind', 'due_soon',
                 'title', g.title,
                 'body', (g.period_end - p_today) || '일 남음',
                 'href', '/goals/' || g.id)
          from public.goals g
         where g.user_id = uid and g.status = 'active'
           and g.period_end is not null
           and g.period_end >= p_today and g.period_end <= p_today + 30

        union all
        -- 기한 없이 오래 조용한 목표.
        -- 마감이 없으면 알림 근거가 없어 목록 아래로 가라앉는다.
        select 3,
               jsonb_build_object(
                 'kind', 'stale',
                 'title', g.title,
                 'body', extract(day from now() - g.last_activity_at)::int
                         || '일째 움직임 없음',
                 'href', '/goals/' || g.id)
          from public.goals g
         where g.user_id = uid and g.status = 'active'
           and g.period_end is null
           and g.stale_after_days is not null
           and g.last_activity_at < now() - make_interval(days => g.stale_after_days)
      ) a
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
