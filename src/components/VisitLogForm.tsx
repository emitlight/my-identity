"use client";

import { useState, useTransition } from "react";
import { logVisit } from "@/lib/actions/collections";

/**
 * 한 줄 평 + 별점.
 *
 * 다녀온 직후 30초 안에 안 남기면 영영 안 남긴다. 그래서 별점은
 * 탭 한 번, 메모는 선택으로 둔다. 둘 다 비어도 방문 기록은 남는다.
 */
export function VisitLogForm({ itemId, slug }: { itemId: string; slug: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p className="px-1 text-[13px] text-accent">기록했습니다.</p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        start(async () => {
          const res = await logVisit({ id: itemId, slug, rating, note: note.trim() });
          if (res.ok) setDone(true);
          else setError(res.error);
        });
      }}
      className="rounded-lg border border-line bg-surface p-3"
    >
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n}점`}
            aria-pressed={rating === n}
            onClick={() => setRating(rating === n ? null : n)}
            className={
              "px-1.5 text-[19px] leading-none transition-colors " +
              (rating != null && n <= rating ? "text-signal" : "text-line")
            }
          >
            ★
          </button>
        ))}
        <span className="ml-auto text-[12px] text-faint">
          {rating != null ? `${rating}점` : "별점 (선택)"}
        </span>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="한 줄 평 (선택)"
        aria-label="한 줄 평"
        className="mt-2.5 w-full border-t border-line-soft bg-transparent pt-2.5 text-[14.5px] outline-none placeholder:text-faint"
      />

      <button
        type="submit"
        disabled={pending}
        className="krb mt-3 w-full bg-ink py-2 text-[13px] tracking-[.06em] text-key-on-dark disabled:opacity-40"
      >
        {pending ? "기록 중…" : "다녀왔음으로 기록"}
      </button>

      {error ? (
        <p role="alert" className="mt-2 text-[12.5px] text-danger">{error}</p>
      ) : null}
    </form>
  );
}
