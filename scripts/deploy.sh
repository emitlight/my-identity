#!/usr/bin/env bash
# ============================================================
# 한 번에 배포 — Supabase 프로젝트 생성 → 스키마·데이터 → Vercel
#
# 필요한 것 (둘 다 비밀번호가 아니라 '토큰'이다. 언제든 회수 가능):
#   SUPABASE_TOKEN  https://supabase.com/dashboard/account/tokens
#   VERCEL_TOKEN    https://vercel.com/account/tokens
#
# 네트워크에서 api.supabase.com · api.vercel.com 이 열려 있어야 한다.
#
# 사용:
#   SUPABASE_TOKEN=sbp_... VERCEL_TOKEN=... bash scripts/deploy.sh
#
# 여러 번 돌려도 안전하다. 이미 있는 것은 건너뛴다.
# ============================================================
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PROJECT_NAME=${PROJECT_NAME:-my-identity}
REGION=${REGION:-ap-northeast-2}          # 서울
EMAIL=${EMAIL:-leehy919@gmail.com}

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

[ -n "${SUPABASE_TOKEN:-}" ] || die "SUPABASE_TOKEN 이 없습니다"
[ -n "${VERCEL_TOKEN:-}" ]   || die "VERCEL_TOKEN 이 없습니다"

sb() { curl -sS -H "Authorization: Bearer $SUPABASE_TOKEN" -H "Content-Type: application/json" "$@"; }
vc() { curl -sS -H "Authorization: Bearer $VERCEL_TOKEN"   -H "Content-Type: application/json" "$@"; }

# ── 1. Supabase 프로젝트 ────────────────────────────────────
say "1/5  Supabase 프로젝트"
ORG=$(sb https://api.supabase.com/v1/organizations | python3 -c 'import sys,json; o=json.load(sys.stdin); print(o[0]["id"] if o else "")')
[ -n "$ORG" ] || die "조직을 찾지 못했습니다 (토큰을 확인하세요)"

REF=$(sb https://api.supabase.com/v1/projects \
      | python3 -c "import sys,json;p=[x for x in json.load(sys.stdin) if x['name']=='$PROJECT_NAME'];print(p[0]['id'] if p else '')")

if [ -z "$REF" ]; then
  DB_PASS=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 24)
  echo "   새로 만듭니다 (리전 $REGION)"
  REF=$(sb -X POST https://api.supabase.com/v1/projects -d "$(python3 -c "
import json,os
print(json.dumps({'name':'$PROJECT_NAME','organization_id':'$ORG','region':'$REGION',
                  'db_pass':'$DB_PASS','plan':'free'}))")" \
        | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("id",""))')
  [ -n "$REF" ] || die "프로젝트 생성 실패"
  echo "   DB 비밀번호(보관하세요): $DB_PASS"
else
  echo "   이미 있습니다: $REF"
fi
echo "   ref = $REF"

say "2/5  기동 대기 (2~3분)"
for i in $(seq 1 60); do
  ST=$(sb "https://api.supabase.com/v1/projects/$REF" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("status",""))')
  [ "$ST" = "ACTIVE_HEALTHY" ] && { echo "   준비됨"; break; }
  printf '   %s …\r' "$ST"; sleep 10
done
[ "$ST" = "ACTIVE_HEALTHY" ] || die "기동이 끝나지 않았습니다 (status=$ST)"

# ── 3. 스키마 + 노션 데이터 ─────────────────────────────────
say "3/5  스키마와 데이터"
[ -f "$ROOT/supabase/bundle.sql" ] || bash "$ROOT/scripts/bundle-sql.sh"
python3 - "$REF" <<'PY'
import json, os, subprocess, sys, urllib.request
ref, tok = sys.argv[1], os.environ["SUPABASE_TOKEN"]
sql = open("supabase/bundle.sql", encoding="utf-8").read()
req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/database/query",
    data=json.dumps({"query": sql}).encode(),
    headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
    method="POST")
try:
    urllib.request.urlopen(req).read()
    print("   적용 완료")
except urllib.error.HTTPError as e:
    body = e.read().decode()[:400]
    # 계정이 아직 없어 시드가 건너뛰어진 것은 정상이다 — 로그인 뒤 다시 돌린다
    if "계정을 찾지 못했습니다" in body or "auth.users" in body:
        print("   스키마만 적용됨 (로그인 뒤 다시 실행하면 데이터가 붙습니다)")
    else:
        sys.exit(f"   SQL 실패: {body}")
PY

KEYS=$(sb "https://api.supabase.com/v1/projects/$REF/api-keys")
ANON=$(echo "$KEYS" | python3 -c 'import sys,json;print(next(k["api_key"] for k in json.load(sys.stdin) if k["name"]=="anon"))')
SRV=$(echo "$KEYS"  | python3 -c 'import sys,json;print(next(k["api_key"] for k in json.load(sys.stdin) if k["name"]=="service_role"))')
URL="https://$REF.supabase.co"
echo "   URL = $URL"

# ── 4. Vercel 프로젝트 + 환경변수 ───────────────────────────
say "4/5  Vercel"
command -v vercel >/dev/null || npm i -g vercel@latest >/dev/null 2>&1

cd "$ROOT"
set_env() {   # 이름 값 [sensitive]
  vercel env rm "$1" production --yes --token "$VERCEL_TOKEN" >/dev/null 2>&1 || true
  printf '%s' "$2" | vercel env add "$1" production --token "$VERCEL_TOKEN" >/dev/null
}

vercel link --yes --project "$PROJECT_NAME" --token "$VERCEL_TOKEN" >/dev/null

set_env NEXT_PUBLIC_SUPABASE_URL      "$URL"
set_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$ANON"
set_env SUPABASE_SERVICE_ROLE_KEY     "$SRV"
set_env ALLOWED_EMAILS                "$EMAIL"
set_env VAPID_SUBJECT                 "mailto:$EMAIL"
[ -n "${NEXT_PUBLIC_VAPID_PUBLIC_KEY:-}" ] && set_env NEXT_PUBLIC_VAPID_PUBLIC_KEY "$NEXT_PUBLIC_VAPID_PUBLIC_KEY"
[ -n "${VAPID_PRIVATE_KEY:-}" ]            && set_env VAPID_PRIVATE_KEY "$VAPID_PRIVATE_KEY"
[ -n "${CRON_SECRET:-}" ]                  && set_env CRON_SECRET "$CRON_SECRET"

say "5/5  배포"
SITE=$(vercel deploy --prod --yes --token "$VERCEL_TOKEN" 2>&1 | tail -1)
echo "   $SITE"
set_env NEXT_PUBLIC_SITE_URL "$SITE"

cat <<MSG

────────────────────────────────────────────
배포 주소   $SITE
Supabase    $URL

남은 것 (브라우저에서 한 번씩):
  1. 구글 로그인  Supabase → Authentication → Providers → Google
     리디렉션 URL: $SITE/auth/callback
  2. 로그인 한 번 한 뒤 bundle.sql 을 다시 실행하면 노션 데이터가 붙습니다
────────────────────────────────────────────
MSG
