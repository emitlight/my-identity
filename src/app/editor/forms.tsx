"use client";

import { useState, useTransition } from "react";
import { answerNote, requestTopic, tuneTopic, addTopic } from "@/lib/actions/editor";

/* ── 편집자의 질문에 답하기 ──────────────────────────────────── */

export function AnswerForm({ id, body, at }: { id: string; body: string; at: string }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || pending) return;
    start(async () => {
      const form = new FormData();
      form.set("id", id);
      form.set("answer", text.trim());
      const res = await answerNote(form);
      if (res?.error) setErr(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="border-2 border-ink">
      <div className="flex items-baseline gap-3 border-b border-line bg-key-soft px-4 py-3">
        <span className="kicker shrink-0 text-key-ink">Q</span>
        <p className="min-w-0 flex-1 text-[14.5px] leading-relaxed">{body}</p>
        {/* 색면(key-soft) 위에서는 faint 가 4.5:1 에 못 미친다. 한 단계 올린다. */}
        <span className="kicker shrink-0 text-muted">{at}</span>
      </div>
      <label htmlFor={`a-${id}`} className="sr-only">
        답
      </label>
      <textarea
        id={`a-${id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="아는 만큼만 적어도 됩니다. 다음 호부터 반영됩니다."
        className="w-full resize-y bg-transparent px-4 py-3 text-[14.5px] leading-relaxed outline-none placeholder:text-faint"
      />
      <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2">
        <span className="text-[12px] text-faint">{err ?? "답한 내용은 계속 참고됩니다"}</span>
        <button
          type="submit"
          disabled={!text.trim() || pending}
          className="krb shrink-0 bg-ink px-4 py-1.5 text-[12.5px] tracking-[.06em] text-key-on-dark disabled:bg-transparent disabled:text-faint"
        >
          {pending ? "…" : "답하기"}
        </button>
      </div>
    </form>
  );
}

/* ── 다음 호 주문 ───────────────────────────────────────────── */

export function RequestForm({ topics }: { topics: { id: string; title: string }[] }) {
  const [text, setText] = useState("");
  const [topic, setTopic] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || pending) return;
    start(async () => {
      const form = new FormData();
      form.set("body", text.trim());
      if (topic) form.set("topic_id", topic);
      const res = await requestTopic(form);
      if (res?.error) setErr(res.error);
      else {
        setText("");
        setTopic("");
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      }
    });
  }

  return (
    <form onSubmit={submit} className="border-2 border-ink">
      <label htmlFor="req" className="sr-only">
        다음 호에 시킬 것
      </label>
      <textarea
        id="req"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="예) 마당 텃밭 첫해에 뭘 심어야 하는지 월별로 알려줘"
        className="w-full resize-y bg-transparent px-4 py-3.5 text-[15px] leading-relaxed outline-none placeholder:text-faint"
      />
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-2">
        <label htmlFor="req-topic" className="kicker shrink-0 text-faint">
          주제
        </label>
        <select
          id="req-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="krb min-w-0 flex-1 bg-transparent py-1 text-[13px] outline-none"
        >
          <option value="">자동으로 고르기</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        {done ? <span className="text-[12px] text-ok">넣었습니다</span> : null}
        {err ? <span className="text-[12px] text-danger">{err}</span> : null}
        <button
          type="submit"
          disabled={!text.trim() || pending}
          className="krb shrink-0 bg-ink px-4 py-1.5 text-[12.5px] tracking-[.06em] text-key-on-dark disabled:bg-transparent disabled:text-faint"
        >
          {pending ? "…" : "주문"}
        </button>
      </div>
    </form>
  );
}

/* ── 주제 한 줄 ─────────────────────────────────────────────── */

export function TopicRow({
  id,
  emoji,
  title,
  angle,
  weight,
  active,
  count,
  last,
}: {
  id: string;
  emoji: string | null;
  title: string;
  angle: string | null;
  weight: number;
  active: boolean;
  count: number;
  last: string | null;
}) {
  const [pending, start] = useTransition();

  function set(patch: { weight?: number; active?: boolean }) {
    start(async () => {
      const form = new FormData();
      form.set("id", id);
      if (patch.weight !== undefined) form.set("weight", String(patch.weight));
      if (patch.active !== undefined) form.set("active", patch.active ? "on" : "off");
      await tuneTopic(form);
    });
  }

  return (
    <li
      className={
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 transition-opacity " +
        (active ? "" : "opacity-45")
      }
    >
      <span aria-hidden className="w-[20px] shrink-0 text-[15px]">
        {emoji ?? "·"}
      </span>
      <span className="min-w-0 flex-1 basis-[180px]">
        <span className="block text-[14.5px] font-medium">{title}</span>
        {angle ? <span className="block text-[12px] leading-snug text-faint">{angle}</span> : null}
      </span>

      <span className="kicker shrink-0 tnum text-faint">
        {count ? `${count}회` : "아직"}
        {last ? ` · ${last.slice(5)}` : ""}
      </span>

      <span className="flex shrink-0 items-center gap-0.5" role="group" aria-label={`${title} 무게`}>
        {[1, 2, 3, 4, 5].map((w) => (
          <button
            key={w}
            type="button"
            disabled={pending}
            onClick={() => set({ weight: w })}
            aria-label={`무게 ${w}`}
            aria-pressed={weight === w}
            className={
              "h-[22px] w-[18px] text-[11px] tnum transition-colors " +
              (w <= weight ? "bg-key text-[color:var(--on-accent)]" : "text-faint hover:bg-line-soft")
            }
          >
            {w === weight ? w : ""}
          </button>
        ))}
      </span>

      <button
        type="button"
        disabled={pending}
        onClick={() => set({ active: !active })}
        className="krb shrink-0 border border-line px-2.5 py-1 text-[11.5px] transition-colors hover:border-ink"
      >
        {active ? "끄기" : "켜기"}
      </button>
    </li>
  );
}

/* ── 주제 추가 ──────────────────────────────────────────────── */

const AREAS = [
  ["future", "앞으로"],
  ["lifelog", "일상"],
  ["career", "커리어"],
  ["finance", "자산"],
  ["language", "언어"],
  ["workout", "운동"],
] as const;

export function AddTopicForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [angle, setAngle] = useState("");
  const [area, setArea] = useState<string>("future");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="krb self-start border-2 border-dashed border-line px-4 py-2 text-[13px] text-muted transition-colors hover:border-ink hover:text-ink"
      >
        + 주제 추가
      </button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || pending) return;
    start(async () => {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("angle", angle.trim());
      form.set("area", area);
      const res = await addTopic(form);
      if (res?.error) setErr(res.error);
      else {
        setTitle("");
        setAngle("");
        setErr(null);
        setOpen(false);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-2 border-ink p-4">
      <label htmlFor="nt-title" className="kicker text-key-ink">
        새 주제
      </label>
      <input
        id="nt-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="주제 이름"
        className="krb border-b border-line bg-transparent py-1.5 text-[16px] outline-none placeholder:font-normal placeholder:text-faint"
      />
      <label htmlFor="nt-angle" className="sr-only">
        각도
      </label>
      <input
        id="nt-angle"
        value={angle}
        onChange={(e) => setAngle(e.target.value)}
        placeholder="어떤 각도로 쓸지 (선택)"
        className="border-b border-line bg-transparent py-1.5 text-[13.5px] outline-none placeholder:text-faint"
      />
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <label htmlFor="nt-area" className="kicker shrink-0 text-faint">
          칸
        </label>
        <select
          id="nt-area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="krb bg-transparent py-1 text-[13px] outline-none"
        >
          {AREAS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        {err ? <span className="text-[12px] text-danger">{err}</span> : null}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="krb px-3 py-1.5 text-[12.5px] text-faint hover:text-ink"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!title.trim() || pending}
          className="krb bg-ink px-4 py-1.5 text-[12.5px] tracking-[.06em] text-key-on-dark disabled:bg-transparent disabled:text-faint"
        >
          {pending ? "…" : "추가"}
        </button>
      </div>
    </form>
  );
}
