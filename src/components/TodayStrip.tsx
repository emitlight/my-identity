import Link from "next/link";
import { hhmm } from "@/lib/date";
import type { CalendarEvent, Habit, Task } from "@/lib/types";

/**
 * 모바일 전용 요약 띠.
 *
 * 폰에서 레일을 통째로 위에 깔면, 앱을 열자마자 보이는 것이 빈 체크박스
 * 넉 장이다. 그렇다고 아래로 내리면 "다음 일정이 뭐지"를 스크롤해서
 * 찾아야 한다. 그래서 위에는 숫자만 놓고, 손대는 목록은 지면 아래에
 * 한 벌만 둔다 — 체크박스가 두 벌 생기지 않는다.
 */
export function TodayStrip({
  events,
  tasks,
  habits,
  now,
}: {
  events: CalendarEvent[];
  tasks: Task[];
  habits: (Habit & { done_today: boolean })[];
  now: Date;
}) {
  const next =
    events.find((e) => !e.all_day && new Date(e.starts_at) >= now) ?? events[0];
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const doneHabits = habits.filter((h) => h.done_today).length;

  return (
    // 그리드로 잡는다. 플렉스로 두면 제목이 긴 일정에서 첫 칸이 안 줄고
    // 뒤의 숫자 두 칸이 화면 밖으로 밀린다.
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-stretch border-y border-line lg:hidden">
      <Link href="/calendar" className="flex min-w-0 flex-col gap-1 py-3 pr-4">
        <span className="kicker text-faint">다음</span>
        {next ? (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="num shrink-0 text-[13px] text-accent">
              {next.all_day ? "종일" : hhmm(next.starts_at)}
            </span>
            <span className="truncate text-[14px]">{next.title}</span>
          </span>
        ) : (
          <span className="text-[14px] text-faint">일정 없음</span>
        )}
      </Link>

      <Counter href="#today-list" label="할 일" done={doneTasks} total={tasks.length} />
      <Counter href="#today-list" label="습관" done={doneHabits} total={habits.length} />
    </div>
  );
}

function Counter({
  href,
  label,
  done,
  total,
}: {
  href: string;
  label: string;
  done: number;
  total: number;
}) {
  return (
    <Link
      href={href}
      className="flex shrink-0 flex-col gap-1 border-l border-line-soft py-3 pl-4 pr-4 last:pr-0"
    >
      <span className="kicker text-faint">{label}</span>
      <span className="num text-[13px]">
        <span className={done === total && total > 0 ? "text-ok" : "text-ink"}>{done}</span>
        <span className="text-faint"> / {total}</span>
      </span>
    </Link>
  );
}
