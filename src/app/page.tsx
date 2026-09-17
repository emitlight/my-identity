import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { QuickCapture } from "@/components/QuickCapture";
import { TaskRow } from "@/components/TaskRow";
import { HabitRow } from "@/components/HabitRow";
import {
  Burst,
  CoverPlate,
  DeadlineBand,
  EmptyNote,
  HighlightPlate,
  IndexRow,
  InkDeck,
  Ledger,
  NextUpBand,
  SectionRule,
  kindFor,
  toneAt,
} from "@/components/editorial";
import { todayISO, hhmm, untilLabel, weekday, daysUntil, TZ, local } from "@/lib/date";
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

/** 컬렉션 안의 낱장 하나 — 서랍이 아니라 기사로 지면에 오르는 단위 */
interface HighlightRow {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  cover_url: string | null;
  region: string | null;
  rating: number | null;
  status: string;
  created_at: string;
  collection_slug: string;
  collection_name: string;
  collection_kind: string;
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
  highlights: HighlightRow[];
  aspiration: AspirationRow | null;
}

/* 색면이 지면 끝까지 나가게 한다. AppShell 의 좌우 여백을 상쇄할 뿐,
   최대 폭(1440)은 넘지 않으므로 가로 스크롤이 생기지 않는다. */
function Bleed({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`-mx-5 lg:-mx-10 ${className}`}>{children}</div>;
}

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
        <div className="max-w-[52ch] pt-8">
          <h2 className="krd text-[clamp(28px,7vw,52px)] leading-[.98]">
            지면을 불러오지 못했습니다
          </h2>
          <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
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
  const z = local(snap.today ?? today);
  const dateline = `${z.getFullYear()}년 ${z.getMonth() + 1}월 ${z.getDate()}일 ${weekday(now)}요일`;

  const roleColor = new Map(snap.roles.map((r) => [r.id, r.color]));

  /* ── 다음 일정 ───────────────────────────────────────── */
  const next = snap.next_event;
  const rest = snap.events
    .filter((e) => e.id !== next?.id)
    .map((e) => ({
      time: e.all_day ? "종일" : hhmm(e.starts_at),
      title: e.title,
      tag: e.all_day ? "종일" : new Date(e.starts_at) < now ? "끝남" : undefined,
      strong: e.all_day || new Date(e.starts_at) >= now,
    }));

  /* ── 실행 ────────────────────────────────────────────── */
  const doneTasks = snap.tasks.filter((t) => t.status === "done").length;
  const doneHabits = snap.habits.filter((h) => h.done_today).length;

  /* ── 마감 ────────────────────────────────────────────── */
  // 표지로 올라간 경고는 밴드에서 뺀다. 같은 문장을 두 번 읽히지 않는다.
  const surface = snap.alerts.find((a) => a.kind === "surface");
  const overdue = snap.alerts.find((a) => a.kind === "overdue");
  const coverAlert = surface ?? overdue ?? null;
  const band = snap.alerts.filter((a) => a !== coverAlert);

  /* ── 표지 ────────────────────────────────────────────── */
  const cover = pickCover(snap, coverAlert, now);

  /* ── 이번 호 ─────────────────────────────────────────── */
  // 같은 컬렉션의 낱장이 줄줄이 같은 색이 되지 않게 컬렉션별로 색을 돌린다.
  const seen = new Map<string, number>();
  const plates = snap.highlights.map((h) => {
    const i = seen.get(h.collection_slug) ?? 0;
    seen.set(h.collection_slug, i + 1);
    return { h, tone: toneAt(i + h.collection_slug.length) };
  });

  // 2단에서 마지막 한 장이 혼자 남으면 폭을 넓혀 지면을 닫는다.
  const tailOrphan = plates.length > 1 && plates.length % 2 === 0;

  const feed = [...snap.feed].sort(
    (a, b) => (a.total === 0 ? 1 : 0) - (b.total === 0 ? 1 : 0),
  );

  return (
    <AppShell active="today" title="오늘" dateline={dateline}>
      {/* ═══ 다음 일정 — 제호를 자르고 들어온다 ═══ */}
      <Bleed className="relative z-[2] -mt-[clamp(9px,2.54vw,37px)]">
        <NextUpBand
          time={next ? (next.all_day ? "종일" : hhmm(next.starts_at)) : undefined}
          title={next?.title}
          until={next && !next.all_day ? untilLabel(next.starts_at, now) : undefined}
          rest={rest}
          empty={snap.events.length ? "남은 일정이 없습니다" : "오늘은 일정이 없습니다"}
        />
      </Bleed>

      {/* ═══ 할 일 · 습관 · 인박스 ═══ */}
      <Bleed
        className={
          "grid border-b-[3px] border-ink lg:grid-cols-[1fr_458px_292px] " +
          (snap.inbox_count > 0 ? "" : "lg:grid-cols-[1fr_458px]")
        }
      >
        <Ledger
          lat="To do · today"
          kr="오늘 할 일"
          done={doneTasks}
          total={snap.tasks.length || undefined}
        >
          {snap.tasks.length ? (
            <div className="-mx-2">
              {snap.tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  roleColor={roleColor.get(t.role_id ?? "")}
                  overdue={!!t.due_at && new Date(t.due_at) < now}
                />
              ))}
            </div>
          ) : (
            <EmptyNote
              sub={
                snap.inbox_count > 0
                  ? `인박스에 ${snap.inbox_count}개가 정리를 기다리고 있습니다.`
                  : "아래 입력창에 한 줄 적으면 여기로 옵니다."
              }
            >
              오늘 할 일이 비어 있습니다
            </EmptyNote>
          )}
        </Ledger>

        <Ledger
          lat="Habits"
          kr="습관"
          done={doneHabits}
          total={snap.habits.length || undefined}
          tone="blush"
        >
          {snap.habits.length ? (
            <div className="-mx-2">
              {snap.habits.map((h) => (
                <HabitRow
                  key={h.id}
                  id={h.id}
                  title={h.title}
                  doneToday={h.done_today}
                  streak={h.streak}
                />
              ))}
            </div>
          ) : (
            <EmptyNote>아직 습관이 없습니다</EmptyNote>
          )}
        </Ledger>

        {snap.inbox_count > 0 ? (
          <Link
            href="/tasks"
            className="tile flex flex-col items-center justify-center gap-3 border-t-[3px] border-ink bg-ink px-6 py-8 text-center text-[color:var(--on-dark)] lg:border-l-[3px] lg:border-t-0"
          >
            <Burst lat="Inbox" value={snap.inbox_count} note="정리 안 됨" />
            <span className="krb mt-1 text-[clamp(15px,3.8vw,18px)]">정리 안 된 인박스</span>
            <span className="text-[11.5px] leading-relaxed text-[color:var(--on-dark-dim)]">
              오늘 안에 비울 수 있습니다
            </span>
          </Link>
        ) : null}
      </Bleed>

      {/* ═══ 빠른 입력 ═══ */}
      <div className="pt-6 lg:pt-7">
        <QuickCapture />
      </div>

      {/* ═══ 마감 ═══ */}
      {band.length ? (
        <Bleed className="mt-7 lg:mt-9">
          <DeadlineBand
            items={band.map((a) => ({
              num: firstNumber(a.body) ?? "—",
              unit: a.kind === "due_soon" ? "일 남음" : "일째 조용",
              title: a.title,
              urgent: a.kind === "due_soon" && (Number(firstNumber(a.body)) || 99) <= 14,
            }))}
          />
        </Bleed>
      ) : null}

      {/* ═══ 표지 기사 — 여기부터 잡지 ═══ */}
      {cover ? (
        <section className="mt-10 lg:mt-14">
          <div className="flex items-center gap-4 border-t-[4px] border-ink pt-3">
            <span className="kicker text-hot-deep">Cover story</span>
            <span className="kicker-kr tracking-[.2em]">오늘의 특집</span>
            <span aria-hidden className="h-[2px] flex-1 bg-ink" />
            <span className="kicker hidden text-faint sm:block">이번 호 첫 번째 기사</span>
          </div>

          <Bleed className="mt-5 lg:mt-6">
            <CoverPlate
              tabLat={cover.tabLat}
              tabKr={cover.tabKr}
              headLat={cover.plateHeadLat}
              headKr={cover.plateHeadKr}
              items={cover.items}
              rows={cover.rows}
              stamp={cover.stamp}
            />
            <InkDeck
              kickerLat={cover.deckLat}
              kickerKr={cover.deckKr}
              headline={cover.headline}
              hot={cover.hot}
              standfirst={cover.standfirst}
              asideLat={cover.asideLat}
              asideTitle={cover.asideTitle}
              asideNote={cover.asideNote}
              numeral={cover.numeral}
              numeralLabel={cover.numeralLabel}
              href={cover.href}
            />
          </Bleed>
        </section>
      ) : null}

      {/* ═══ 이번 호 ═══ */}
      {plates.length ? (
        <section className="mt-11 lg:mt-16">
          <SectionRule
            lat="Inside this issue"
            right={
              snap.highlights.some((h) => h.cover_url)
                ? undefined
                : "사진은 아직 없습니다. 활자가 대신 싣습니다."
            }
          >
            이번 호
          </SectionRule>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:gap-5 lg:mt-7 lg:grid-cols-3 lg:gap-7">
            {plates.map(({ h, tone }, i) => (
              <div
                key={h.id}
                className={
                  "min-w-0 " +
                  (i === 0 ? "col-span-2 lg:col-span-2 " : "") +
                  (tailOrphan && i === plates.length - 1 ? "col-span-2 lg:col-span-1" : "")
                }
              >
                <HighlightPlate
                  n={i + 1}
                  rubric={h.collection_name}
                  title={h.title}
                  note={h.summary ?? h.subtitle}
                  region={h.region}
                  href={`/collections/${h.collection_slug}/${h.id}`}
                  kind={kindFor(h.collection_slug, h.collection_kind)}
                  tone={tone}
                  image={h.cover_url}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ═══ 컬렉션 색인 — 빈 것도 정보다 ═══ */}
      {feed.length ? (
        <section className="mt-11 lg:mt-16">
          <SectionRule lat="Departments" right="전부 보기 →">
            컬렉션
          </SectionRule>
          <div className="mt-4 grid gap-x-10 sm:grid-cols-2 lg:mt-6">
            {feed.map((f) => (
              <IndexRow
                key={f.id}
                name={f.name}
                total={f.total}
                meta={lastSeen(f)}
                href={`/collections/${f.slug}`}
              />
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

/* ============================================================
   표지 고르기

   오늘 지면에 올릴 것이 무엇인지 데이터가 정한다. 맥락 서피싱이
   있으면 그것이, 없으면 기한 지난 것이, 그것도 없으면 추구미가
   표지로 온다. 셋 다 없으면 표지 없이 간다 — 빈 표지를 억지로
   세우는 것보다 낫다.
   ============================================================ */
function pickCover(
  snap: Snapshot,
  alert: TodayAlert | null,
  now: Date,
): {
  tabLat?: string;
  tabKr: string;
  plateHeadLat?: string;
  plateHeadKr?: string;
  items?: { lead?: string; name: string }[];
  rows?: { label: string; value: number | string; unit?: string }[];
  stamp?: string;
  deckLat?: string;
  deckKr?: string;
  headline: string;
  hot?: string;
  standfirst?: string;
  asideLat?: string;
  asideTitle?: string;
  asideNote?: string;
  numeral?: string | number;
  numeralLabel?: string;
  href: string;
} | null {
  // 오늘 일정 중 지역이 붙은 것 — 표지 기사와 오늘을 잇는 끈
  const located = snap.events.find((e) => e.region);

  if (alert) {
    const chips = alert.chips ?? [];
    const n = firstNumber(alert.body);
    return {
      tabLat: located?.region ? "Today" : "Saved",
      tabKr: located?.region ?? "오늘의 특집",
      plateHeadLat: chips.length ? "Saved · never visited" : undefined,
      plateHeadKr: chips.length ? `${chips.length}군데` : undefined,
      items: chips.map((c, i) => ({ lead: String(i + 1).padStart(2, "0"), name: c })),
      rows: chips.length
        ? undefined
        : [{ label: "확인해야 할 것", value: n ?? 1, unit: "건" }],
      stamp: stampFor(now, located?.region),
      deckLat: alert.kind === "surface" ? "Cover story" : "Needs a look",
      deckKr: alert.kind === "surface" ? "오늘의 특집" : "확인이 필요합니다",
      headline: alert.title,
      hot: located?.region && alert.title.includes(located.region) ? located.region : undefined,
      standfirst: alert.body,
      asideLat: located ? "On today" : undefined,
      asideTitle: located?.title,
      asideNote: located
        ? located.all_day
          ? "종일 · 달력에 이미 잡혀 있음"
          : `${hhmm(located.starts_at)} · 달력에 이미 잡혀 있음`
        : undefined,
      numeral: n,
      numeralLabel: n ? "건" : undefined,
      href: alert.href,
    };
  }

  const asp = snap.aspiration;
  if (!asp) return null;

  // 레퍼런스도 기록도 0 인 상태가 오늘의 진실이다. 숨기지 않고 표지에 올린다.
  const headline = asp.statement ?? asp.title;
  return {
    tabLat: "Aspiration",
    tabKr: "추 구 미",
    plateHeadLat: "What I have toward it",
    plateHeadKr: "지금 가진 것",
    rows: [
      { label: "레퍼런스", value: asp.refs, unit: "장" },
      { label: "기록", value: asp.evidence, unit: "장" },
    ],
    stamp: stampFor(now),
    deckLat: "Cover story",
    deckKr: asp.due_capture ? "이번 달 기록할 차례" : "추구미",
    headline,
    standfirst:
      asp.refs === 0 && asp.evidence === 0
        ? `${asp.title}. 아직 한 장도 모으지 않았습니다.`
        : `${asp.title}. 레퍼런스 ${asp.refs}장 · 기록 ${asp.evidence}장.`,
    asideLat: asp.due_capture ? "This month" : undefined,
    asideTitle: asp.due_capture ? "기록할 차례" : undefined,
    asideNote: asp.due_capture ? "한 장이면 시작됩니다" : undefined,
    numeral: asp.refs,
    numeralLabel: "레퍼런스",
    href: "/identity",
  };
}

function stampFor(now: Date, region?: string | null): string {
  const z = local(now);
  const d = `${z.getFullYear()} · ${pad(z.getMonth() + 1)} · ${pad(z.getDate())}`;
  return region ? `${d} — ${region}` : d;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "3일 남음", "43일 경과" 에서 첫 숫자만.
    0 은 돌려주지 않는다 — 표지에 큰 활자로 0 을 박으면 비었다고 광고하는 꼴이다. */
function firstNumber(text: string | null | undefined): string | undefined {
  const n = text?.match(/\d+/)?.[0];
  return n && n !== "0" ? n : undefined;
}

function lastSeen(f: FeedRow): string | undefined {
  if (!f.last_active) return f.total ? undefined : "비어 있음";
  const days = -daysUntil(f.last_active.slice(0, 10));
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return "1년 넘음";
}
