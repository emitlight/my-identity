"use client";

import { useOptimistic, useTransition } from "react";
import { toggleTask } from "@/lib/actions/tasks";
import { RoleDot } from "@/components/ui";
import type { Task } from "@/lib/types";

/**
 * 체크박스는 서버 응답을 기다리지 않는다.
 * 0.5초의 지연이 "이 앱 느리네"가 되고, 그게 안 쓰는 이유가 된다.
 */
export function TaskRow({
  task,
  roleColor,
  overdue,
}: {
  task: Task;
  roleColor?: string | null;
  overdue?: boolean;
}) {
  const [done, setDone] = useOptimistic(task.status === "done");
  const [, start] = useTransition();

  return (
    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
      <input
        type="checkbox"
        checked={done}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            setDone(next);
            await toggleTask({ id: task.id, done: next });
          });
        }}
        className="mt-[3px] size-[17px] shrink-0 cursor-pointer accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1">
        <span
          className={
            "block text-[14.5px] leading-snug " +
            (done ? "text-faint line-through" : "text-ink")
          }
        >
          {task.title}
        </span>
        {(overdue || task.estimate_min) && !done ? (
          <span className="mt-0.5 flex items-center gap-2 text-[11.5px] tnum">
            {overdue ? <span className="text-signal">마감 지남</span> : null}
            {task.estimate_min ? (
              <span className="text-faint">{task.estimate_min}분</span>
            ) : null}
          </span>
        ) : null}
      </span>
      <RoleDot color={roleColor} />
    </label>
  );
}
