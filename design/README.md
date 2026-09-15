# 디자인 캔버스

메종·코스모폴리탄 계열 에디토리얼 방향으로 다시 잡은 UI.
아트보드 네 장 — 웹 홈 · 웹 컬렉션 · 모바일 홈 · 모바일 나.

**캔버스**: https://claude.ai/artifact/Bi82ZsjUnKZxpXpvpGAAg2

---

## 이 폴더의 파일

| 파일 | 무엇 |
|---|---|
| `Main.dc.html` | 웹 · 홈 (1440) — 왼쪽 실행 레일 + 매거진 본지 |
| `WebCollection.dc.html` | 웹 · 컬렉션 — 매거진/그리드/목록 전환, 지역 필터 |
| `MobileHome.dc.html` | 모바일 · 홈 (390) — 실행 스트립 + 커버 스토리 + 피드 |
| `MobileIdentity.dc.html` | 모바일 · 나 — 프로필 · 추구미 · 관심사 거울 |
| `canvas.json` | 아트보드 배치와 메모 |
| `*.jpg` | 분위기 이미지 (아래 참고) |
| `generate-imagery.mjs` | 그 이미지를 만드는 스크립트 |

빌드 결과물(`my-identity-dashboard.html`, 2.6MB)은 커밋하지 않는다.
작업 파일에서 언제든 다시 만들 수 있다.

## 디자인 시스템

```
타이포   Bodoni Moda (라틴) + Gowun Batang (한글) + IBM Plex Sans KR (본문)
         한 헤드라인 안에서 라틴은 보도니, 한글은 바탕체로 갈라진다.

색       --paper  #FAF7F3   따뜻한 페이퍼 화이트
         --ink    #17120F   먹빛
         --muted  #837568
         --rule   #DDD4C8
         --claret #7B2C36   액센트 하나

역할색   #3A7CA5 소프트캠프 · #7161D1 로스쿨 · #41916B 학습
         #C2703F 운동 · #8E6BB8 취미·일상   (앱에서 그대로 가져옴)
```

이모지는 쓰지 않는다. 잡지 감성에서 가장 먼저 싸구려로 보이는 요소다.
역할은 색점으로만 표시한다.

## 이미지에 대해

`*.jpg` 는 **직접 렌더한 분위기 이미지**다. 작업 환경에서 Unsplash 에
나갈 수 없어서 자리를 채워둔 것이다.

실제 사진(직접 찍은 것이든 Unsplash 든)이 같은 자리에 그대로 들어간다.
레이아웃이 결과물이고 이미지는 교체 대상이다.

다시 만들려면:

```bash
cd design && node generate-imagery.mjs
```

## 캔버스 다시 만들기

```bash
BASE=<design 스킬 디렉터리>
node "$BASE/seed-canvas.mjs" \
  --template "$BASE/payload.template.html" \
  --out my-identity-dashboard.html \
  --title "My Identity 대시보드" \
  --artboard Main.dc.html --artboard WebCollection.dc.html \
  --artboard MobileHome.dc.html --artboard MobileIdentity.dc.html \
  --image cover.jpg --image daejeon.jpg --image interior.jpg --image golf.jpg \
  --image books.jpg --image travel.jpg --image music.jpg --image film.jpg --image career.jpg \
  --canvas canvas.json
```

## 알아둘 것

아트보드의 `<img src="...">` 는 **리터럴 파일명이어야** 인라인된다.
`{{바인딩}}` 으로 넣으면 조용히 깨진다 — 그래서 카드가 반복문이 아니라
하나씩 펼쳐져 있다. 편집기에서 카드별로 직접 고칠 수 있는 부수 효과도 있다.

## 아직 안 한 것

이 방향을 앱 코드(`src/`)에 아직 옮기지 않았다. 캔버스는 방향 확인용이다.
