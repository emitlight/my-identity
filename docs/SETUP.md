# 배포 안내

한 번만 하면 됩니다. 순서대로 따라오시면 30~40분 정도 걸립니다.
막히면 어느 단계에서 막혔는지 알려주세요.

---

## 1. Supabase 프로젝트 만들기 (10분)

1. https://supabase.com 접속 → **Start your project** → GitHub 계정으로 로그인
2. **New project**
   - Name: `my-identity`
   - Database Password: 아무거나 길게 만들고 **어딘가 저장** (나중에 필요할 수 있음)
   - Region: **Northeast Asia (Seoul)** ← 한국에서 쓰므로 꼭 서울
3. 생성에 2~3분 걸립니다.

### 스키마 넣기

프로젝트가 준비되면 왼쪽 메뉴 **SQL Editor** → **New query**.

`supabase/migrations/` 폴더의 파일을 **번호 순서대로** 하나씩 붙여넣고 **Run** 합니다.

```
0001_foundation.sql    ← 확장, 공통 함수, 프로필
0002_identity.sql      ← 역할, 가치, 목표, 추구미
0003_work.sql          ← 프로젝트, 할 일, 습관
0004_calendar.sql      ← 일정
0005_notes.sql         ← 메모, 회고, 지표
0006_collections.sql   ← 컬렉션 (맛집·골프장)
0007_notifications.sql ← 알림 규칙
0008_storage.sql       ← 사진 저장소
0009_goal_activity.sql ← 방치 감지
0010_today.sql         ← Today 스냅샷
```

> ⚠️ 순서를 지켜야 합니다. 뒤 파일이 앞 파일의 함수와 테이블을 씁니다.
> 각 파일마다 `Success. No rows returned` 가 나오면 정상입니다.

### 키 복사하기

**Project Settings → API** 에서 세 가지를 복사해 둡니다.

| 이름 | 어디에 쓰나 |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` 키 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` 키 | `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **절대 공개 금지** |

---

## 2. 구글 로그인 켜기 (10분)

### 2-1. 구글 쪽

1. https://console.cloud.google.com → 프로젝트 만들기 (이름 아무거나)
2. 좌측 **API 및 서비스 → OAuth 동의 화면**
   - User Type: **외부** → 만들기
   - 앱 이름, 사용자 지원 이메일, 개발자 연락처만 채우고 저장
   - **테스트 사용자**에 본인 Gmail 추가
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 유형: **웹 애플리케이션**
   - **승인된 리디렉션 URI** 에 아래를 붙여넣기
     ```
     https://<프로젝트ID>.supabase.co/auth/v1/callback
     ```
     (`<프로젝트ID>` 는 1단계의 Project URL 에 들어 있습니다)
4. 만들어진 **클라이언트 ID** 와 **클라이언트 보안 비밀** 복사

### 2-2. Supabase 쪽

**Authentication → Sign In / Providers → Google** 켜고, 위에서 복사한 두 값을 붙여넣고 저장.

---

## 3. 알림 키 만들기 (1분)

내 컴퓨터 터미널에서:

```bash
npx web-push generate-vapid-keys
```

`Public Key` 와 `Private Key` 가 나옵니다. 복사해 둡니다.

---

## 4. Vercel 배포 (10분)

1. https://vercel.com → GitHub 로그인
2. **Add New → Project** → `emitlight/my-identity` 선택 → Import
3. **Environment Variables** 에 아래를 전부 넣습니다

| 이름 | 값 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 1단계 Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 1단계 anon 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 1단계 service_role 키 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 3단계 Public Key |
| `VAPID_PRIVATE_KEY` | 3단계 Private Key |
| `VAPID_SUBJECT` | `mailto:본인이메일` |
| `CRON_SECRET` | 아무 긴 문자열 (예: `openssl rand -hex 32` 결과) |
| `ALLOWED_EMAILS` | **본인 이메일** (쉼표로 여러 개 가능) |
| `NEXT_PUBLIC_SITE_URL` | 배포 후 받은 주소 |

4. **Deploy**

> ⚠️ `ALLOWED_EMAILS` 를 비워두면 **아무도** 못 들어옵니다. 설정을 빠뜨렸을 때
> "아무나 들어옴" 보다 "아무도 못 들어옴" 이 안전하므로 그렇게 만들어 뒀습니다.

### 배포 후

1. 받은 주소(`https://…vercel.app`)를 `NEXT_PUBLIC_SITE_URL` 에 넣고 재배포
2. **Supabase → Authentication → URL Configuration** 에서
   - Site URL: 배포 주소
   - Redirect URLs: `https://<배포주소>/auth/callback` 추가

