#!/usr/bin/env bash
# 배포용 SQL 한 장으로 묶는다.
# Supabase SQL Editor 에 통째로 붙여넣고 Run 한 번이면 끝나도록.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/supabase/bundle.sql"

{
  echo "-- ============================================================"
  echo "-- My Identity — 전체 설치 SQL (자동 생성 · 직접 고치지 말 것)"
  echo "-- 생성: scripts/bundle-sql.sh"
  echo "--"
  echo "-- Supabase SQL Editor 에 통째로 붙여넣고 Run."
  echo "-- 여러 번 실행해도 안전하다."
  echo "--"
  echo "-- 먼저 앱에 한 번 로그인해서 계정이 만들어져 있어야 시드가 붙는다."
  echo "-- ============================================================"
  echo
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "-- ┌─────────────────────────────────────────────────────────"
    echo "-- │ $(basename "$f")"
    echo "-- └─────────────────────────────────────────────────────────"
    cat "$f"; echo; echo
  done
  echo "-- ============================================================"
  echo "-- 노션 이관 데이터"
  echo "-- ============================================================"
  echo
  for f in "$ROOT"/supabase/seed/*.sql; do
    echo "-- ┌─────────────────────────────────────────────────────────"
    echo "-- │ $(basename "$f")"
    echo "-- └─────────────────────────────────────────────────────────"
    cat "$f"; echo; echo
  done
} > "$OUT"

echo "→ $OUT  ($(wc -l < "$OUT") 줄, $(du -h "$OUT" | cut -f1))"
