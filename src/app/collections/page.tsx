import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, Empty } from "@/components/ui";
import type { Collection } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("collections")
    .select("*, collection_items(count)")
    .order("sort_order");

  if (error) {
    return (
      <AppShell active="collections" title="컬렉션">
        <Card className="p-5">
          <p className="text-[14.5px] text-danger">컬렉션을 불러오지 못했습니다.</p>
        </Card>
      </AppShell>
    );
  }

  const rows = (data ?? []) as (Collection & {
    collection_items: { count: number }[];
  })[];

  return (
    <AppShell active="collections" title="컬렉션" subtitle="흩어진 자료를 모아두는 곳">
      {rows.length === 0 ? (
        <Card>
          <Empty>아직 컬렉션이 없습니다.</Empty>
        </Card>
      ) : (
        <Card className="divide-y divide-line-soft">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.slug}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2"
            >
              <span aria-hidden className="text-[19px]">{c.icon ?? "📦"}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{c.name}</span>
                {c.description ? (
                  <span className="mt-0.5 block text-[12.5px] text-faint">{c.description}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-[12.5px] tnum text-faint">
                {c.collection_items?.[0]?.count ?? 0}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </AppShell>
  );
}
