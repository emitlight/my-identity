"use client";

import { useOptimistic, useTransition } from "react";
import { scheduleToday, toggleTask } from "@/lib/actions/tasks";
import { RoleDot } from "@/components/ui";
import type { Task } from "@/lib/types";

/** 체크 표시는 배경 이미지로 그린다 — 상자 하나로 끝나서 어긋날 데가 없다 */
export const CHECK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 15 11'%3E%3Cpath d='M1 5.4L5.2 9.6 14 1' fill='none' stroke='%23141010' stroke-width='2.6'/%3E%3C/svg%3E\")";

export function boxStyle(done: boolean): React.CSSProperties | undefined {
  return done
    ? {
        backgroundColor: "var(--key)",
        borderColor: "var(--key)",
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
    <label className="group flex cursor-pointer items-center gap-4 border-b border-line px-2 py-3 transition-colors hover:bg-key-soft">
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
        <span className="kicker-kr shrink-0 -rotate-2 bg-key px-2 py-1 text-[10px] text-[color:var(--on-accent)]">
          마감 지남
        </span>
      ) : null}
      <RoleDot color={roleColor} />
    </label>
  );
}

/**
 * 인박스 한 줄을 오늘로 끌어오는 버튼.
 *
 * 노션에서 17개가 "시작 안 함"으로 3개월을 버틴 이유는 목록이 없어서가
 * 아니라 거기서 오늘로 꺼내오는 동작이 없어서였다. 그 동작을 지면의
 * 제일 빈 칸 — 오늘 할 일이 0개인 자리 — 에 둔다.
 *
 * 서버 액션이 revalidate 하므로 이 줄은 저절로 사라진다.
 * 따로 들고 있을 상태가 없다.
 */
export function InboxPullRow({ task }: { task: Task }) {
  const [busy, start] = useTransition();

  return (
    <div
      className={
        "flex items-center gap-3 border-b border-line py-2.5 transition-opacity " +
        (busy ? "opacity-40" : "")
      }
    >
      <span className="krb min-w-0 flex-1 truncate text-[clamp(14px,3.6vw,17px)]">
        {task.title}
      </span>
      <button
        type="button"
        disabled={busy}
        aria-label={`${task.title} 오늘 할 일로 가져오기`}
        onClick={() => {
          start(async () => {
            await scheduleToday({ id: task.id });
          });
        }}
        className="krb shrink-0 border-2 border-ink px-3 py-1 text-[11.5px] tracking-[.08em] transition-colors hover:bg-ink hover:text-key-on-dark disabled:opacity-40"
      >
        {busy ? "…" : "오늘로"}
      </button>
    </div>
  );
}
