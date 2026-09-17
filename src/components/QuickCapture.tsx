"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { capture } from "@/lib/actions/capture";
import { parseEventInput } from "@/lib/parse-event";
import { Chip } from "@/components/ui";
import { TZ } from "@/lib/date";

type Force = "auto" | "event" | "task";

const FORCE_LABEL: Record<Force, string> = {
  auto: "자동",
  event: "일정",
  task: "할 일",
};

/**
 * 어떤 화면에서든 한 탭 거리에 있는 입력창.
 *
 * 제목만 있어도 저장된다. 분류를 요구하는 순간 입력을 안 하게 되고,
 * 입력이 없으면 나머지 기능이 전부 무의미해진다.
 *
 * 판형에 맞춰 둥근 카드를 걷어내고 괘선으로만 묶었다. 대신 입력 줄
 * 자체를 크게 키웠다 — 이 지면에서 유일하게 글자를 받는 자리다.
 */
export function QuickCapture() {
  const [text, setText] = useState("");
  const [force, setForce] = useState<Force>("auto");
  const [flash, setFlash] = useState<{ tone: "ok" | "bad"; msg: string } | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // 서버와 같은 파서로 미리 보여준다. 저장은 서버가 다시 파싱한 결과로 한다.
  const preview = useMemo(() => {
    const t = text.trim();
    if (!t) return null;
    return parseEventInput(t, new Date(), TZ);
  }, [text]);

  const willBe: "event" | "task" =
    force === "event" ? "event"
    : force === "task" ? "task"
    : preview && !preview.needsForm ? "event"
    : "task";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || pending) return;

    start(async () => {
      const res = await capture({ text: t, force });
      if (res.ok) {
        setText("");
        setFlash({
          tone: "ok",
          msg: res.kind === "event" ? "일정에 넣었습니다" : "할 일에 넣었습니다",
        });
        inputRef.current?.focus();
      } else {
        setFlash({ tone: "bad", msg: res.error });
      }
      setTimeout(() => setFlash(null), 2600);
    });
  }

  return (
    <form onSubmit={submit} className="border-2 border-ink">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 sm:px-4">
        <span className="kicker text-hot-deep">Capture</span>
        <span className="kicker-kr text-[10px] tracking-[.18em] text-faint">한 줄이면 됩니다</span>
      </div>

      <div className="flex items-stretch">
        <input
          ref={inputRef}
          id="quick-capture"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="내일 오후 3시 강남 미팅 2시간"
          autoComplete="off"
          enterKeyHint="done"
          aria-label="빠른 입력"
          className="krb min-w-0 flex-1 bg-transparent px-3 py-3.5 text-[clamp(15px,4vw,19px)] outline-none placeholder:font-normal placeholder:text-faint sm:px-4"
        />
        <button
          type="submit"
          disabled={!text.trim() || pending}
          className="krb shrink-0 bg-ink px-5 text-[13px] tracking-[.1em] text-hot transition-colors hover:bg-hot hover:text-[color:var(--on-accent)] disabled:bg-line-soft disabled:text-faint sm:px-7"
        >
          {pending ? "…" : "저장"}
        </button>
      </div>

      {preview ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2.5 sm:px-4">
          {preview.tokens.map((t, i) => (
            <Chip key={i} tone={t.type === "region" ? "signal" : "accent"}>
              {t.label}
            </Chip>
          ))}
          {preview.tokens.length === 0 ? (
            <Chip tone="quiet">날짜를 못 읽었습니다 · 할 일로 저장됩니다</Chip>
          ) : null}

          <span className="ml-auto flex items-center gap-1">
            {(["auto", "event", "task"] as Force[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setForce(f)}
                aria-pressed={force === f}
                className={
                  "krb px-2 py-[3px] text-[11.5px] transition-colors " +
                  (force === f
                    ? "bg-ink text-[color:var(--on-dark)]"
                    : "text-faint hover:text-ink")
                }
              >
                {FORCE_LABEL[f]}
              </button>
            ))}
          </span>
        </div>
      ) : null}

      {preview && force === "auto" ? (
        <p className="px-3 pb-2.5 text-[12px] text-faint sm:px-4">
          {willBe === "event"
            ? `일정으로 저장됩니다 — ${preview.title}`
            : `할 일로 저장됩니다 — ${preview.title}`}
        </p>
      ) : null}

      {flash ? (
        <p
          role="status"
          className={
            "krb px-3 pb-2.5 text-[12.5px] sm:px-4 " +
            (flash.tone === "ok" ? "text-hot-deep" : "text-danger")
          }
        >
          {flash.msg}
        </p>
      ) : null}
    </form>
  );
}
