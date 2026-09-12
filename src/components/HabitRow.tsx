"use client";

import { useOptimistic, useTransition } from "react";
import { toggleHabit } from "@/lib/actions/habits";

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
    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
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
        className="size-[17px] shrink-0 cursor-pointer accent-[var(--accent)]"
      />
      <span
        className={
          "min-w-0 flex-1 text-[14.5px] " + (done ? "text-muted" : "text-ink")
        }
      >
        {title}
      </span>
      {shown > 0 ? (
        <span className="shrink-0 text-[12px] tnum text-faint">{shown}일 연속</span>
      ) : null}
    </label>
  );
}
