#!/usr/bin/env bash
# 로컬 Postgres 에 마이그레이션을 전부 적용하고 스키마 검증을 돌린다.
# Supabase 에 올리기 전에 여기서 걸러야 한다.
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGROOT=${PGROOT:-/var/lib/postgresql/mitest}
PORT=${PORT:-55432}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

id postgres >/dev/null 2>&1 || useradd -m postgres
# 이전 실행이 남아 있으면 먼저 내린다 (안 그러면 포트가 잡혀 있어 기동 실패)
su postgres -c "$PGBIN/pg_ctl -D $PGROOT/data -m immediate stop" >/dev/null 2>&1 || true
rm -rf "$PGROOT"; mkdir -p "$PGROOT"; chown -R postgres:postgres "$PGROOT"; chmod 750 "$PGROOT"

su postgres -c "$PGBIN/initdb -D $PGROOT/data -U postgres --auth=trust -E UTF8" >/dev/null
# TCP 를 열지 않고 유닉스 소켓만 쓴다. 포트 충돌이 구조적으로 발생하지 않는다.
pkill -9 -u postgres postgres >/dev/null 2>&1 || true
su postgres -c "$PGBIN/pg_ctl -D $PGROOT/data -l $PGROOT/log -o \"-k $PGROOT -c listen_addresses=''\" -w start" >/dev/null
trap "su postgres -c '$PGBIN/pg_ctl -D $PGROOT/data -m fast stop' >/dev/null 2>&1 || true" EXIT

psql() { command psql -h "$PGROOT" -U postgres "$@"; }

echo "→ Supabase 스텁"
psql -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/_stub.sql"

echo "→ 마이그레이션"
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -f "$f"
  echo "   ✓ $(basename "$f")"
done

echo "→ 권한 부여 (Supabase 가 자동으로 하는 부분)"
psql -q -c "grant usage on schema public to authenticated;
            grant all on all tables in schema public to authenticated;
            grant all on all sequences in schema public to authenticated;"

echo "→ 검증"
out=$(psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/schema_test.sql" 2>&1) || {
  echo "$out"; echo; echo "검증 실행 실패"; exit 1; }

echo "$out" \
  | sed -E 's/^psql:[^ ]+ //; s/^NOTICE:  //' \
  | grep -Ev '^(DO|SET|BEGIN|COMMIT|INSERT [0-9]|UPDATE [0-9])$' \
  | grep -v '^[[:space:]]*$'

fails=$(echo "$out" | grep -c 'FAIL' || true)
echo
if [ "$fails" -gt 0 ]; then echo "✗ 실패 $fails 건"; exit 1; fi
echo "✓ 전부 통과" 
