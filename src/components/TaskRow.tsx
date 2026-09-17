"use client";

import { useOptimistic, useTransition } from "react";
import { toggleTask } from "@/lib/actions/tasks";
import { RoleDot } from "@/components/ui";
import type { Task } from "@/lib/types";

/** 체크 표시는 배경 이미지로 그린다 — 상자 하나로 끝나서 어긋날 데가 없다 */
export const CHECK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 15 11'%3E%3Cpath d='M1 5.4L5.2 9.6 14 1' fill='none' stroke='%23141010' stroke-width='2.6'/%3E%3C/svg%3E\")";

export function boxStyle(done: boolean): React.CSSProperties | undefined {
  return done
    ? {
        backgroundColor: "var(--hot)",
        borderColor: "var(--hot)",
        backgroundImage: CHECK,
        backgroundSize: "13px",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : undefined;
}

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
    <label className="group flex cursor-pointer items-center gap-4 border-b border-line px-2 py-3 transition-colors hover:bg-blush">
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
        className="size-[22px] shrink-0 cursor-pointer appearance-none border-2 border-ink transition-colors"
        style={boxStyle(done)}
      />

      <span className="min-w-0 flex-1">
        <span
          className={
            "krb block text-[clamp(15px,4vw,19px)] leading-snug " +
            (done ? "text-faint line-through decoration-2" : "text-ink")
          }
        >
          {task.title}
        </span>
        {task.estimate_min && !done ? (
          <span className="mt-0.5 block text-[11.5px] tnum text-faint">
            {task.estimate_min}분
          </span>
        ) : null}
      </span>

      {overdue && !done ? (
        <span className="kicker-kr shrink-0 -rotate-2 bg-hot px-2 py-1 text-[10px] text-[color:var(--on-accent)]">
          마감 지남
        </span>
      ) : null}
      <RoleDot color={roleColor} />
    </label>
  );
}
