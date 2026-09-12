"use client";

import { useState, useTransition } from "react";
import { addItem } from "@/lib/actions/collections";

/** 컬렉션도 3초 안에 넣을 수 있어야 한다. 이름만 있으면 저장된다. */
export function ItemQuickAdd({
  collectionId,
  slug,
  placeholder,
  withRegion,
}: {
  collectionId: string;
  slug: string;
  placeholder: string;
  withRegion?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [region, setRegion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = title.trim();
        if (!t || pending) return;
        start(async () => {
          const res = await addItem({ collectionId, slug, title: t, region: region.trim() });
          if (res.ok) {
            setTitle("");
            setError(null);
          } else {
            setError(res.error);
          }
        });
      }}
      className="rounded-lg border border-line bg-surface p-3"
    >
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          aria-label="이름"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
        {withRegion ? (
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="지역"
            aria-label="지역"
            className="w-[70px] shrink-0 bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
        ) : null}
        <button
          type="submit"
          disabled={!title.trim() || pending}
          className="shrink-0 rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-on-accent disabled:opacity-35"
        >
          {pending ? "…" : "추가"}
        </button>
      </div>
      {withRegion ? (
        <p className="mt-2 px-0.5 text-[12px] text-faint">
          지역을 넣어두면 그 지역 일정이 있는 날 알아서 올라옵니다
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 px-0.5 text-[12.5px] text-danger">{error}</p>
      ) : null}
    </form>
  );
}
