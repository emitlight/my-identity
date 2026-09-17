"use client";

import { useOptimistic, useTransition } from "react";
import { toggleHabit } from "@/lib/actions/habits";
import { boxStyle } from "@/components/TaskRow";

export function HabitRow({
  id,
  title,
  doneToday,
  streak,
}: {
  id: string;
  title: string;
  doneToday: boolean;
  streak: number;
}) {
  const [done, setDone] = useOptimistic(doneToday);
  const [, start] = useTransition();

  // 낙관적으로 켜면 스트릭도 같이 늘어야 자연스럽다.
  const shown = done === doneToday ? streak : done ? streak + 1 : Math.max(0, streak - 1);

  return (
    <label className="group flex cursor-pointer items-center gap-4 border-b border-ink/15 px-2 py-3 transition-colors hover:bg-[#FFBFD5] dark:hover:bg-[color:var(--surface-2)]">
      <input
        type="checkbox"
        checked={done}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            setDone(next);
            await toggleHabit({ habitId: id, done: next });
          });
        }}
        className="size-[22px] shrink-0 cursor-pointer appearance-none border-2 border-ink transition-colors"
        style={boxStyle(done)}
      />

      <span
        className={
          "krb min-w-0 flex-1 truncate text-[clamp(15px,4vw,19px)] " +
          (done ? "text-faint line-through decoration-2" : "text-ink")
        }
      >
        {title}
      </span>

      {shown > 0 ? (
        <span className="flex shrink-0 items-baseline gap-1.5">
          <span
            className="num text-[clamp(22px,5.5vw,30px)] leading-[.8] text-hot-deep"
            style={{ fontVariationSettings: '"opsz" 16' }}
          >
            {shown}
          </span>
          <span className="kicker-kr text-[10px] tracking-[.06em] text-muted">일 연속</span>
        </span>
      ) : (
        // 0 을 숫자로 박지 않는다. 아직 시작하지 않은 것과 0일 연속은 다른 말이다.
        <span className="kicker shrink-0 text-[8.5px] text-faint">
          {done ? "Day one" : "Not yet"}
        </span>
      )}
    </label>
  );
}
