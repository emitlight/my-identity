-- ============================================================
-- 0001 · 기반: 확장, 공통 함수, 프로필
-- ============================================================

create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- updated_at 자동 갱신
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 테이블 하나를 "내 것만 보이는" 상태로 만드는 헬퍼.
--
-- 모든 테이블 생성 직후 반드시 호출한다. RLS 정책을 각 마이그레이션에
-- 손으로 적으면 언젠가 빠뜨리고, 빠뜨린 테이블은 전부 공개된다.
-- 테이블 추가와 정책 부여를 한 호출로 묶어서 그 실수를 구조적으로 막는다.
-- ------------------------------------------------------------
create or replace function public.own_rows(tbl regclass)
returns void
language plpgsql
as $$
declare
  t text := tbl::text;
begin
  execute format('alter table %s enable row level security', t);
  execute format('drop policy if exists own_rows on %s', t);
  execute format(
    'create policy own_rows on %s for all to authenticated
       using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  execute format('create index if not exists %s_user_id_idx on %s (user_id)',
                 replace(replace(t, 'public.', ''), '.', '_'), t);
end;
$$;

-- 테이블에 updated_at 트리거를 건다.
create or replace function public.auto_touch(tbl regclass)
returns void
language plpgsql
as $$
declare
  t text := tbl::text;
  n text := replace(replace(tbl::text, 'public.', ''), '.', '_');
begin
  execute format('drop trigger if exists %s_touch on %s', n, t);
  execute format('create trigger %s_touch before update on %s
                    for each row execute function public.touch_updated_at()', n, t);
end;
$$;

-- ------------------------------------------------------------
-- profiles — auth.users 1:1
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  user_id       uuid generated always as (id) stored,
  email         text,
  display_name  text,
  timezone      text not null default 'Asia/Seoul',
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles for all to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
select public.auto_touch('public.profiles');

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
