import Link from "next/link";
import { TaskRow } from "@/components/TaskRow";
import { HabitRow } from "@/components/HabitRow";
import { Kicker } from "@/components/editorial";
import { hhmm } from "@/lib/date";
import type { CalendarEvent, Habit, Role, Task } from "@/lib/types";

/**
 * 실행 레일 — 데스크탑에서는 왼쪽에 상시 고정, 모바일에서는 제호 바로 아래.
 *
 * 본지가 아무리 화려해도 "다음 일정이 뭐고 오늘 뭘 해야 하나"는
 * 스크롤 없이 보여야 한다. 그래서 레일은 늘 첫 화면 안에 있다.
 */
export function TodayRail({
  events,
  tasks,
  habits,
  roles,
  inboxCount,
  now,
}: {
  events: CalendarEvent[];
  tasks: Task[];
  habits: (Habit & { done_today: boolean; streak: number })[];
  roles: Role[];
  inboxCount: number;
  now: Date;
}) {
  const roleColor = new Map(roles.map((r) => [r.id, r.color]));
  const upcoming = events.find((e) => !e.all_day && new Date(e.starts_at) >= now);
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const doneHabits = habits.filter((h) => h.done_today).length;

  return (
    <div className="flex flex-col gap-7 lg:gap-8">
      {/* 지금 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <Kicker tone="quiet">지금</Kicker>
          {upcoming ? (
            <span className="num text-[11.5px] text-accent">
              {relative(upcoming.starts_at, now)}
            </span>
          ) : null}
        </div>

        {events.length === 0 ? (
          <p className="text-[13px] text-faint">오늘은 일정이 없습니다</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {events.map((e) => {
              const past = !e.all_day && new Date(e.starts_at) < now;
              return (
                <div
                  key={e.id}
                  className={"flex items-baseline gap-3 " + (past ? "opacity-40" : "")}
                >
                  <span className="num w-[38px] shrink-0 text-[12.5px] text-muted">
                    {e.all_day ? "종일" : hhmm(e.starts_at)}
                  </span>
                  <span className="min-w-0 flex-1 text-[14px] leading-snug">{e.title}</span>
                  {e.role_id && roleColor.get(e.role_id) ? (
                    <span
                      aria-hidden
                      className="size-[6px] shrink-0 rounded-full"
                      style={{ background: roleColor.get(e.role_id)! }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 오늘 할 일 */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <Kicker tone="quiet">오늘 할 일</Kicker>
          <span className="num text-[11.5px] text-faint">
            {doneTasks} / {tasks.length}
          </span>
        </div>

        {tasks.length === 0 ? (
          <p className="text-[13px] text-faint">비어 있습니다</p>
        ) : (
          <div className="-mx-2 flex flex-col">
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                roleColor={roleColor.get(t.role_id ?? "")}
                overdue={!!t.due_at && new Date(t.due_at) < now}
              />
            ))}
          </div>
        )}

        {inboxCount > 0 ? (
          <Link href="/tasks" className="text-[11.5px] text-faint hover:text-ink">
            정리 안 된 인박스 {inboxCount}
          </Link>
        ) : null}
      </section>

      {/* 습관 */}
      {habits.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <Kicker tone="quiet">습관</Kicker>
            <span className="num text-[11.5px] text-faint">
              {doneHabits} / {habits.length}
            </span>
          </div>
          <div className="-mx-2 flex flex-col">
            {habits.map((h) => (
              <HabitRow
                key={h.id}
                id={h.id}
                title={h.title}
                doneToday={h.done_today}
                streak={h.streak}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function relative(target: string, now: Date): string {
  const min = Math.round((new Date(target).getTime() - now.getTime()) / 60000);
  if (min < 1) return "지금";
  if (min < 60) return `${min}분 뒤`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}시간 뒤` : `${Math.floor(h / 24)}일 뒤`;
}
