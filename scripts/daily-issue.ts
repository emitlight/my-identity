/**
 * 매일 한 편 — 나만을 위한 일간지의 발행기.
 *
 * Vercel 함수가 아니라 GitHub Actions 에서 돈다. Hobby 플랜 함수는 60초에
 * 끊기는데, 한 편을 제대로 쓰려면 그보다 오래 걸린다. Actions 는 시간
 * 제한이 없고 이미 10분마다 깨어 있으므로 여기가 맞다.
 *
 * 실행:
 *   node --experimental-strip-types scripts/daily-issue.ts
 *
 * 필요한 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *   (선택) NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 *   (선택) ISSUE_DRY_RUN=1  — 쓰기만 하고 저장하지 않는다
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const MODEL = "claude-opus-5-5";
const TZ = "Asia/Seoul";

/* ── 환경 ──────────────────────────────────────────────────── */

const SUPABASE_URL = need("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = need("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_KEY = need("ANTHROPIC_API_KEY");
const DRY = process.env.ISSUE_DRY_RUN === "1";

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ ${name} 가 없습니다`);
    process.exit(1);
  }
  return v;
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});
const claude = new Anthropic({ apiKey: ANTHROPIC_KEY });

/* ── 타입 ──────────────────────────────────────────────────── */

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  company: string | null;
  job_title: string | null;
  bio: string | null;
  timezone: string | null;
}

interface Topic {
  id: string;
  area: string;
  title: string;
  emoji: string | null;
  angle: string | null;
  weight: number;
  last_issued_on: string | null;
  issued_count: number;
}

interface Note {
  id: string;
  kind: string;
  body: string;
  answer: string | null;
  topic_id: string | null;
}

interface Draft {
  title: string;
  subtitle?: string;
  lede?: string;
  tags: string[];
  question?: string;
  body: string;
}

/* ── 주제 고르기 ───────────────────────────────────────────────
   1. 내가 요청한 것이 있으면 그것이 먼저다. 사람이 시킨 것을 뒤로
      미루는 편집자는 없다.
   2. 없으면 가중치 뽑기. 다만 최근에 나온 주제는 가중치를 깎는다.
      같은 주제가 이틀 연속 나오면 그게 곧 "안 보게 되는" 이유가 된다.
   ──────────────────────────────────────────────────────────── */

function pickTopic(topics: Topic[], today: string): Topic {
  const todayMs = Date.parse(today);
  const scored = topics.map((t) => {
    const days = t.last_issued_on
      ? Math.max(0, (todayMs - Date.parse(t.last_issued_on)) / 86_400_000)
      : 999;
    // 7일이 지나면 제 가중치를 다 회복한다. 어제 나왔으면 거의 0.
    const recency = Math.min(1, days / 7);
    return { t, score: t.weight * recency * (0.6 + Math.random() * 0.8) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].t;
}

/* ── 사람 ──────────────────────────────────────────────────── */

const READER = `
읽는 사람은 이하영입니다. 이 잡지의 유일한 독자이고, 아래는 전부 본인이
직접 적어둔 것입니다.

· 1996년 9월 19일생, 경기도 성남 출생
· Berklee College of Music — Electronic Production & Design 수학
· 명지전문대 부동산경영과
· 한국외대 글로벌캠퍼스 — 체코·슬로바키아학 전공, Software&AI 이중전공
· 2024년 12월부터 (주)소프트캠프. 기술교육 플랫폼 운영 관리 + 보안 솔루션 기술지원
· 고양이 두 마리와 삽니다
· 취미: 소설 읽기, 고전 영화, 미드, 세계사, 수영, 필라테스, 골프
· 하고 싶은 것: 서핑, 재즈 피아노, 인테리어, 전원생활, 제철음식 탐방
· 공부하고 싶은 언어: 영어, 스페인어, 일본어, 중국어, 체코어
· 다녀온 곳: 일본(하마마츠·도쿄·나고야·오키나와), 미국(보스턴·뉴욕·텍사스),
  체코(프라하·브르노), 슬로바키아(브라티슬라바), 오스트리아(비엔나),
  헝가리(부다페스트), 베트남(다낭·하노이·사파)
· 좌우명: "생각하는 대로 살지 않으면 사는 대로 생각하게 된다."
· 2027년 10월, 마당 있는 단독주택으로 이사합니다.

이 사람은 음악을 전공했습니다. 음악 글에서 기초를 설명하면 무례합니다.
체코어를 전공했습니다. 중부유럽 얘기에서 관광 안내를 하면 안 됩니다.
보안 기술지원이 업입니다. IT 글에서 용어를 풀어 설명할 필요가 없습니다.
부동산을 배웠습니다. 집과 돈 얘기에서 기본기를 가르치려 들지 마세요.
`.trim();

const VOICE = `
당신은 이 한 사람만을 위해 만들어진 잡지의 편집자이자 유일한 필자입니다.
매일 아침 한 편을 씁니다.

## 이 잡지가 지켜야 하는 것

**1. 가르치되, 아는 것을 다시 말하지 않는다.**
독자가 이미 아는 분야에서는 한 단계 더 깊이 들어갑니다. 모르는 분야에서는
처음부터 설명하되 어린아이 취급은 하지 않습니다.

**2. 한 편에 하나.**
여러 갈래로 벌리지 않습니다. 하나를 끝까지 따라갑니다. 다 읽고 나면
"오늘 이걸 알게 됐다"고 한 문장으로 말할 수 있어야 합니다.

**3. 목록으로 도망가지 않는다.**
"다섯 가지 방법" 같은 글은 아무것도 남기지 않습니다. 산문으로 씁니다.
목록은 정말로 목록이어야 하는 것(재료, 치수, 순서)에만 씁니다.

**4. 틀린 것을 지어내지 않는다.**
확실하지 않으면 확실하지 않다고 씁니다. 숫자·연도·인명은 아는 것만
씁니다. 모르면 그 자리를 비워두고 왜 비웠는지 적습니다. 지어낸 사실
하나가 이 잡지 전체의 신뢰를 끝냅니다.

**5. 오늘과 이어붙인다.**
계절, 요일, 독자의 지금 상황(내년 가을 이사, 소프트캠프 업무, 고양이 둘)과
닿는 지점이 있으면 거기서 시작합니다. 없으면 억지로 만들지 않습니다.

**6. 문장.**
한국어로 씁니다. 짧은 문장과 긴 문장을 섞습니다. "~입니다"체.
감탄사, 이모지, "여러분", "~해보세요"를 쓰지 않습니다.
독자를 '당신'이라 부르지 않습니다 — 혼잣말에 가깝게, 편지보다는 사설에
가깝게 씁니다.

## 분량
본문 1,200~2,000자(공백 제외 기준 대략). 짧아서 허전한 것보다 낫지만,
할 말이 떨어졌는데 늘리지 않습니다.

## 출력 형식
반드시 아래 형식 그대로 출력합니다. 앞뒤에 다른 말을 붙이지 않습니다.

---
title: (제목. 15자 안팎. 부제로 설명할 테니 제목에서 다 말하지 않는다)
subtitle: (부제 한 줄. 30자 안팎)
lede: (지면 첫 줄에 크게 걸릴 한 문장. 40자 안팎. 제목을 반복하지 않는다)
tags: (쉼표로 구분한 2~4개)
question: (선택. 다음 호를 더 잘 쓰기 위해 독자에게 묻고 싶은 것이
          있으면 한 문장. 없으면 이 줄을 통째로 비운다. 매번 묻지 않는다 —
          정말 답이 필요할 때만. 세 번에 한 번이면 충분하다)
---

(여기부터 본문. 마크다운. ## 소제목을 2~4개 쓴다. 제목을 본문에서
다시 쓰지 않는다)
`.trim();

/* ── 본문 받아쓰기 ─────────────────────────────────────────── */

function parseDraft(raw: string): Draft | null {
  const text = raw.trim();
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;

  const head = text.slice(3, end);
  const body = text.slice(end + 4).trim();
  if (!body) return null;

  const field = (name: string): string | undefined => {
    // 값에 콜론이 들어갈 수 있으므로 첫 콜론에서만 자른다.
    const m = head.match(new RegExp(`^\\s*${name}\\s*:(.*)$`, "m"));
    const v = m?.[1]?.trim();
    return v ? v : undefined;
  };

  const title = field("title");
  if (!title) return null;

  return {
    title,
    subtitle: field("subtitle"),
    lede: field("lede"),
    tags: (field("tags") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4),
    question: field("question"),
    body,
  };
}

/** 한국어는 분당 500자쯤 읽는다. 1분 미만도 1분으로 보여준다. */
function readingMinutes(body: string): number {
  return Math.max(1, Math.round(body.replace(/\s/g, "").length / 500));
}

/* ── 본편 ──────────────────────────────────────────────────── */

async function main() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  console.log(`▶ ${today} 발행 시작${DRY ? " (DRY RUN)" : ""}`);

  const { data: profiles, error: pErr } = await db
    .from("profiles")
    .select("id, display_name, email, company, job_title, bio, timezone");
  if (pErr) throw pErr;

  for (const profile of (profiles ?? []) as Profile[]) {
    try {
      await writeIssue(profile, today);
    } catch (err) {
      console.error(`✗ ${profile.email}:`, err instanceof Error ? err.message : err);
      if (!DRY) {
        await db.from("issue_runs").insert({
          user_id: profile.id,
          ran_on: today,
          ok: false,
          detail: String(err).slice(0, 1000),
        });
      }
      process.exitCode = 1;
    }
  }
}

async function writeIssue(profile: Profile, today: string) {
  // 이미 오늘 나갔으면 그만둔다. 크론이 두 번 돌아도 두 편이 되지 않는다.
  const { data: done } = await db
    .from("issue_runs")
    .select("id")
    .eq("user_id", profile.id)
    .eq("ran_on", today)
    .eq("ok", true)
    .maybeSingle();
  if (done) {
    console.log("· 오늘 치는 이미 나갔습니다");
    return;
  }

  const [{ data: topics }, { data: notes }, { data: recent }] = await Promise.all([
    db
      .from("topics")
      .select("id, area, title, emoji, angle, weight, last_issued_on, issued_count")
      .eq("user_id", profile.id)
      .eq("active", true),
    db
      .from("editor_notes")
      .select("id, kind, body, answer, topic_id")
      .eq("user_id", profile.id)
      .in("status", ["open", "answered"])
      .order("created_at", { ascending: false })
      .limit(12),
    db
      .from("posts")
      .select("title, tags, published_at")
      .eq("user_id", profile.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(14),
  ]);

  const pool = (topics ?? []) as Topic[];
  if (!pool.length) throw new Error("주제 풀이 비어 있습니다 (0015 마이그레이션을 적용하세요)");

  const allNotes = (notes ?? []) as Note[];
  // 내가 시킨 것 — 가장 오래 기다린 것부터
  const request = allNotes.filter((n) => n.kind === "request").pop();
  const answers = allNotes.filter((n) => n.answer);

  const topic = request?.topic_id
    ? (pool.find((t) => t.id === request.topic_id) ?? pickTopic(pool, today))
    : pickTopic(pool, today);

  console.log(`· 주제: ${topic.emoji ?? ""} ${topic.title}${request ? " (요청분)" : ""}`);

  const recentTitles = (recent ?? []).map((p) => `· ${p.title}`).join("\n") || "· (아직 없음)";

  const task = [
    `오늘은 ${today} 입니다.`,
    ``,
    `## 오늘의 주제`,
    `${topic.emoji ?? ""} ${topic.title}`,
    topic.angle ? `각도: ${topic.angle}` : "",
    ``,
    request
      ? `## 독자가 직접 요청한 것 (이번 호는 이것을 우선합니다)\n${request.body}`
      : "",
    answers.length
      ? `## 독자가 이전에 답해준 것 (참고)\n${answers
          .map((a) => `Q. ${a.body}\nA. ${a.answer}`)
          .join("\n\n")}`
      : "",
    `## 최근에 나간 글 (겹치지 않게)`,
    recentTitles,
  ]
    .filter(Boolean)
    .join("\n");

  const stream = claude.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "high" },
    system: [
      { type: "text", text: `${VOICE}\n\n---\n\n${READER}`, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: task }],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error(`거절됨: ${message.stop_details?.explanation ?? "사유 없음"}`);
  }

  const raw = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const draft = parseDraft(raw);
  if (!draft) throw new Error(`형식을 못 읽었습니다:\n${raw.slice(0, 400)}`);

  console.log(`· 「${draft.title}」 ${draft.body.length}자`);
  if (DRY) {
    console.log("\n" + raw);
    return;
  }

  const now = new Date().toISOString();
  const { data: post, error: postErr } = await db
    .from("posts")
    .insert({
      user_id: profile.id,
      kind: "auto",
      topic_id: topic.id,
      title: draft.title,
      subtitle: draft.subtitle ?? null,
      lede: draft.lede ?? null,
      body: draft.body,
      tags: draft.tags,
      status: "published",
      published_at: now,
      generated_at: now,
      model: MODEL,
      reading_minutes: readingMinutes(draft.body),
    })
    .select("id")
    .single();
  if (postErr) throw postErr;

  await db
    .from("topics")
    .update({ last_issued_on: today, issued_count: topic.issued_count + 1 })
    .eq("id", topic.id);

  // 요청분을 썼으면 그 요청을 닫는다. 안 닫으면 매일 같은 글이 나온다.
  if (request) {
    await db
      .from("editor_notes")
      .update({ status: "closed", post_id: post.id })
      .eq("id", request.id);
  }

  // 편집자가 물어볼 것이 있으면 편집실에 남긴다. 메일이 아니라 여기다 —
  // 메일은 답장이 돌아올 곳이 없다.
  if (draft.question) {
    await db.from("editor_notes").insert({
      user_id: profile.id,
      kind: "question",
      topic_id: topic.id,
      post_id: post.id,
      body: draft.question,
      status: "open",
    });
  }

  await db.from("issue_runs").insert({
    user_id: profile.id,
    ran_on: today,
    topic_id: topic.id,
    post_id: post.id,
    ok: true,
    tokens_in: message.usage.input_tokens,
    tokens_out: message.usage.output_tokens,
  });

  await announce(profile.id, draft, post.id);
  console.log(`✓ 발행 완료 · /posts/${post.id}`);
}

/* ── 알림 ──────────────────────────────────────────────────── */

async function announce(userId: string, draft: Draft, postId: string) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return;

  const { data: notif } = await db
    .from("notifications")
    .insert({
      user_id: userId,
      kind: "daily_issue",
      title: `오늘의 한 편 · ${draft.title}`,
      body: draft.subtitle ?? draft.lede ?? "",
      url: `/posts/${postId}`,
      reason: "매일 발행",
      dedupe_key: `daily_issue:${postId}`,
      status: "queued",
    })
    .select("id")
    .single();

  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs?.length) return;

  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com", pub, priv);
  const payload = JSON.stringify({
    title: `오늘의 한 편 · ${draft.title}`,
    body: draft.subtitle ?? draft.lede ?? "",
    url: `/posts/${postId}`,
    tag: "daily_issue",
    id: notif?.id ?? null,
  });

  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      );
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      // 만료된 구독은 지운다. 남겨두면 매일 실패하고 로그를 더럽힌다.
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
    }
  }

  if (notif) {
    await db
      .from("notifications")
      .update({ status: sent > 0 ? "sent" : "skipped", sent_at: new Date().toISOString() })
      .eq("id", notif.id);
  }
}

await main();