---

## 5. 알림 크론 켜기 (3분)

GitHub 저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|---|---|
| `SITE_URL` | 배포 주소 (끝에 `/` 없이) |
| `CRON_SECRET` | 4단계에서 만든 것과 **똑같이** |

10분마다 알림 규칙이 평가됩니다. **Actions** 탭에서 실행 결과를 볼 수 있습니다.

> Vercel 무료 플랜의 크론은 하루 1회 제한이라 알림 엔진을 돌릴 수 없습니다.
> GitHub Actions 는 무료로 10분 간격이 되므로 여기서 깨웁니다.

---

## 6. 폰에 설치하기 (2분) ★ 중요

**아이폰**
1. **사파리**로 배포 주소 열기 (크롬 말고 사파리)
2. 하단 **공유 버튼** → **홈 화면에 추가**
3. **홈 화면 아이콘으로 다시 들어가서** 로그인
4. 설정 → **알림 켜기**

> ⚠️ 아이폰은 홈 화면에 추가해야만 웹 푸시가 동작합니다. 사파리 안에서
> 바로 알림을 켜면 오지 않습니다. 애플의 제약이라 우회할 방법이 없습니다.

**안드로이드**
1. 크롬으로 배포 주소 열기
2. 메뉴 → **앱 설치** (또는 자동으로 뜨는 배너)
3. 설정 → **알림 켜기**

---

## 7. 확인

- [ ] 배포 주소에서 구글 로그인이 된다
- [ ] `오늘` 화면이 뜬다 (처음엔 비어 있음)
- [ ] 빠른 입력에 `내일 오후 3시 강남 미팅 2시간` 을 넣으면 칩이 뜨고 저장된다
- [ ] `캘린더` 에 방금 넣은 일정이 보인다
- [ ] 폰 홈 화면에 아이콘이 있다
- [ ] 설정에서 알림을 켰고 "이 기기에서 알림을 받습니다" 가 보인다
- [ ] GitHub **Actions** 탭에서 크론이 초록색으로 돈다

여기까지 되면 **다음 날 아침 7시 30분에 첫 브리핑이 옵니다.**

---

## 문제가 생기면

| 증상 | 확인할 것 |
|---|---|
| 로그인 후 다시 로그인 화면 | `ALLOWED_EMAILS` 에 본인 이메일이 정확히 들어갔는지 |
| "데이터를 불러오지 못했습니다" | 마이그레이션 10개를 순서대로 다 돌렸는지 |
| 알림이 안 옴 (아이폰) | 홈 화면에 추가한 아이콘으로 들어갔는지 |
| 알림이 안 옴 (공통) | GitHub Actions 가 초록인지, `CRON_SECRET` 이 양쪽에서 같은지 |
| 크론이 404 | `CRON_SECRET` 불일치 |

## 로컬에서 직접 돌려보려면

```bash
npm install
cp .env.example .env.local   # 위 값들을 채운다
npm run dev
```

검증:

```bash
npx tsc --noEmit                                        # 타입
node --experimental-strip-types src/lib/parse-event.test.ts  # 자연어 파서
sudo bash scripts/test-db.sh                            # 스키마 · RLS
```
