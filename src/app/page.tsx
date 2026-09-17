import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { QuickCapture } from "@/components/QuickCapture";
import { TodayRail } from "@/components/TodayRail";
import {
  CoverStory,
  DeadlineBand,
  FeedCard,
  Kicker,
  SectionRule,
} from "@/components/editorial";
import { todayISO, monthDay, weekday, daysUntil, TZ } from "@/lib/date";
import type { CalendarEvent, Habit, Role, Task, TodayAlert } from "@/lib/types";

export const dynamic = "force-dynamic";

interface FeedRow {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  cover_url: string | null;
  kind: string;
  total: number;
  unseen: number;
  last_active: string | null;
}

interface AspirationRow {
  id: string;
  title: string;
  statement: string | null;
  cover_url: string | null;
  refs: number;
  evidence: number;
  due_capture: boolean;
}

interface Snapshot {
  today: string;
  roles: Role[];
  events: CalendarEvent[];
  next_event: CalendarEvent | null;
  tasks: Task[];
  inbox_count: number;
  habits: (Habit & { done_today: boolean; streak: number })[];
  alerts: TodayAlert[];
  feed: FeedRow[];
  aspiration: AspirationRow | null;
}

const RUBRIC: Record<string, string> = {
  places: "저장된 장소",
  golf: "운동",
  countries: "여행",
  wishlist: "위시리스트",
  music: "음악",
  watch: "본 것",
  books: "읽기",
  bucket: "버킷리스트",
};

export default async function TodayPage() {
  const { supabase } = await requireUser();
  const today = todayISO();

  const { data, error } = await supabase.rpc("today_snapshot", {
    p_today: today,
    p_tz: TZ,
  });

  if (error) {
    return (
      <AppShell active="today" title="오늘">
        <div className="max-w-[52ch]">
          <h2 className="display text-[26px]">지면을 불러오지 못했습니다</h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
            마이그레이션이 아직 적용되지 않았을 수 있습니다.{" "}
            <code className="text-[13px]">supabase/migrations</code> 를 순서대로
            적용한 뒤 새로고침해 주세요.
          </p>
        </div>
      </AppShell>
    );
  }

  const snap = data as Snapshot;
  const now = new Date();
  const dateline = `${monthDay(now)} ${weekday(now)}요일`;

  // ── 표지 기사 고르기 ───────────────────────────────────────
  // 오늘 가장 흥미로운 것이 표지가 된다. 맥락 서피싱이 있으면 그것이,
  // 없으면 기한이 지난 것이, 그것도 없으면 추구미가 표지로 온다.
  // "오늘 할 일 없음"만 뜨는 표지는 아무것도 말해주지 않는다.
  const surface = snap.alerts.find((a) => a.kind === "surface");
  const overdue = snap.alerts.find((a) => a.kind === "overdue");
  const band = snap.alerts.filter((a) => a !== surface && a !== overdue);

  const cover =
    surface
      ? {
          kicker: "오늘의 특집",
          headline: surface.title,
          standfirst: surface.body,
          href: surface.href,
          seed: surface.title,
          number: firstNumber(surface.body),
          numberLabel: "안 가본 곳",
          // 서피싱된 항목 자체의 사진이 먼저다. 없으면 컬렉션 표지로 내려간다.
          image:
            surface.image ??
            snap.feed.find((f) => surface.href.includes(f.slug))?.cover_url,
          chips: surface.chips ?? undefined,
        }
      : overdue
        ? {
            kicker: "확인이 필요합니다",
            headline: overdue.title,
            standfirst: overdue.body,
            href: overdue.href,
            seed: overdue.title,
            number: firstNumber(overdue.body),
            numberLabel: "일 경과",
            image: null,
            chips: undefined,
          }
        : snap.aspiration
          ? {
              kicker: snap.aspiration.due_capture ? "이번 달 기록할 차례" : "추구미",
              headline: snap.aspiration.title,
              standfirst:
                snap.aspiration.statement ??
                `레퍼런스 ${snap.aspiration.refs}장 · 기록 ${snap.aspiration.evidence}장`,
              href: `/identity`,
              seed: snap.aspiration.title,
              number: String(snap.aspiration.refs),
              numberLabel: "레퍼런스",
              image: snap.aspiration.cover_url,
              chips: undefined,
            }
          : null;

  return (
    <AppShell
      active="today"
      title="오늘"
      dateline={dateline}
      rail={
        <TodayRail
          events={snap.events}
          tasks={snap.tasks}
          habits={snap.habits}
          roles={snap.roles}
          inboxCount={snap.inbox_count}
          now={now}
        />
      }
    >
      <div className="flex flex-col gap-10 lg:gap-14">
        <QuickCapture />

        {cover ? (
          <CoverStory
            kicker={cover.kicker}
            headline={cover.headline}
            standfirst={cover.standfirst}
            chips={cover.chips}
            number={cover.number}
            numberLabel={cover.numberLabel}
            href={cover.href}
            image={cover.image}
            seed={cover.seed}
          />
        ) : null}

        {band.length ? (
          <DeadlineBand
            items={band.map((a) => ({
              num: firstNumber(a.body) ?? "—",
              unit: a.kind === "due_soon" ? "일 남음" : "일째 조용",
              title: a.title,
              urgent: a.kind === "due_soon" && (Number(firstNumber(a.body)) || 99) <= 14,
            }))}
          />
        ) : null}

        {snap.feed.length ? (
          <section className="flex flex-col gap-6">
            <SectionRule right="내가 모아둔 것들">이번 호에서</SectionRule>

            <div className="grid grid-cols-2 gap-5 lg:grid-cols-3 lg:gap-8">
              {snap.aspiration ? (
                <FeedCard
                  rubric="추구미"
                  headline={snap.aspiration.title}
                  standfirst={snap.aspiration.statement ?? undefined}
                  meta={
                    snap.aspiration.due_capture
                      ? "기록할 차례"
                      : `REFERENCE ${snap.aspiration.refs}`
                  }
                  dot="var(--role-4)"
                  href="/identity"
                  image={snap.aspiration.cover_url}
                  seed={snap.aspiration.title}
                />
              ) : null}

              {snap.feed.map((f) => (
                <FeedCard
                  key={f.id}
                  rubric={RUBRIC[f.slug] ?? f.name}
                  headline={f.name}
                  standfirst={standfirst(f)}
                  meta={meta(f)}
                  dot={null}
                  href={`/collections/${f.slug}`}
                  image={f.cover_url}
                  seed={f.slug}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-4">
            <SectionRule>이번 호에서</SectionRule>
            <p className="max-w-[46ch] text-[14.5px] leading-relaxed text-muted">
              아직 모아둔 자료가 없습니다. 컬렉션을 만들면 여기가 지면으로 채워집니다.
            </p>
            <Kicker tone="quiet">컬렉션 →</Kicker>
          </section>
        )}
      </div>
    </AppShell>
  );
}

/** "3일 남음", "43일 경과", "아직 안 가본 곳 3군데" 에서 첫 숫자만 */
function firstNumber(text: string | null | undefined): string | undefined {
  return text?.match(/\d+/)?.[0];
}

function standfirst(f: FeedRow): string | undefined {
  if (f.total === 0) return "아직 비어 있습니다";
  if (f.unseen > 0) return `${f.total}곳 중 ${f.unseen}곳은 아직 안 가봤습니다`;
  return `${f.total}개를 모아뒀습니다`;
}

function meta(f: FeedRow): string | undefined {
  if (!f.last_active) return f.total ? undefined : "비어 있음";
  const days = -daysUntil(f.last_active.slice(0, 10));
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return "1년 넘음";
}
