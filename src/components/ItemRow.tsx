"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setVisited } from "@/lib/actions/collections";
import type { CollectionItem, SchemaField } from "@/lib/types";

/**
 * 목록 한 줄. 가장 중요한 동작은 "가봤다" 체크다.
 * 다녀온 뒤 한 탭으로 끝나야 기록이 쌓이고, 기록이 쌓여야 추천이 좋아진다.
 */
export function ItemRow({
  item,
  slug,
  fields,
}: {
  item: CollectionItem;
  slug: string;
  fields: SchemaField[];
}) {
  const [visited, setV] = useOptimistic(item.status === "visited");
  const [, start] = useTransition();

  // 요약줄에 쓸 값 두어 개만 고른다. 전부 보여주면 목록이 아니라 표가 된다.
  const chips = fields
    .filter((f) => f.filterable)
    .map((f) => {
      const v = item.data?.[f.key];
      if (v === undefined || v === null || v === "" || v === false) return null;
      return v === true ? f.label : String(v);
    })
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <input
        type="checkbox"
        checked={visited}
        aria-label={`${item.title} 가봤음`}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            setV(next);
            await setVisited({ id: item.id, slug, visited: next });
          });
        }}
        className="mt-[3px] size-[17px] shrink-0 cursor-pointer accent-[var(--accent)]"
      />

      <Link href={`/collections/${slug}/${item.id}`} className="min-w-0 flex-1">
        <span
          className={
            "block text-[14.5px] leading-snug " + (visited ? "text-muted" : "text-ink")
          }
        >
          {item.title}
        </span>
        {chips.length || item.region ? (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-faint">
            {item.region ? <span>{item.region}</span> : null}
            {chips.map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </span>
        ) : null}
      </Link>

      {item.rating != null ? (
        <span className="shrink-0 text-[12px] tnum text-muted">★ {item.rating}</span>
      ) : null}
    </div>
  );
}
