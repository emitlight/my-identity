import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { VisitLogForm } from "@/components/VisitLogForm";
import { Card, SectionLabel } from "@/components/ui";
import { monthDay } from "@/lib/date";
import {
  ITEM_STATUS_LABEL,
  type Collection,
  type CollectionItem,
} from "@/lib/types";

export const dynamic = "force-dynamic";

interface VisitLog {
  id: string;
  logged_on: string;
  rating: number | null;
  note: string | null;
  cost: number | null;
}

/**
 * 매거진형 상세 페이지.
 *
 * "잡지처럼 읽고 싶다"는 요구는 여기서 충족된다. 저장은 구조화된
 * 레코드로 하되, 읽는 화면은 글처럼 만든다. 구조로 저장하면 매거진도
 * 되지만, 글로 저장하면 글밖에 안 된다.
 */
export default async function ItemPage({
  params,
}: {
  params: Promise<{ slug: string; itemId: string }>;
}) {
  const { slug, itemId } = await params;
  const { supabase } = await requireUser();

  const [{ data: collection }, { data: item }, { data: logs }] = await Promise.all([
    supabase.from("collections").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("collection_items").select("*").eq("id", itemId).maybeSingle(),
    supabase
      .from("collection_item_logs")
      .select("id, logged_on, rating, note, cost")
      .eq("item_id", itemId)
      .order("logged_on", { ascending: false }),
  ]);

  if (!collection || !item) notFound();
  const c = collection as Collection;
  const it = item as CollectionItem;
  const fields = c.schema?.fields ?? [];
  const visits = (logs ?? []) as VisitLog[];

  const specs = fields
    .map((f) => {
      const v = it.data?.[f.key];
      if (v === undefined || v === null || v === "") return null;
      const text =
        f.type === "bool" ? (v ? "예" : "아니오")
        : f.type === "number" ? Number(v).toLocaleString("ko-KR")
        : String(v);
      return { label: f.label, text };
    })
    .filter(Boolean) as { label: string; text: string }[];

  return (
    <AppShell active="collections" title={c.name} subtitle={c.description ?? undefined}>
      <div className="flex flex-col gap-5">
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

          <div className="p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-accent">
              {[it.region, ITEM_STATUS_LABEL[it.status]].filter(Boolean).join(" · ")}
            </p>
            <h1 className="mt-2 text-[25px] font-semibold leading-tight tracking-tight">
              {it.title}
            </h1>
            {it.subtitle ? (
              <p className="mt-1 text-[14px] text-muted">{it.subtitle}</p>
            ) : null}
            {it.rating != null ? (
              <p className="mt-2 text-[13.5px] tnum text-muted">★ {it.rating} · 방문 {visits.length}회</p>
            ) : null}
            {it.summary ? (
              <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{it.summary}</p>
            ) : null}

            {it.body ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-line-soft pt-4">
                {it.body.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className="whitespace-pre-wrap text-[15px] leading-[1.75]">
                    {para}
                  </p>
                ))}
              </div>
            ) : null}

            {it.url ? (
              <a
                href={it.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-block text-[13px] text-accent underline underline-offset-2"
              >
                원본 링크 열기
              </a>
            ) : null}
          </div>
        </Card>

        {specs.length ? (
          <section className="flex flex-col gap-2">
            <SectionLabel>정보</SectionLabel>
            <Card className="divide-y divide-line-soft">
              {specs.map((s) => (
                <div key={s.label} className="flex items-baseline gap-4 px-4 py-2.5">
                  <span className="w-[84px] shrink-0 text-[12.5px] text-faint">{s.label}</span>
                  <span className="min-w-0 flex-1 text-[14px] tnum">{s.text}</span>
                </div>
              ))}
            </Card>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <SectionLabel right={visits.length ? `${visits.length}회` : undefined}>
            다녀온 기록
          </SectionLabel>
          <VisitLogForm itemId={it.id} slug={slug} />
          {visits.length ? (
            <Card className="divide-y divide-line-soft">
              {visits.map((v) => (
                <div key={v.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12.5px] tnum text-faint">{monthDay(v.logged_on)}</span>
                    {v.rating != null ? (
                      <span className="text-[12.5px] tnum text-muted">★ {v.rating}</span>
                    ) : null}
                  </div>
                  {v.note ? (
                    <p className="mt-1 text-[14px] leading-relaxed">{v.note}</p>
                  ) : null}
                </div>
              ))}
            </Card>
          ) : null}
        </section>

        <SectionLabel>
          <Link href={`/collections/${slug}`} className="hover:text-muted">
            ← {c.name}
          </Link>
        </SectionLabel>
      </div>
    </AppShell>
  );
}
