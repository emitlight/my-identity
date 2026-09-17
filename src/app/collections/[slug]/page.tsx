import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ItemRow } from "@/components/ItemRow";
import { ItemQuickAdd } from "@/components/ItemQuickAdd";
import { Card, SectionLabel, Empty } from "@/components/ui";
import { progressLine, statusLabel, words } from "@/lib/collections";
import {
  type Collection,
  type CollectionItem,
  type CollectionView,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const VIEWS: { key: CollectionView; label: string }[] = [
  { key: "list", label: "목록" },
  { key: "card", label: "카드" },
  { key: "magazine", label: "매거진" },
];

type Params = Promise<{ slug: string }>;
type Search = Promise<Record<string, string | undefined>>;

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase } = await requireUser();

  const { data: collection } = await supabase
    .from("collections")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!collection) notFound();
  const c = collection as Collection;
  const fields = c.schema?.fields ?? [];

  // 지도는 실제 데이터를 넣어보고 국내 정확도를 확인한 뒤 붙인다.
  // 추상적으로 고르면 틀린다 (docs/DECISIONS.md §7).
  const view: CollectionView =
    (VIEWS.find((v) => v.key === sp.view)?.key ??
      (c.default_view === "map" ? "list" : c.default_view)) as CollectionView;

  let query = supabase
    .from("collection_items")
    .select("*")
    .eq("collection_id", c.id)
    .order("status")
    .order("created_at", { ascending: false });

  if (sp.region) query = query.eq("region", sp.region);
  if (sp.status) query = query.eq("status", sp.status);

  const { data } = await query;
  let items = (data ?? []) as CollectionItem[];

  // 스키마 필드 필터는 여기서 건다. 개인 규모에서는 이게 가장 단순하고
  // PostgREST 의 jsonb 질의 문법을 외울 필요가 없다.
  for (const f of fields.filter((f) => f.filterable)) {
    const want = sp[f.key];
    if (!want) continue;
    items = items.filter((it) => {
      const v = it.data?.[f.key];
      return f.type === "bool" ? Boolean(v) === (want === "1") : String(v ?? "") === want;
    });
  }

  const regions = [...new Set(items.map((i) => i.region).filter(Boolean))] as string[];
  const notVisited = items.filter((i) => i.status === "wishlist").length;
  const qs = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) next.set(k, v);
    const s = next.toString();
    return `/collections/${slug}${s ? `?${s}` : ""}`;
  };

  return (
    <AppShell
      active="collections"
      title={c.name}
      subtitle={progressLine(items.length, notVisited, c.kind)}
    >
      <div className="flex flex-col gap-5">
        <ItemQuickAdd
          collectionId={c.id}
          slug={slug}
          placeholder={c.kind === "place" ? "이름" : "제목"}
          withRegion={c.kind === "place"}
        />

        {/* 보기 전환 — 매거진은 저장 형식이 아니라 보기 형식이다 */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-0.5">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={qs({ view: v.key })}
              aria-current={view === v.key ? "true" : undefined}
              className={
                "shrink-0 rounded px-2.5 py-1 text-[12.5px] " +
                (view === v.key ? "bg-ink text-paper" : "text-faint hover:text-muted")
              }
            >
              {v.label}
            </Link>
          ))}

          <span className="mx-1 h-3.5 w-px shrink-0 bg-line" />

          <Link
            href={qs({ status: sp.status === "wishlist" ? undefined : "wishlist" })}
            className={
              "shrink-0 rounded px-2.5 py-1 text-[12.5px] " +
              (sp.status === "wishlist"
                ? "bg-signal-soft text-signal"
                : "text-faint hover:text-muted")
            }
          >
            {words(c.kind).pending}만
          </Link>

          {regions.slice(0, 6).map((r) => (
            <Link
              key={r}
              href={qs({ region: sp.region === r ? undefined : r })}
              className={
                "shrink-0 rounded px-2.5 py-1 text-[12.5px] " +
                (sp.region === r ? "bg-accent-soft text-accent" : "text-faint hover:text-muted")
              }
            >
              {r}
            </Link>
          ))}
        </div>

        {items.length === 0 ? (
          <Card>
            <Empty>
              {Object.keys(sp).length
                ? "조건에 맞는 항목이 없습니다."
                : "아직 비어 있습니다. 위에 이름만 적어도 저장됩니다."}
            </Empty>
          </Card>
        ) : view === "list" ? (
          <Card className="divide-y divide-line-soft">
            {items.map((it) => (
              <ItemRow key={it.id} item={it} slug={slug} fields={fields} />
            ))}
          </Card>
        ) : view === "card" ? (
          <div className="grid grid-cols-2 gap-3">
            {items.map((it) => (
              <Link key={it.id} href={`/collections/${slug}/${it.id}`}>
                <Card className="h-full overflow-hidden">
                  <div className="aspect-[4/3] w-full bg-surface-2">
                    {it.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.cover_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-[11px] text-faint">
                        사진 없음
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[14px] font-medium leading-snug">{it.title}</p>
                    <p className="mt-1 text-[11.5px] text-faint">
                      {[it.region, statusLabel(it.status, c.kind)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {items.map((it) => (
              <Link key={it.id} href={`/collections/${slug}/${it.id}`}>
                <Card className="overflow-hidden">
                  <div className="aspect-[16/9] w-full bg-surface-2">
                    {it.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.cover_url} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-[11px] text-faint">
                        사진 없음
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-accent">
                      {it.region ?? c.name}
                    </p>
                    <h2 className="mt-1.5 text-[19px] font-semibold leading-snug tracking-tight">
                      {it.title}
                    </h2>
                    {it.summary ? (
                      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                        {it.summary}
                      </p>
                    ) : null}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <SectionLabel>
          <Link href="/collections" className="hover:text-muted">← 모든 컬렉션</Link>
        </SectionLabel>
      </div>
    </AppShell>
  );
}
