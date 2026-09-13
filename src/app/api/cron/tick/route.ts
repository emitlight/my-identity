import { NextResponse, type NextRequest } from "next/server";
import { toZonedTime, format } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/server";
import { sendToUser } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GitHub Actions 가 10분마다 때린다. 규칙 시각이 이 창 안이면 발송. */
const TICK_WINDOW_MIN = 10;

interface Profile {
  id: string;
  timezone: string;
  birth_date: string | null;
  career_started_at: string | null;
  company: string | null;
}

interface Rule {
  kind: string;
  at_local: string | null;
  days: number[] | null;
  config: Record<string, unknown>;
}

/**
 * 비서 엔진.
 *
 * 알림은 행동 가능한 것만 보낸다. 정보성 알림은 무시하는 법을 학습시키고,
 * 그러면 진짜 중요한 알림까지 무시하게 된다. 그래서 모든 알림에 reason 을
 * 같이 저장하고, clicked_at 통계로 아무도 안 누르는 종류를 찾아 끈다.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    // 존재 자체를 알리지 않는다.
    return new NextResponse(null, { status: 404 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const log: Record<string, number> = { users: 0, queued: 0, sent: 0, skipped: 0 };

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, timezone, birth_date, career_started_at, company");

  for (const profile of (profiles ?? []) as Profile[]) {
    log.users++;
    const tz = profile.timezone || "Asia/Seoul";
    const localNow = toZonedTime(now, tz);
    const todayISO = format(localNow, "yyyy-MM-dd", { timeZone: tz });
    const minutesNow = localNow.getHours() * 60 + localNow.getMinutes();
    const dow = localNow.getDay();

    // 생일과 근속 기념일. 규칙 행 없이 매일 아침에 한 번만 본다.
    // 노션에서는 생년월일이 소개글 안의 문장이라 아무 일도 일어나지
    // 않았다. 날짜 컬럼으로 옮긴 덕에 여기서 쓸 수 있다.
    if (localNow.getHours() === 8 && localNow.getMinutes() < TICK_WINDOW_MIN) {
      const md = todayISO.slice(5);

      if (profile.birth_date?.slice(5) === md) {
        await queue(admin, profile.id, {
          kind: "anniversary",
          title: "생일 축하합니다",
          body: "오늘 하루는 조금 덜 부지런해도 됩니다",
          url: "/identity",
          reason: "오늘이 생일",
          dedupe: `birthday:${todayISO}`,
        }, log);
      }

      if (profile.career_started_at && profile.career_started_at.slice(5) === md) {
        const years = Number(todayISO.slice(0, 4)) - Number(profile.career_started_at.slice(0, 4));
        if (years > 0) {
          await queue(admin, profile.id, {
            kind: "anniversary",
            title: `${profile.company ?? "회사"} ${years}주년`,
            body: "지난 1년에 무엇이 남았는지 한 줄 적어둘까요",
            url: "/review",
            reason: "입사 기념일",
            dedupe: `work-anniversary:${todayISO}`,
          }, log);
        }
      }
    }

    const { data: rules } = await admin
      .from("notification_rules")
      .select("kind, at_local, days, config")
      .eq("user_id", profile.id)
      .eq("enabled", true);

    for (const rule of (rules ?? []) as Rule[]) {
      if (rule.days?.length && !rule.days.includes(dow)) continue;

      let payload: { title: string; body: string; url: string; reason: string } | null = null;
      let dedupe: string | null = null;

      if (rule.kind === "event_reminder") {
        // 30분 뒤 시작하는 일정. 틱 간격만큼의 창으로 본다.
        const from = new Date(now.getTime() + 30 * 60_000);
        const to = new Date(from.getTime() + TICK_WINDOW_MIN * 60_000);
        const { data: events } = await admin
          .from("events")
          .select("id, title, starts_at, location, region")
          .eq("user_id", profile.id)
          .eq("all_day", false)
          .gte("starts_at", from.toISOString())
          .lt("starts_at", to.toISOString());

        for (const e of events ?? []) {
          await queue(admin, profile.id, {
            kind: "event_reminder",
            title: `30분 뒤 · ${e.title}`,
            body: e.region ?? e.location ?? "",
            url: "/calendar",
            reason: "일정 시작 30분 전",
            dedupe: `event_reminder:${e.id}`,
          }, log);
        }
        continue;
      }

      if (!rule.at_local || !withinWindow(rule.at_local, minutesNow)) continue;

      if (rule.kind === "morning_brief") {
        const brief = await buildMorningBrief(admin, profile.id, todayISO, tz);
        if (brief) {
          payload = brief;
          dedupe = `morning_brief:${todayISO}`;
        }
      } else if (rule.kind === "habit_nudge") {
        const { data: habits } = await admin
          .from("habits")
          .select("id, title")
          .eq("user_id", profile.id)
          .eq("active", true);
        const { data: logs } = await admin
          .from("habit_logs")
          .select("habit_id")
          .eq("user_id", profile.id)
          .eq("logged_on", todayISO);

        const doneIds = new Set((logs ?? []).map((l) => l.habit_id));
        const pending = (habits ?? []).filter((h) => !doneIds.has(h.id));
        // 다 했으면 보내지 않는다. 칭찬 알림은 두 번째부터 소음이다.
        if (pending.length) {
          payload = {
            title: `아직 ${pending.length}개 남았습니다`,
            body: pending.map((h) => h.title).join(" · "),
            url: "/",
            reason: "오늘 미체크 습관",
          };
          dedupe = `habit_nudge:${todayISO}`;
        }
      } else if (rule.kind === "evening_review") {
        payload = {
          title: "오늘 어땠나요",
          body: "한 줄만 남겨두면 나중에 회고가 됩니다",
          url: "/review",
          reason: "저녁 회고 시각",
        };
        dedupe = `evening_review:${todayISO}`;
      }

      if (payload && dedupe) {
        await queue(admin, profile.id, { kind: rule.kind, ...payload, dedupe }, log);
      }
    }
  }

  return NextResponse.json({ ok: true, at: now.toISOString(), ...log });
}

function withinWindow(atLocal: string, minutesNow: number): boolean {
  const [h, m] = atLocal.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const target = h * 60 + m;
  return minutesNow >= target && minutesNow < target + TICK_WINDOW_MIN;
}

type Admin = ReturnType<typeof createAdminClient>;

async function queue(
  admin: Admin,
  userId: string,
  n: { kind: string; title: string; body: string; url: string; reason: string; dedupe: string },
  log: Record<string, number>,
) {
  // dedupe_key 유니크 인덱스가 중복을 막는다. 크론이 두 번 돌아도 한 번만 간다.
  const { data, error } = await admin
    .from("notifications")
    .insert({
      user_id: userId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      url: n.url,
      reason: n.reason,
      dedupe_key: n.dedupe,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !data) {
    log.skipped++;
    return;
  }
  log.queued++;

  try {
    const { sent } = await sendToUser(
      userId,
      { title: n.title, body: n.body, url: n.url, tag: n.kind },
      data.id,
    );
    await admin
      .from("notifications")
      .update({ status: sent > 0 ? "sent" : "skipped", sent_at: new Date().toISOString() })
      .eq("id", data.id);
    log.sent += sent > 0 ? 1 : 0;
  } catch (err) {
    await admin
      .from("notifications")
      .update({ status: "failed", error: String(err).slice(0, 500) })
      .eq("id", data.id);
  }
}

async function buildMorningBrief(
  admin: Admin,
  userId: string,
  todayISO: string,
  tz: string,
) {
  const from = new Date(`${todayISO}T00:00:00`);
  const to = new Date(from.getTime() + 86_400_000);

  const [{ data: events }, { data: tasks }, { data: overdue }] = await Promise.all([
    admin
      .from("events")
      .select("title, starts_at, all_day, region")
      .eq("user_id", userId)
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at"),
    admin
      .from("tasks")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["todo", "doing"])
      .lte("scheduled_for", todayISO),
    admin
      .from("goals")
      .select("title, period_end")
      .eq("user_id", userId)
      .eq("status", "active")
      .lt("period_end", todayISO),
  ]);

  const eventCount = events?.length ?? 0;
  const taskCount = tasks?.length ?? 0;
  const overdueCount = overdue?.length ?? 0;

  // 아무것도 없는 날은 보내지 않는다. 빈 브리핑이 며칠 이어지면
  // 알림 자체를 끄게 된다.
  if (eventCount === 0 && taskCount === 0 && overdueCount === 0) return null;

  const parts: string[] = [];
  if (eventCount) {
    const first = events![0];
    const when = first.all_day
      ? "종일"
      : format(toZonedTime(new Date(first.starts_at), tz), "HH:mm", { timeZone: tz });
    parts.push(`일정 ${eventCount}건 · 첫 일정 ${when} ${first.title}`);
  }
  if (taskCount) parts.push(`할 일 ${taskCount}개`);
  if (overdueCount) parts.push(`기한 지난 목표 ${overdueCount}개`);

  // region 이 있으면 맥락 서피싱의 입구가 된다 (Phase 2 에서 컬렉션 연결).
  const region = events?.find((e) => e.region)?.region;
  const title = region ? `오늘 ${region}이네요` : "오늘의 브리핑";

  return {
    title,
    body: parts.join(" · "),
    url: "/",
    reason: "아침 브리핑",
  };
}
