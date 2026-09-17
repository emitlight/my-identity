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

    -- ── 본지 피드 ────────────────────────────────────────────
    -- 모아둔 자료가 Today 아래에 사진 기사로 깔린다. 목록을 찾아
    -- 들어가야 보이는 자료는 결국 안 보게 되고, 그게 노션에서
    -- 일어난 일이다. 표지 아래로 흐르면 매일 눈에 들어온다.
    'feed', coalesce((
      select jsonb_agg(f order by f.sort_order, f.name)
      from (
        select c.id, c.slug, c.name, c.icon, c.cover_url, c.kind, c.sort_order,
               (select count(*) from public.collection_items ci
                 where ci.collection_id = c.id) as total,
               (select count(*) from public.collection_items ci
                 where ci.collection_id = c.id and ci.status = 'wishlist') as unseen,
               greatest(
                 (select max(ci.created_at) from public.collection_items ci
                   where ci.collection_id = c.id),
                 (select max(cl.logged_on)::timestamptz
                    from public.collection_item_logs cl
                    join public.collection_items ci2 on ci2.id = cl.item_id
                   where ci2.collection_id = c.id)
               ) as last_active
          from public.collections c
         where c.user_id = uid
      ) f
    ), '[]'::jsonb),

    -- ── 낱장 기사 ────────────────────────────────────────────
    -- 피드는 컬렉션(서랍)을 보여준다. 서랍만 늘어놓으면 결국 열어보지
    -- 않게 되므로, 서랍 안의 낱장 몇 개를 지면에 직접 깐다.
    -- 사진이 있는 것 · 아직 안 해본 것 · 최근에 넣은 것 순.
    'highlights', coalesce((
      select jsonb_agg(h order by h.rank, h.created_at desc)
      from (
        select ci.id, ci.title, ci.subtitle, ci.summary, ci.cover_url,
               ci.region, ci.rating, ci.status, ci.created_at,
               c.slug as collection_slug, c.name as collection_name,
               c.kind as collection_kind,
               (case when ci.cover_url is not null then 0 else 1 end
                + case when ci.status = 'wishlist' then 0 else 1 end) as rank
          from public.collection_items ci
          join public.collections c on c.id = ci.collection_id
         where ci.user_id = uid
         order by rank, ci.created_at desc
         limit 8
      ) h
    ), '[]'::jsonb),

    -- 추구미 한 꼭지. 레퍼런스가 모여 있고 증거를 찍을 때가 된 것을
    -- 우선으로 올린다.
    'aspiration', (
      select jsonb_build_object(
               'id', a.id, 'title', a.title, 'statement', a.statement,
               'cover_url', a.cover_url,
               'refs', (select count(*) from public.aspiration_refs r
                         where r.aspiration_id = a.id),
               'evidence', (select count(*) from public.aspiration_evidence e
                             where e.aspiration_id = a.id),
               'due_capture', a.capture_cadence <> 'off' and (
                 a.last_captured_at is null
                 or a.last_captured_at < now() - case a.capture_cadence
                      when 'monthly' then interval '30 days'
                      else interval '90 days' end))
        from public.aspirations a
       where a.user_id = uid and a.status = 'active'
       order by a.last_captured_at nulls first, a.started_at
       limit 1
    ),

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

        union all
        -- ── 맥락 서피싱 ────────────────────────────────────────
        -- 노션으로 불가능한 유일한 것. 저장해둔 자료가 읽히기를
        -- 기다리지 않고, 오늘 일정의 지역에 맞춰 스스로 올라온다.
        --
        --   캘린더에 "대전 출장"  →  대전에 저장해둔 미방문 맛집 3곳
        --
        -- rank 0 이라 경고 중 가장 위에 온다. 기한 경고보다 위인 이유는
        -- 이것만이 '지금 바로 쓸 수 있는' 정보이기 때문이다.
        select 0,
               jsonb_build_object(
                 'kind', 'surface',
                 'title', '오늘 ' || x.region || '이네요',
                 'body', x.cname || ' · 아직 안 가본 곳 ' || x.cnt || '군데',
                 'href', '/collections/' || x.cslug || '?region=' || x.region,
                 -- 이름 세 개를 같이 올린다. "3군데"만으로는 열어볼 이유가
                 -- 안 생기고, 이름이 보이면 그 자리에서 정해진다.
                 'chips', coalesce(x.picks, '[]'::jsonb),
                 'image', x.image)
          from (
            select ev.region,
                   c.name as cname,
                   c.slug as cslug,
                   (select count(*) from public.collection_items ci
                     where ci.collection_id = c.id
                       and ci.region = ev.region
                       and ci.status = 'wishlist') as cnt,
                   (select jsonb_agg(p.title order by p.rn)
                      from (select ci.title,
                                   row_number() over (
                                     order by ci.rating desc nulls last,
                                              ci.created_at desc) as rn
                              from public.collection_items ci
                             where ci.collection_id = c.id
                               and ci.region = ev.region
                               and ci.status = 'wishlist') p
                     where p.rn <= 3) as picks,
                   (select ci.cover_url from public.collection_items ci
                     where ci.collection_id = c.id
                       and ci.region = ev.region
                       and ci.status = 'wishlist'
                       and ci.cover_url is not null
                     order by ci.rating desc nulls last, ci.created_at desc
                     limit 1) as image
              from public.surfacing_rules sr
              join public.collections c on c.id = sr.collection_id
              join public.events ev
                on ev.user_id = uid
               and ev.region is not null
               and ev.starts_at >= from_ts and ev.starts_at < to_ts
             where sr.user_id = uid and sr.enabled
               and sr.trigger->>'type' = 'event_region'
             group by ev.region, c.id, c.name, c.slug
          ) x
         where x.cnt > 0

        union all
        -- 요일 트리거 — "토요일 아침엔 골프장"
        select 0,
               jsonb_build_object(
                 'kind', 'surface',
                 'title', c.name,
                 'body', '저장해둔 ' || y.cnt || '곳',
                 'href', '/collections/' || c.slug,
                 'chips', coalesce((
                   select jsonb_agg(p.title order by p.rn)
                     from (select ci.title,
                                  row_number() over (
                                    order by ci.rating desc nulls last,
                                             ci.created_at desc) as rn
                             from public.collection_items ci
                            where ci.collection_id = c.id) p
                    where p.rn <= 3), '[]'::jsonb),
                 'image', (
                   select ci.cover_url from public.collection_items ci
                    where ci.collection_id = c.id and ci.cover_url is not null
                    order by ci.rating desc nulls last, ci.created_at desc
                    limit 1))
          from public.surfacing_rules sr
          join public.collections c on c.id = sr.collection_id
          join lateral (
            select count(*) as cnt from public.collection_items ci
             where ci.collection_id = c.id
          ) y on y.cnt > 0
         where sr.user_id = uid and sr.enabled
           and sr.trigger->>'type' = 'day_of_week'
           and (sr.trigger->'days') @> to_jsonb(extract(dow from p_today)::int)
      ) a
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
