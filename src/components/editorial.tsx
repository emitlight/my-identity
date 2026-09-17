import Link from "next/link";

/* ============================================================
   매거진 판형의 조판 부품.
   색과 서체는 globals.css 의 토큰이 정하고, 여기서는 구조만 잡는다.
   ============================================================ */

/** 러버릭 — 기사 위에 붙는 작은 대문자 라벨 */
export function Kicker({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "signal" | "quiet" | "onDark";
}) {
  const color =
    tone === "signal" ? "text-signal"
    : tone === "quiet" ? "text-faint"
    : tone === "onDark" ? "text-[var(--on-dark-dim)]"
    : "text-accent";
  return <span className={`kicker ${color}`}>{children}</span>;
}

/** 섹션 머리 — 표제 + 가는 선 + 오른쪽 부기 */
export function SectionRule({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-4">
      <h2 className="display text-[22px] leading-tight lg:text-[27px]">{children}</h2>
      <span aria-hidden className="h-px flex-1 bg-line" />
      {right ? <span className="kicker text-faint">{right}</span> : null}
    </div>
  );
}

/**
 * 사진 자리.
 *
 * 실제 사진이 없거나 불러오지 못했을 때 비어 보이지 않게, 제목에서
 * 만든 색으로 채운다. 깨진 이미지 아이콘이 뜨는 것보다 낫고,
 * 사진을 넣기 전까지도 지면이 성립한다.
 */
export function Cover({
  src,
  seed,
  ratio = "4/5",
  className = "",
  children,
}: {
  src?: string | null;
  seed: string;
  ratio?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio: ratio,
        background: `
          radial-gradient(120% 90% at 70% 25%, hsl(${h} 42% 62%) 0%, transparent 58%),
          radial-gradient(90% 70% at 12% 88%, hsl(${(h + 28) % 360} 38% 38%) 0%, transparent 62%),
          linear-gradient(200deg, hsl(${h} 30% 18%) 12%, hsl(${(h + 18) % 360} 34% 34%) 62%, hsl(${h} 30% 16%) 100%)
        `,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          className="zoom absolute inset-0 size-full object-cover"
        />
      ) : null}
      {children}
    </div>
  );
}

/** 표지 기사 — 오늘의 맥락이 차지하는 자리 */
export function CoverStory({
  kicker,
  headline,
  standfirst,
  chips,
  number,
  numberLabel,
  href,
  image,
  seed,
}: {
  kicker: string;
  headline: string;
  standfirst?: string;
  chips?: string[];
  number?: string;
  numberLabel?: string;
  href: string;
  image?: string | null;
  seed: string;
}) {
  return (
    <Link href={href} className="tile group block">
      <Cover src={image} seed={seed} ratio="16/11" className="lg:!aspect-[21/9]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,8,8,.28)_0%,rgba(10,8,8,.18)_34%,rgba(10,8,8,.93)_100%)] lg:bg-[linear-gradient(90deg,rgba(10,8,8,.92)_0%,rgba(10,8,8,.58)_48%,rgba(10,8,8,.10)_100%)]" />

        {number ? (
          <div className="absolute right-5 top-5 text-right lg:right-10 lg:top-10">
            <div className="display text-[52px] leading-[.9] text-[var(--on-dark)] lg:text-[76px]">
              {number}
            </div>
            {numberLabel ? (
              <div className="kicker mt-1 text-[var(--on-dark-dim)]">{numberLabel}</div>
            ) : null}
          </div>
        ) : null}

        <div className="absolute inset-x-5 bottom-6 lg:inset-y-10 lg:left-12 lg:right-auto lg:flex lg:w-[min(560px,52%)] lg:flex-col lg:justify-end">
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-px w-6 bg-[var(--on-dark-dim)]" />
            <Kicker tone="onDark">{kicker}</Kicker>
          </div>
          <h2 className="display mt-3 text-[42px] leading-[1.04] text-[var(--on-dark)] lg:mt-4 lg:text-[62px]">
            {headline}
          </h2>
          {standfirst ? (
            <p className="mt-3 max-w-[42ch] text-[14.5px] leading-relaxed text-[var(--on-dark-dim)] lg:mt-4 lg:text-[16px]">
              {standfirst}
            </p>
          ) : null}
          {chips?.length ? (
            <div className="mt-4 flex flex-wrap gap-2 lg:mt-6">
              {chips.map((c) => (
                <span
                  key={c}
                  className="serif rounded-full border border-[var(--on-dark-line)] px-3.5 py-1.5 text-[13px] text-[var(--on-dark)] lg:text-[14px]"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Cover>
    </Link>
  );
}

/** 본지 기사 카드 */
export function FeedCard({
  rubric,
  headline,
  standfirst,
  meta,
  dot,
  href,
  image,
  seed,
  ratio = "4/5",
}: {
  rubric: string;
  headline: string;
  standfirst?: string;
  meta?: string;
  dot?: string | null;
  href: string;
  image?: string | null;
  seed: string;
  ratio?: string;
}) {
  return (
    <Link href={href} className="tile group block">
      <Cover src={image} seed={seed} ratio={ratio}>
        <span className="kicker absolute left-0 top-4 bg-paper px-3 py-1.5 pl-3.5 text-ink">
          {rubric}
        </span>
      </Cover>
      <h3 className="display mt-4 text-[20px] leading-[1.22] lg:text-[23px]">{headline}</h3>
      {standfirst ? (
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{standfirst}</p>
      ) : null}
      {meta ? (
        <div className="mt-3 flex items-center gap-2.5">
          {dot ? (
            <span
              aria-hidden
              className="size-[5px] shrink-0 rounded-full"
              style={{ background: dot }}
            />
          ) : null}
          <span className="num text-[11.5px] tracking-[.06em] text-faint">{meta}</span>
        </div>
      ) : null}
    </Link>
  );
}

/** 마감 밴드 — 숫자가 주인공인 얇은 띠 */
export function DeadlineBand({
  items,
}: {
  items: { num: string; unit: string; title: string; urgent?: boolean }[];
}) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-1 border-y border-line sm:grid-cols-2 lg:grid-cols-3">
      {items.map((d, i) => (
        <div
          key={i}
          className="flex items-baseline gap-3.5 border-b border-line-soft py-4 pr-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
        >
          <span
            className={
              "display text-[26px] leading-none lg:text-[30px] " +
              (d.urgent ? "text-signal" : "text-ink")
            }
          >
            {d.num}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="kicker text-faint">{d.unit}</span>
            <span className="text-[14px] leading-snug">{d.title}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
