-- ============================================================
-- 0009 · 방치 감지
--
-- 기한 없는 목표는 알림을 걸 근거가 없어서 목록 아래로 가라앉는다.
-- 노션의 17개가 전부 'Not started' 로 굳은 경로가 정확히 그것이다.
-- 마감 대신 "마지막 움직임"을 기준으로 한 번씩 물어본다.
-- ============================================================

alter table public.goals
  add column if not exists last_activity_at timestamptz not null default now(),
  -- 방치 알림을 며칠 침묵 후 보낼지. null 이면 이 목표는 묻지 않는다.
  add column if not exists stale_after_days int default 60;

create index if not exists goals_stale_idx on public.goals (user_id, last_activity_at)
  where status = 'active';

-- 목표 자체가 수정되면 움직인 것으로 본다.
-- 단, last_activity_at 을 명시적으로 지정한 UPDATE 는 존중한다. 그러지 않으면
-- 노션 이관 시 원본의 마지막 수정 시각을 넣을 수 없고, 옮기자마자 전부
-- "방금 움직인 목표"가 되어 방치 감지가 무력해진다.
create or replace function public.touch_goal_activity()
returns trigger
language plpgsql
as $$
begin
  new.last_activity_at = now();
  return new;
end;
$$;

drop trigger if exists goals_touch_activity on public.goals;
create trigger goals_touch_activity
  before update on public.goals
  for each row
  when (old.* is distinct from new.*
        and old.last_activity_at is not distinct from new.last_activity_at)
  execute function public.touch_goal_activity();

-- 지표가 기록되면 그 지표를 쓰는 목표가 움직인 것이다.
create or replace function public.touch_goal_by_metric()
returns trigger
language plpgsql
as $$
begin
  update public.goals
     set last_activity_at = now()
   where user_id = new.user_id
     and metric_key = new.metric_key
     and status = 'active';
  return new;
end;
$$;

drop trigger if exists metric_logs_touch_goal on public.metric_logs;
create trigger metric_logs_touch_goal
  after insert on public.metric_logs
  for each row execute function public.touch_goal_by_metric();

-- 목표에 걸린 프로젝트의 할 일이 완료되면 그 목표가 움직인 것이다.
create or replace function public.touch_goal_by_task()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and coalesce(old.status, 'inbox') <> 'done'
     and new.project_id is not null then
    update public.goals g
       set last_activity_at = now()
      from public.projects p
     where p.id = new.project_id
       and g.id = p.goal_id
       and g.status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_touch_goal on public.tasks;
create trigger tasks_touch_goal
  after update of status on public.tasks
  for each row execute function public.touch_goal_by_task();

-- 알림 종류 추가
alter type notification_kind add value if not exists 'goal_stale';
