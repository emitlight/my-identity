#!/usr/bin/env bash
# 노션 이관 시드가 실제로 돌아가는지 확인한다.
# 배포 직후 SQL Editor 에서 실패하면 원인 찾기가 훨씬 어렵다.
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGROOT=${PGROOT:-/var/lib/postgresql/mitest-seed}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

id postgres >/dev/null 2>&1 || useradd -m postgres
su postgres -c "$PGBIN/pg_ctl -D $PGROOT/data -m immediate stop" >/dev/null 2>&1 || true
rm -rf "$PGROOT"; mkdir -p "$PGROOT"; chown -R postgres:postgres "$PGROOT"; chmod 750 "$PGROOT"

su postgres -c "$PGBIN/initdb -D $PGROOT/data -U postgres --auth=trust -E UTF8" >/dev/null
su postgres -c "$PGBIN/pg_ctl -D $PGROOT/data -l $PGROOT/log -o \"-k $PGROOT -c listen_addresses=''\" -w start" >/dev/null
trap "su postgres -c '$PGBIN/pg_ctl -D $PGROOT/data -m fast stop' >/dev/null 2>&1; rm -rf $TMP" EXIT

psql() { command psql -h "$PGROOT" -U postgres "$@"; }

psql -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -f "$f"; done
psql -q -c "grant usage on schema public to authenticated;
            grant all on all tables in schema public to authenticated;"

# 테스트용 계정
psql -q -c "insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','seed@test.local');"

# 시드의 대상 계정만 테스트 계정으로 바꿔 실행
for f in "$ROOT"/supabase/seed/*.sql; do
  sed "s/hayoung.lee@softcamp.co.kr/seed@test.local/" "$f" > "$TMP/$(basename "$f")"
done

echo "→ 1회차 실행"
for f in "$TMP"/*.sql; do psql -q -v ON_ERROR_STOP=1 -f "$f"; done
echo "→ 2회차 실행 (중복되면 안 됨)"
for f in "$TMP"/*.sql; do psql -q -v ON_ERROR_STOP=1 -f "$f"; done

echo
psql -t -v ON_ERROR_STOP=1 <<'SQL' | grep -v '^\s*$'
select format('%-18s %3s  %s', t, n, case when n = want then 'PASS' else 'FAIL (기대 ' || want || ')' end)
from (
  select '역할' t, count(*) n, 5 want from public.roles
  union all select '핵심가치',   count(*), 1  from public.core_values
  union all select '목표',       count(*), 10 from public.goals
  union all select '습관',       count(*), 4  from public.habits
  union all select '추구미',     count(*), 5  from public.aspirations
  union all select '컬렉션',     count(*), 7  from public.collections
  union all select '컬렉션항목', count(*), 18 from public.collection_items
  union all select '할 일',      count(*), 10 from public.tasks
  union all select '서피싱규칙', count(*), 2  from public.surfacing_rules
  union all select '관심사',     count(*), 20 from public.interests
  union all select '메모',       count(*), 1  from public.notes
  union all select '프로필 생일', count(*), 1  from public.profiles where birth_date is not null
  union all select '알림규칙',   count(*), 8  from public.notification_rules
) s;
SQL

echo
echo "→ 부모-자식 목표 연결"
psql -t -c "select format('  %s → %s', p.title, c.title)
            from public.goals c join public.goals p on p.id = c.parent_id;" | grep -v '^\s*$'

echo
echo "→ Today 경고 (이관 직후 첫 화면)"
# set_config 와 조회를 같은 연결에서 해야 한다. psql 호출을 나누면
# 세션 설정이 날아가서 auth.uid() 가 null 이 되고 경고가 비어 보인다.
psql -t <<'SQL' | grep -v '^\s*$' || echo "  (없음)"
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select format('  [%s] %s — %s', a->>'kind', a->>'title', a->>'body')
  from jsonb_array_elements(public.today_snapshot(current_date)->'alerts') a;
SQL
