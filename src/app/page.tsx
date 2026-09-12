import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { QuickCapture } from "@/components/QuickCapture";
import { TaskRow } from "@/components/TaskRow";
import { HabitRow } from "@/components/HabitRow";
import { Card, SectionLabel, Empty, RoleDot } from "@/components/ui";
import { todayISO, hhmm, monthDay, weekday, untilLabel, TZ } from "@/lib/date";
import type { CalendarEvent, Habit, Role, Task, TodayAlert } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Snapshot {
  today: string;
  roles: Role[];
  events: CalendarEvent[];
  next_event: CalendarEvent | null;
  tasks: Task[];
  inbox_count: number;
  habits: (Habit & { done_today: boolean; streak: number })[];
  alerts: TodayAlert[];
}

/**
 * 경고는 심각도를 형태로 구분한다.
 * 셋 다 같은 색으로 칠하면 한눈에 무엇이 급한지 안 읽히고,
 * 그러면 전부 무시하게 된다.
 */
const ALERT_STYLE: Record<
  TodayAlert["kind"],
  { label: string; filled: boolean; strong: boolean }
> = {
  overdue:  { label: "기한 지남",   filled: true,  strong: true },
  due_soon: { label: "마감 임박",   filled: false, strong: true },
  stale:    { label: "조용함",      filled: false, strong: false },
  surface:  { label: "오늘의 맥락", filled: true,  strong: true },
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
        <Card className="p-5">
          <p className="text-[14.5px] text-danger">
            데이터를 불러오지 못했습니다.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            마이그레이션이 아직 적용되지 않았을 수 있습니다.
            <br />
            <code className="text-[12px]">supabase/migrations</code> 를 프로젝트에
            적용한 뒤 새로고침해 주세요.
          </p>
        </Card>
      </AppShell>
    );
  }

  const snap = data as Snapshot;
  const now = new Date();
  const roleColor = new Map(snap.roles.map((r) => [r.id, r.color]));

  const dateLabel = `${monthDay(now)} ${weekday(now)}요일`;
  const timed = snap.events.filter((e) => !e.all_day);
  const allDay = snap.events.filter((e) => e.all_day);
  const upcoming = timed.find((e) => new Date(e.starts_at) >= now);

  return (
    <AppShell active="today" title="오늘" subtitle={dateLabel}>
      <div className="flex flex-col gap-6">
        <QuickCapture />

        {snap.alerts.length > 0 ? (
          <section className="flex flex-col gap-2">
            <SectionLabel right={`${snap.alerts.length}건`}>확인이 필요합니다</SectionLabel>
            {snap.alerts.map((a, i) => {
              const s = ALERT_STYLE[a.kind];
              return (
                <Card key={i} tone={s.filled ? "signal" : "plain"} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-[14.5px] font-medium text-ink">
                      {a.title}
                    </span>
                    <span
                      className={
                        "shrink-0 text-[11px] font-medium tracking-wide " +
                        (s.strong ? "text-signal" : "text-faint")
                      }
                    >
                      {s.label}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-muted tnum">{a.body}</p>
                </Card>
              );
            })}
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <SectionLabel right={upcoming ? untilLabel(upcoming.starts_at, now) : undefined}>
            {upcoming ? "다음 일정" : "오늘 일정"}
          </SectionLabel>

          {snap.events.length === 0 ? (
            snap.next_event ? (
              <Card className="px-4 py-3.5">
                <p className="text-[13px] text-faint">오늘은 일정이 없습니다</p>
                <div className="mt-2 flex items-baseline gap-2.5">
                  <span className="text-[12.5px] tnum text-muted">
                    {monthDay(snap.next_event.starts_at)}
                  </span>
                  <span className="min-w-0 text-[14.5px]">{snap.next_event.title}</span>
                </div>
              </Card>
            ) : (
              <Card>
                <Empty>일정이 없습니다. 위에 한 줄로 적어보세요.</Empty>
              </Card>
            )
          ) : (
            <Card className="divide-y divide-line-soft">
              {allDay.map((e) => (
                <EventRow key={e.id} event={e} color={roleColor.get(e.role_id ?? "")} />
              ))}
              {timed.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  color={roleColor.get(e.role_id ?? "")}
                  past={new Date(e.starts_at) < now}
                />
              ))}
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <SectionLabel right={snap.tasks.length ? `${snap.tasks.length}개` : undefined}>
            오늘 할 일
          </SectionLabel>
          {snap.tasks.length === 0 ? (
            <Card>
              <Empty>오늘 할 일이 없습니다.</Empty>
            </Card>
          ) : (
            <Card className="divide-y divide-line-soft">
              {snap.tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  roleColor={roleColor.get(t.role_id ?? "")}
                  overdue={!!t.due_at && new Date(t.due_at) < now}
                />
              ))}
            </Card>
          )}

          {snap.inbox_count > 0 ? (
            <Link
              href="/tasks?filter=inbox"
              className="px-1 text-[12.5px] text-faint hover:text-muted"
            >
              정리 안 된 인박스 {snap.inbox_count}개 →
            </Link>
          ) : null}
        </section>

        {snap.habits.length > 0 ? (
          <section className="flex flex-col gap-2">
            <SectionLabel
              right={`${snap.habits.filter((h) => h.done_today).length} / ${snap.habits.length}`}
            >
              습관
            </SectionLabel>
            <Card className="divide-y divide-line-soft">
              {snap.habits.map((h) => (
                <HabitRow
                  key={h.id}
                  id={h.id}
                  title={h.title}
                  doneToday={h.done_today}
                  streak={h.streak}
                />
              ))}
            </Card>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function EventRow({
  event,
  color,
  past,
}: {
  event: CalendarEvent;
  color?: string | null;
  past?: boolean;
}) {
  return (
    <div className={"flex items-baseline gap-3 px-3 py-2.5 " + (past ? "opacity-45" : "")}>
      <span className="w-[42px] shrink-0 text-[12.5px] tnum text-muted">
        {event.all_day ? "종일" : hhmm(event.starts_at)}
      </span>
      <span className="min-w-0 flex-1 text-[14.5px] leading-snug">{event.title}</span>
      {event.region ? (
        <span className="shrink-0 text-[11.5px] text-faint">{event.region}</span>
      ) : null}
      <RoleDot color={color} />
    </div>
  );
}
