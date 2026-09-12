# My Identity

일상 · 비즈니스 · 취미를 한 화면으로 모으고, **적절한 순간에 알아서 꺼내주는** 개인 대시보드.

어디서든 URL로 접근하고, 데이터는 클라우드에 영구 보존되며, 폰으로 알림을 받는다.

---

## 이게 노션과 뭐가 다른가

노션에는 자료가 쌓였지만 잘 들어가게 되지 않았다. 원인은 기능 부족이 아니라 **마찰**과 **복귀 동력의 부재**였다.

| | 노션 | My Identity |
|---|---|---|
| 입력 | 페이지 → DB → 속성 채우기 | 홈 최상단 한 줄, 엔터 |
| 복귀 | 내가 먼저 열어야 함 | **푸시가 나를 부른다** |
| 자료 찾기 | 어디 뒀는지 찾아야 함 | **맥락에 맞춰 알아서 올라온다** |
| 캘린더 | 별개 | 일정이 다른 모든 걸 작동시키는 축 |
| 추구미 | 무드보드 (만들고 안 봄) | **증거가 쌓여 Before/Now가 된다** |

**핵심**: 캘린더에 `대전 출장`을 넣으면, 그날 아침 저장해둔 대전 맛집이 푸시로 온다.

---

## 문서

| 문서 | 내용 |
|---|---|
| [DESIGN.md](docs/DESIGN.md) | 문제 정의 · 설계 원칙 · 3층 정보 구조 · **컬렉션 시스템** · 비서 엔진 |
| [DATA-MODEL.md](docs/DATA-MODEL.md) | 테이블 스키마 · 유연 스키마 · 맥락 서피싱 트리거 |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 스택 · **캘린더 설계** · 푸시 파이프라인 · 보안 · 라우트 |
| [ROADMAP.md](docs/ROADMAP.md) | Phase 1~4 · 완료 기준 |
| [DECISIONS.md](docs/DECISIONS.md) | **판단 기록** — 동의 / 형태 변경 / 반대한 것과 그 근거 |
| [NOTION-AUDIT.md](docs/NOTION-AUDIT.md) | **노션 실사** — 17개 항목 분석 · 근본 원인 · 마이그레이션 매핑 |

---

## 스택

Next.js 15 · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres · Auth · Storage · RLS) · Vercel · Web Push (VAPID) · PWA

## 접근 방식

레포는 **비공개**, 배포된 앱은 **URL + Google 로그인**으로 어디서든 접근한다.
데이터는 Supabase에 살고 RLS로 본인 행만 열린다. 상세는 [ARCHITECTURE.md § 4](docs/ARCHITECTURE.md).

## 상태

🚧 Phase 1 진행 중

- [x] 설계 문서 (DESIGN · DATA-MODEL · ARCHITECTURE · ROADMAP · DECISIONS)
- [x] 노션 실사 및 마이그레이션 매핑
- [x] DB 스키마 8종 + RLS + 검증 (`scripts/test-db.sh`)
- [x] 인증 · 미들웨어 · 이메일 허용목록 · 디자인 토큰
- [x] 한국어 자연어 일정 파서 + 검증 37종
- [ ] 캘린더 UI · Today 화면 · 빠른 캡처
- [ ] PWA · 웹 푸시 · 크론
- [ ] 노션 데이터 이관
