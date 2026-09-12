# 데이터 모델

Postgres (Supabase). 모든 테이블에 `user_id uuid` + RLS `user_id = auth.uid()`.
`created_at` / `updated_at`은 전 테이블 공통이므로 아래 표기에서 생략한다.

> 노션 커넥터 연결 후 실제 DB 구조를 읽으면 이 스키마를 **사용자의 기존 구조에 맞춰 조정**한다. 아래는 골격이다.

---

## Layer 3 — Identity Core

### `roles` — 내가 맡은 역할
삶을 나누는 최상위 축. 모든 목표·프로젝트·할 일이 여기 연결되고 **색으로 구분**된다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| name | text | `사업가` `개발자` `골퍼` `아들` |
| description | text | 이 역할에서 나는 어떤 사람이고 싶은가 |
| color | text | 전 앱 공통 색상 코드 |
| icon | text | 이모지/아이콘 키 |
| weekly_target_hours | numeric | 주간 목표 배분 (회고에서 실제와 대조) |
| active | bool | |
| sort_order | int | |

### `values` — 핵심 가치
`id · title · description · sort_order`. 회고 화면에 상시 노출되어 판단 기준 역할.

### `goals` — 목표
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| role_id | uuid FK→roles | |
| parent_id | uuid FK→goals | 연 → 분기 → 월 계층 |
| title | text | |
| horizon | enum | `life` `year` `quarter` `month` |
| period_start / period_end | date | |
| metric_key / metric_target / metric_current | text·numeric | 정량 목표 (예: `매출`, 1억, 6200만) |
| status | enum | `active` `done` `dropped` `paused` |

> `metric_current`는 `metric_logs`에서 자동 집계 → 진척도가 **손으로 갱신되지 않는다.** 손으로 갱신하는 순간 안 하게 된다.

---

## Layer 2 — Domains

### `projects`
`id · role_id · goal_id · title · description · area(business|personal|hobby) · status · due_date · color`

### `tasks`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| project_id / role_id | uuid FK | 둘 다 nullable — **분류 없이도 저장된다** |
| title | text | 이것만 있으면 저장 가능 |
| notes | text | |
| status | enum | `inbox` `todo` `doing` `done` `dropped` |
| priority | int | 0~3 |
| due_at | timestamptz | 마감 (알림 대상) |
| scheduled_for | date | "오늘 할 일"에 올라오는 기준 |
| estimate_min | int | Today에서 하루 용량 계산에 사용 |
| energy | enum | `high` `low` — 컨디션에 맞는 일 추천 |
| recurrence | jsonb | RRULE 형식 반복 |
| completed_at | timestamptz | |

`status='inbox'`가 **빠른 캡처의 기본값**이다. 분류를 강요하지 않는 구조.

### `habits` / `habit_logs`
- `habits`: `id · role_id · title · cadence(daily|weekly|custom) · target_per_period · color · active`
- `habit_logs`: `id · habit_id · date · value · note` — `(habit_id, date)` 유니크. 스트릭은 쿼리로 계산.

### `events` — 일정
`id · title · starts_at · ends_at · all_day · location · lat/lng · role_id · project_id · source(local|google) · external_id · reminder_minutes[]`

`location`은 **맥락 서피싱의 입력**이다 (지역명 매칭 → 컬렉션 카드).
Google Calendar 양방향 동기화는 Phase 3.

### `notes` — 메모
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| title | text | 비어 있어도 됨 (본문 첫 줄로 대체) |
| body | text | Markdown |
| kind | enum | `quick` `note` `idea` `meeting` `retro` |
| tags | text[] | |
| role_id / project_id | uuid FK | nullable |
| pinned | bool | |
| search_tsv | tsvector | 한국어 전문검색 (GIN 인덱스) |

### `metric_logs` — 수치 기록
`id · metric_key · value numeric · unit · recorded_at · role_id · meta jsonb`

체중·지출·매출·독서시간·라운딩 스코어를 **한 테이블**로 받는다. 종류마다 테이블을 만들면 확장할 때마다 코드를 고쳐야 하고, 그러면 안 늘린다. `goals.metric_current`가 여기서 집계된다.

