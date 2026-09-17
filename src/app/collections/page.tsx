import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Empty } from "@/components/ui";
import type { Collection } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 컬렉션 성격에 따라 세는 말이 다르다. 책을 "1곳" 이라고 세면 걸린다. */
const UNIT: Record<string, string> = {
  place: "곳",
  media: "개",
  product: "개",
  person: "명",
  generic: "개",
};

export default async function CollectionsPage() {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("collections")
    .select("*, collection_items(count)")
    .order("sort_order");

  if (error) {
    return (
      <AppShell active="collections" title="컬렉션">
        <p className="krb py-10 text-[15px] text-danger">컬렉션을 불러오지 못했습니다.</p>
      </AppShell>
    );
  }

  const rows = (data ?? []) as (Collection & {
    collection_items: { count: number }[];
  })[];
  const total = rows.reduce((n, c) => n + (c.collection_items?.[0]?.count ?? 0), 0);

  return (
    <AppShell active="collections" title="컬렉션" subtitle="흩어진 자료를 모아두는 곳">
      {/* 목차 머리 */}
      <div className="flex items-end justify-between gap-4 border-b-[4px] border-ink pb-2 pt-4 lg:pt-6">
        <span className="flex flex-col gap-2">
          <span className="kicker text-hot-deep">The Collections</span>
          <span className="krd text-[34px] leading-none lg:text-[52px]">컬렉션</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="num text-[38px] leading-none text-hot lg:text-[56px]">{total}</span>
          <span className="kicker-kr pb-1 text-muted">모아둠</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty>아직 컬렉션이 없습니다.</Empty>
      ) : (
        <ul>
          {rows.map((c, i) => {
            const n = c.collection_items?.[0]?.count ?? 0;
            const unit = UNIT[c.kind] ?? "개";
            return (
              <li key={c.id}>
                <Link
                  href={`/collections/${c.slug}`}
                  className="group flex items-center gap-4 border-b-2 border-ink/80 py-4 transition-colors hover:bg-blush lg:gap-8 lg:py-6"
                >
                  <span className="num w-9 shrink-0 text-[20px] leading-none text-hot-deep lg:w-14 lg:text-[28px]">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="krd block text-[26px] leading-[1.06] lg:text-[46px]">
                      {c.name}
                    </span>
                    {c.description ? (
                      <span className="mt-1.5 block text-[12.5px] text-muted lg:text-[14px]">
                        {c.description}
                      </span>
                    ) : null}
                  </span>

                  <span className="shrink-0 text-right">
                    {n > 0 ? (
                      <>
                        <span className="num block text-[28px] leading-none lg:text-[44px]">
                          {n}
                        </span>
                        <span className="kicker-kr text-faint">{unit}</span>
                      </>
                    ) : (
                      <span className="kicker text-faint">Empty</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