### `journal_entries` — 회고
`id · date · kind(daily|weekly|monthly) · mood int · energy int · highlights · lowlights · gratitude · body` — `(date, kind)` 유니크

---

## 컬렉션 시스템 ★

### `collections` — 컬렉션 정의
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| slug | text | `daejeon-food`, `golf-courses` — URL |
| name / description / icon / cover_url | | |
| kind | enum | `place` `media` `product` `person` `generic` |
| **schema** | **jsonb** | **타입별 필드 정의 → 입력 폼과 필터 UI가 자동 생성** |
| default_view | enum | `map` `list` `card` `magazine` |
| surfacing | jsonb | 언제 Today에 올라올지 (§ 트리거) |

`schema` 예시 (대전 맛집):
```json
{ "fields": [
  { "key":"price_range", "label":"가격대", "type":"select",
    "options":["1만 이하","1~3만","3~5만","5만+"], "filterable":true },
  { "key":"parking",  "label":"주차",     "type":"bool",   "filterable":true },
  { "key":"booking",  "label":"예약필요", "type":"bool" },
  { "key":"signature","label":"대표메뉴", "type":"text" },
  { "key":"hours",    "label":"영업시간", "type":"text" }
]}
```

> **이 한 컬럼이 "새 자료 종류가 생겨도 코드를 안 고쳐도 되는" 이유다.** 골프장·와인·장비·읽을 책 전부 `schema`만 다르게 주면 끝난다.

### `collection_items` — 항목
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| collection_id | uuid FK | |
| title / subtitle / summary | text | |
| body | text | Markdown — **매거진 상세 페이지 본문** |
| cover_url / images | text / text[] | |
| tags | text[] | |
| rating | numeric | 내 평점 |
| status | enum | `wishlist` `visited` `owned` `dropped` |
| lat / lng / address / region | | `region`이 **지역 매칭 키** (예: `대전`) |
| url | text | 원본 링크 |
| **data** | **jsonb** | `collections.schema`에 정의된 타입별 필드 값 |
| last_surfaced_at | timestamptz | 같은 항목을 반복 추천하지 않기 위해 |
| visited_at | timestamptz | |

인덱스: `(collection_id, status)`, `(region)`, GIN on `tags`, GIN on `data`, 좌표 GiST.

### `collection_item_logs` — 경험 기록
`id · item_id · date · rating · note · cost · photos[] · event_id`

같은 곳을 여러 번 가면 기록이 쌓인다. **"3번 갔고 평점이 오르는 중"** 같은 게 보인다.

---

## 비서 엔진

### `push_subscriptions`
`id · endpoint · p256dh · auth · user_agent · last_seen_at` — 기기별 1행 (폰·노트북 각각)

### `notification_rules`
`id · kind · schedule(cron) · channel(webpush|email) · config jsonb · enabled`
기본 규칙: 아침 브리핑 / 일정 리마인더 / 습관 미체크 / 저녁 회고 / 주간 리뷰

### `notifications` — 발송 이력
`id · title · body · url · kind · reason · status(queued|sent|failed) · sent_at · read_at · clicked_at`

`reason`은 "왜 지금 이 알림이 왔는지" 한 줄. `clicked_at` 통계로 **아무도 안 누르는 알림 종류를 찾아 끈다.**

### `surfacing_rules` — 맥락 서피싱
| 컬럼 | 설명 |
|---|---|
| collection_id | 올릴 컬렉션 |
| trigger jsonb | 조건 |
| priority int | 여러 개 걸리면 순서 |

트리거 예시:
```json
{ "type":"event_location", "match_region":"대전", "item_filter":{"status":"wishlist"} }
{ "type":"day_of_week",    "days":[6],  "time":"08:00" }
{ "type":"nearby",         "radius_km":5 }
{ "type":"stale",          "days_since_view":90 }
```

---

## 마이그레이션 / 시드

```
supabase/migrations/   # 스키마 (버전 관리)
supabase/seed/         # 대화로 받은 자료 → 구조화된 JSON/SQL
scripts/import.ts      # seed 투입 + 노션 export 파서
```

노션에서 넘어온 데이터는 `collection_items.data`에 원본 속성을 **통째로 보존**한다. 매핑을 잘못해도 원본이 남아 있어 다시 만질 수 있다.
