import Link from "next/link";

/* ============================================================
   조판 부품 — NEWSSTAND

   이 지면에는 사진이 없다. 오늘 실제로 들어오는 데이터에는
   cover_url 이 전부 null 이고, 앞으로도 한동안 그럴 것이다.
   그래서 "사진 자리"를 비워두거나 회색 상자로 덮지 않는다.
   인쇄소에서 사진이 안 왔을 때 하는 것을 한다 — 색면, 괘선,
   큰 숫자, 윤곽선 활자. 사진은 예외이고, 들어오면 더 좋아진다.

   색과 서체는 globals.css 의 토큰이 정한다. 여기서는 구조만.
   ============================================================ */

type Tone = "hot" | "ink" | "blush" | "paper";

/** 색면 한 장. 판형 전체가 이 네 가지 바탕 위에서만 움직인다. */
const PLATE: Record<Tone, string> = {
  hot: "bg-hot text-[color:var(--on-accent)]",
  ink: "bg-ink text-[color:var(--on-dark)]",
  blush: "bg-blush text-ink",
  paper: "bg-paper text-ink shadow-[inset_0_0_0_2px_var(--ink)]",
};

/** 바탕 위에서 괘선이 가져야 하는 색 */
const RULE: Record<Tone, string> = {
  hot: "bg-[color:var(--on-accent)]/30",
  ink: "bg-[color:var(--on-dark-line)]",
  blush: "bg-ink/25",
  paper: "bg-line",
};

/** 바탕 위에서 부차 정보가 가져야 하는 색 */
const DIM: Record<Tone, string> = {
  hot: "text-[color:var(--on-accent)]/65",
  ink: "text-[color:var(--on-dark-dim)]",
  blush: "text-ink/60",
  paper: "text-faint",
};

/** 바탕 위에서 속 빈 활자의 획이 가져야 하는 색.
    .outline 은 color:transparent 라 currentColor 로 획을 그리면 같이 투명해진다.
    그래서 획 색은 늘 직접 준다. */
const STROKE: Record<Tone, string> = {
  hot: "var(--on-accent)",
  ink: "var(--on-dark)",
  blush: "var(--ink)",
  paper: "var(--ink)",
};

export function hollowStyle(width: string, tone: Tone = "paper"): React.CSSProperties {
  // opsz 를 낮춰야 0 이 타원이 아니라 숫자로 읽힌다.
  return { WebkitTextStroke: `${width} ${STROKE[tone]}`, fontVariationSettings: '"opsz" 16' };
}

/** 같은 컬렉션의 낱장들이 줄줄이 같은 색이 되지 않게 돌려 쓴다 */
const ROTATION: Tone[] = ["hot", "ink", "blush", "paper"];
export function toneAt(i: number): Tone {
  return ROTATION[i % ROTATION.length];
}

/* ── 아주 작은 것들 ───────────────────────────────────────── */

/** 라틴 러버릭 + 한글 러버릭 한 쌍. 지면 전체가 이 리듬으로 열린다. */
export function Rubric({
  lat,
  kr,
  className = "",
  dim,
  accent,
}: {
  lat?: string;
  kr?: string;
  className?: string;
  /** 바탕색에 맞춘 부차 색 (없으면 기본 핑크) */
  dim?: string;
  accent?: string;
}) {
  if (!lat && !kr) return null;
  return (
    <span className={`flex items-baseline gap-2 ${className}`}>
      {lat ? <span className={`kicker ${accent ?? "text-hot-deep"}`}>{lat}</span> : null}
      {kr ? <span className={`kicker-kr ${dim ?? ""}`}>{kr}</span> : null}
    </span>
  );
}

/** 망점 — 색면이 비어 보이지 않게 얹는 인쇄 질감 */
export function Dots({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`dots pointer-events-none absolute inset-0 ${className}`} />;
}

/** 섹션 머리 — 표제 + 굵은 괘선 + 오른쪽 부기 */
export function SectionRule({
  children,
  right,
  lat,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  lat?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-1 border-b-[3px] border-ink pb-2.5">
      <h2 className="krd text-[clamp(30px,7vw,54px)] leading-[.92]">{children}</h2>
      {lat ? <span className="kicker pb-1.5 text-hot-deep">{lat}</span> : null}
      {right ? (
        <span className="ml-auto pb-1.5 text-[11.5px] leading-snug text-faint">{right}</span>
      ) : null}
    </div>
  );
}

/**
 * 별표 — "지금 쳐다봐야 하는 수" 하나에만.
 * 여러 개 쓰면 아무것도 급하지 않게 된다.
 */
export function Burst({
  lat,
  value,
  note,
  tone = "hot",
  size = 168,
  className = "",
}: {
  lat?: string;
  value: React.ReactNode;
  note?: string;
  tone?: "hot" | "ink";
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={
        "burst flex shrink-0 -rotate-[8deg] flex-col items-center justify-center " +
        (tone === "hot" ? "bg-hot text-[color:var(--on-accent)] " : "bg-ink text-[color:var(--on-dark)] ") +
        className
      }
      style={{ width: size, height: size }}
    >
      {lat ? (
        <span className={"kicker text-[7.5px] " + (tone === "hot" ? "" : "text-hot")}>{lat}</span>
      ) : null}
      <span
        className="num leading-[.92]"
        style={{ fontSize: size * 0.34, fontVariationSettings: '"opsz" 22' }}
      >
        {value}
      </span>
      {note ? (
        <span className="kicker-kr text-[10px] tracking-[.04em]">{note}</span>
      ) : null}
    </span>
  );
}

/**
 * 큰 숫자.
 *
 * 0 이면 속을 비운다. 이 지면에서 빈 윤곽선은 "아직 없음"을 뜻하고,
 * 채워진 숫자는 "이만큼 있음"을 뜻한다. 0 을 꽉 찬 활자로 박으면
 * 비었다는 사실이 자랑처럼 보인다.
 */
export function BigNumeral({
  value,
  label,
  italic,
  tone = "ink",
  className = "",
  size = "clamp(76px,17vw,230px)",
}: {
  value: string | number;
  label?: string;
  italic?: boolean;
  tone?: Tone;
  className?: string;
  size?: string;
}) {
  const hollow = String(value) === "0";
  return (
    <span className={`flex flex-col items-center leading-none ${className}`}>
      <span
        className={(italic ? "num-it " : "num ") + (hollow ? "outline " : "")}
        style={{
          fontSize: size,
          lineHeight: 0.76,
          ...(hollow ? hollowStyle("3px", tone) : null),
        }}
      >
        {value}
      </span>
      {label ? <span className="kicker-kr mt-1.5 tracking-[.18em]">{label}</span> : null}
    </span>
  );
}

/** 윤곽선 지명 — 큰 라틴을 속 빈 글자로. 바탕이 비어 보이지 않게. */
export function OutlineWord({
  children,
  tone = "ink",
  className = "",
  size = "clamp(54px,12vw,140px)",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  size?: string;
}) {
  return (
    <span
      aria-hidden
      className={`num-it outline block whitespace-nowrap leading-[.8] ${className}`}
      style={{ fontSize: size, ...hollowStyle("2px", tone) }}
    >
      {children}
    </span>
  );
}

/* ── 괘선 목록 ─────────────────────────────────────────────
   목차 조판. 번호 · 점선 · 이름이 오른쪽 끝에 붙는다.
   사진이 없을 때 색면을 채우는 가장 정직한 방법이다. */

export function LeaderList({
  items,
  tone = "hot",
  size = "clamp(26px,6.4vw,70px)",
}: {
  items: { lead?: string; name: string; trail?: string }[];
  tone?: Tone;
  size?: string;
}) {
  if (!items.length) return null;
  return (
    <ol className="relative z-[2]">
      {items.map((it, i) => (
        <li
          key={`${it.name}-${i}`}
          className={
            "flex items-center gap-3 border-t-2 py-2.5 last:border-b-2 sm:gap-5 " +
            (tone === "ink" ? "border-[color:var(--on-dark-line)]" : "border-current/70")
          }
        >
          {it.lead ? (
            <span className="num w-[26px] shrink-0 text-[clamp(13px,3vw,24px)] sm:w-[42px]">
              {it.lead}
            </span>
          ) : null}
          <span aria-hidden className={`h-[2px] min-w-[10px] flex-1 ${RULE[tone]}`} />
          <span
            className="krd shrink-0 text-right leading-[.98]"
            style={{ fontSize: size }}
          >
            {it.name}
          </span>
          {it.trail ? (
            <span className={`kicker-kr shrink-0 text-[10px] ${DIM[tone]}`}>{it.trail}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** 세는 줄 — 라벨 · 괘선 · 숫자. 0 이면 숫자가 비어 있다. */
export function CountRows({
  rows,
  tone = "hot",
}: {
  rows: { label: string; value: number | string; unit?: string }[];
  tone?: Tone;
}) {
  if (!rows.length) return null;
  return (
    <dl className="relative z-[2]">
      {rows.map((r) => {
        const hollow = String(r.value) === "0";
        return (
          <div
            key={r.label}
            className={
              "flex items-baseline gap-3 border-t-2 py-2.5 last:border-b-2 sm:gap-5 " +
              (tone === "ink" ? "border-[color:var(--on-dark-line)]" : "border-current/70")
            }
          >
            <dt className="krb shrink-0 text-[clamp(14px,3.4vw,21px)]">{r.label}</dt>
            <span aria-hidden className={`h-[2px] min-w-[10px] flex-1 ${RULE[tone]}`} />
            <dd className="flex shrink-0 items-baseline gap-1.5">
              <span
                className={"num text-[clamp(30px,7vw,58px)] leading-[.8] " + (hollow ? "outline" : "")}
                style={hollow ? hollowStyle("2.5px", tone) : undefined}
              >
                {r.value}
              </span>
              {r.unit ? <span className={`kicker-kr text-[10px] ${DIM[tone]}`}>{r.unit}</span> : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ── 색면 한 장 ───────────────────────────────────────────── */

export function Plate({
  tone = "hot",
  className = "",
  dots = true,
  children,
}: {
  tone?: Tone;
  className?: string;
  dots?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden ${PLATE[tone]} ${className}`}>
      {dots ? <Dots /> : null}
      {children}
    </div>
  );
}

/** 색면 왼쪽 위에 박는 표 — 러버릭이 지면에 물리는 자리 */
export function PlateTab({
  lat,
  kr,
  tone = "ink",
}: {
  lat?: string;
  kr: string;
  tone?: "ink" | "paper" | "hot";
}) {
  const skin =
    tone === "ink" ? "bg-ink text-[color:var(--on-dark)]"
    : tone === "hot" ? "bg-hot text-[color:var(--on-accent)]"
    : "bg-paper text-ink";
  return (
    <span className={`absolute left-0 top-0 z-[3] px-3.5 py-2 sm:px-5 sm:py-2.5 ${skin}`}>
      {lat ? <span className="kicker block text-hot">{lat}</span> : null}
      <span className="kicker-kr mt-0.5 block text-[clamp(13px,3.2vw,19px)] tracking-[.05em]">
        {kr}
      </span>
    </span>
  );
}

/** 번호 표 — 이번 호 낱장 왼쪽 위 */
export function PlateNum({ n, tone = "paper" }: { n: number | string; tone?: "paper" | "ink" }) {
  return (
    <span
      className={
        "num absolute left-0 top-0 z-[4] px-2.5 pb-1 pt-0.5 text-[clamp(18px,4vw,30px)] leading-[1.15] " +
        (tone === "ink" ? "bg-ink text-[color:var(--on-dark)]" : "bg-paper text-ink")
      }
    >
      {n}
    </span>
  );
}

/* ── 이번 호의 낱장들 ─────────────────────────────────────
   사진이 없으므로 컬렉션마다 장치가 다르다. 색만 바꾸면
   "저장된 장소"와 "음악"이 한눈에 구별되지 않는다. */

/** 필름 — 본 것 */
export function FilmStrip({ title, tone = "ink" }: { title: string; tone?: Tone }) {
  return (
    <div className="absolute inset-0 z-[2] flex flex-col justify-center gap-2 px-4 sm:gap-2.5 sm:px-6">
      <Perf tone={tone} />
      <div className="grid h-[46%] grid-cols-4 gap-1.5 sm:gap-2">
        <span
          className={
            "flex items-center justify-center px-1 " +
            (tone === "hot" ? "bg-ink text-[color:var(--on-dark)]" : "bg-hot text-[color:var(--on-accent)]")
          }
        >
          <span className="krd line-clamp-2 text-center text-[clamp(11px,2.4vw,19px)] leading-[1.06]">
            {title}
          </span>
        </span>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`flex items-center justify-center ${frameBox(tone)}`}>
            <span aria-hidden className={`h-[2px] w-4 ${RULE[tone]}`} />
          </span>
        ))}
      </div>
      <Perf tone={tone} />
    </div>
  );
}

function frameBox(tone: Tone) {
  return tone === "ink" || tone === "hot"
    ? "shadow-[inset_0_0_0_2px_var(--on-dark-line)]"
    : "shadow-[inset_0_0_0_2px_rgba(20,16,16,.3)]";
}

function Perf({ tone }: { tone: Tone }) {
  const c = tone === "ink" || tone === "hot" ? "var(--on-dark-line)" : "rgba(20,16,16,.28)";
  return (
    <span
      aria-hidden
      className="h-2.5 shrink-0 sm:h-3"
      style={{
        backgroundImage: `repeating-linear-gradient(90deg, ${c} 0 10px, transparent 10px 24px)`,
      }}
    />
  );
}

/** 책등 — 읽기 */
export function Spines({ title, tone = "blush" }: { title: string; tone?: Tone }) {
  // 책등은 바탕과 반대색이어야 상자로 읽힌다
  const spine =
    tone === "ink" || tone === "blush" || tone === "paper"
      ? "bg-hot text-[color:var(--on-accent)]"
      : "bg-ink text-[color:var(--on-dark)]";
  const shelf = tone === "hot" ? "bg-ink" : "bg-hot";
  return (
    <div className="absolute inset-0 z-[2] flex items-end gap-2.5 px-5 pb-3.5 sm:gap-3 sm:px-7 sm:pb-4">
      <span className={`flex h-[78%] w-[clamp(42px,9.5vw,66px)] items-center justify-center px-1 py-3 ${spine}`}>
        <span
          className="krb line-clamp-1 text-[clamp(12px,2.8vw,19px)] leading-none"
          style={{ writingMode: "vertical-rl" }}
        >
          {title}
        </span>
      </span>
      {/* 아직 꽂히지 않은 자리 — 다음 권이 들어올 칸 */}
      <span className={`h-[58%] w-[clamp(28px,6vw,44px)] ${frameBox(tone)}`} />
      <span className={`h-[44%] w-[clamp(28px,6vw,44px)] ${frameBox(tone)}`} />
      <span aria-hidden className={`absolute inset-x-0 bottom-0 h-2.5 sm:h-3 ${shelf}`} />
    </div>
  );
}

/** 트랙 — 음악 */
export function Tracks({ title, tone = "ink" }: { title: string; tone?: Tone }) {
  const bars = [34, 72, 48, 96, 26, 64, 88, 40, 58, 78, 30, 68];
  const fill = tone === "hot" ? "bg-ink" : "bg-hot";
  return (
    <div className="absolute inset-0 z-[2] flex flex-col justify-end gap-3 px-5 pb-5 pt-11 sm:px-7 sm:pb-6">
      <span aria-hidden className="flex h-[42%] items-end gap-[3px] sm:gap-1">
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}%`, opacity: i % 3 === 1 ? 0.45 : 1 }}
            className={`flex-1 ${fill}`}
          />
        ))}
      </span>
      <span aria-hidden className={`h-[2px] w-full ${RULE[tone]}`} />
      <span className="krd text-[clamp(22px,5.4vw,42px)] leading-[.98]">{title}</span>
    </div>
  );
}

/** 꼬리표 — 위시리스트 */
export function TagPlate({ title, tone = "paper" }: { title: string; tone?: Tone }) {
  return (
    <div className="absolute inset-0 z-[2] flex items-center justify-center px-5">
      <span
        className={
          "relative flex min-w-0 max-w-full items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 " +
          (tone === "hot"
            ? "bg-ink text-[color:var(--on-dark)]"
            : tone === "ink"
              ? "bg-hot text-[color:var(--on-accent)]"
              : "bg-ink text-[color:var(--on-dark)]")
        }
      >
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full border-2 border-current sm:size-3.5"
        />
        <span className="krd truncate text-[clamp(18px,4.6vw,38px)] leading-[1]">{title}</span>
      </span>
    </div>
  );
}

/** 지명 — 장소·버킷리스트. 이름이 곧 그림이다. */
export function Locator({
  title,
  region,
  tone = "hot",
}: {
  title: string;
  region?: string | null;
  tone?: Tone;
}) {
  // 지역이 제목과 같으면 같은 말을 두 번 하는 셈이다.
  const stamp = region && region !== title ? region : null;
  return (
    <div className="absolute inset-0 z-[2] flex flex-col justify-center gap-2.5 px-5 pb-4 pt-11 sm:gap-3 sm:px-7 sm:pt-12">
      <span aria-hidden className={`h-[2px] w-full ${RULE[tone]}`} />
      <span className="krd text-[clamp(32px,8.4vw,54px)] leading-[.96]">{title}</span>
      {stamp ? (
        <span className={`kicker-kr truncate text-[10.5px] tracking-[.16em] ${DIM[tone]}`}>
          {stamp}
        </span>
      ) : null}
    </div>
  );
}

/* ── 마감 밴드 ────────────────────────────────────────────── */

export function DeadlineBand({
  items,
}: {
  items: { num: string; unit: string; title: string; urgent?: boolean }[];
}) {
  if (!items.length) return null;
  return (
    <section className="bg-ink px-5 pb-7 pt-5 text-[color:var(--on-dark)] sm:px-7 lg:px-10 lg:pb-9 lg:pt-6">
      <div className="mb-5 flex items-center gap-3.5 lg:mb-7">
        <span className="kicker text-hot">Deadlines</span>
        <span className="kicker-kr tracking-[.24em]">마 감</span>
        <span aria-hidden className="h-[2px] flex-1 bg-hot" />
        <span className="kicker text-hot">{items.length} open</span>
      </div>

      <div
        className={
          "grid gap-x-8 gap-y-7 sm:grid-cols-2 " +
          (items.length > 2 ? "lg:grid-cols-3" : "")
        }
      >
        {items.map((d, i) => (
          <div
            key={`${d.title}-${i}`}
            className="min-w-0 border-t border-[color:var(--on-dark-line)] pt-4 sm:border-t-0 sm:pt-0"
          >
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span
                className="num text-[clamp(17px,4vw,26px)] leading-none text-[color:var(--on-dark-dim)]"
                style={{ fontVariationSettings: '"opsz" 12' }}
              >
                D－
              </span>
              <span
                className={
                  "num text-[clamp(50px,11.5vw,88px)] leading-[.78] " +
                  (d.urgent ? "text-hot" : "text-[color:var(--on-dark)]")
                }
                style={{ fontVariationSettings: '"opsz" 54' }}
              >
                {d.num}
              </span>
            </div>
            <div className="krb mt-2.5 text-[clamp(16px,4vw,23px)] leading-[1.24]">
              {d.title}
            </div>
            <div className="mt-1.5 text-[11.5px] tracking-[.06em] text-[color:var(--on-dark-dim)]">
              {d.unit}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── 표지 ─────────────────────────────────────────────────── */

/**
 * 표지 색면. 오늘 표지에 올릴 것이 무엇이냐에 따라 안이 바뀐다.
 *   - 맥락 서피싱이 있으면: 실제 항목 이름이 목차처럼 올라간다
 *   - 없으면: 그 주제에 대해 지금 가진 것이 몇 장인지가 올라간다 (0 이면 빈 숫자)
 */
export function CoverPlate({
  tabLat,
  tabKr,
  headLat,
  headKr,
  items,
  rows,
  stamp,
  tone = "hot",
}: {
  tabLat?: string;
  tabKr: string;
  headLat?: string;
  headKr?: string;
  items?: { lead?: string; name: string }[];
  rows?: { label: string; value: number | string; unit?: string }[];
  stamp?: string;
  tone?: Tone;
}) {
  return (
    <Plate tone={tone} className="px-5 pb-6 pt-[72px] sm:px-8 sm:pt-[86px] lg:px-12 lg:pb-10">
      <PlateTab lat={tabLat} kr={tabKr} />

      {stamp ? (
        <span
          aria-hidden
          className={`kicker absolute right-3 top-4 hidden text-[9px] sm:block ${DIM[tone]}`}
        >
          {stamp}
        </span>
      ) : null}

      {headLat || headKr ? (
        <div className="relative z-[2] mb-4 flex items-center gap-3 sm:mb-6">
          {headLat ? <span className={`kicker ${DIM[tone]}`}>{headLat}</span> : null}
          <span aria-hidden className={`h-[2px] flex-1 ${RULE[tone]}`} />
          {headKr ? <span className="kicker-kr tracking-[.16em]">{headKr}</span> : null}
        </div>
      ) : null}

      {items?.length ? <LeaderList items={items} tone={tone} /> : null}
      {!items?.length && rows?.length ? <CountRows rows={rows} tone={tone} /> : null}
    </Plate>
  );
}

/**
 * 잉크 덱 — 표제가 앉는 검은 색면.
 * 표제의 마지막 어절이 핑크가 된다. 기계적이지만 한국어에서는
 * 마지막 어절이 대개 결론이라 늘 옳은 자리에 떨어진다.
 */
export function InkDeck({
  kickerLat,
  kickerKr,
  headline,
  hot,
  standfirst,
  asideLat,
  asideTitle,
  asideNote,
  numeral,
  numeralLabel,
  href,
}: {
  kickerLat?: string;
  kickerKr?: string;
  headline: string;
  hot?: string;
  standfirst?: string;
  asideLat?: string;
  asideTitle?: string;
  asideNote?: string;
  numeral?: string | number;
  numeralLabel?: string;
  href?: string;
}) {
  const parts = splitHot(headline, hot);

  const body = (
    <div className="relative bg-ink px-5 pb-7 pt-6 text-[color:var(--on-dark)] sm:px-7 sm:pb-9 sm:pt-8 lg:px-12 lg:pb-11 lg:pt-10">
      {kickerLat || kickerKr ? (
        <div className="mb-3 flex items-center gap-3">
          {kickerLat ? <span className="kicker text-hot">{kickerLat}</span> : null}
          {kickerKr ? (
            <span className="kicker-kr tracking-[.2em] text-[color:var(--on-dark-dim)]">
              {kickerKr}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-10">
        <h2 className="krd min-w-0 flex-1 text-[clamp(38px,9.4vw,124px)] leading-[.92]">
          {parts.head}
          {parts.tail ? <span className="text-hot">{parts.tail}</span> : null}
        </h2>

        {numeral !== undefined && String(numeral) !== "0" ? (
          <BigNumeral
            value={numeral}
            label={numeralLabel}
            italic
            size="clamp(66px,15vw,190px)"
            className="shrink-0 -rotate-[6deg] self-start text-hot lg:self-end"
          />
        ) : null}
      </div>

      {standfirst || asideTitle ? (
        <div className="mt-6 flex flex-col gap-5 border-t border-[color:var(--on-dark-line)] pt-5 sm:mt-8 sm:pt-6 lg:flex-row lg:gap-9">
          {standfirst ? (
            <p className="krb max-w-[46ch] flex-1 text-[clamp(15px,3.6vw,21px)] font-medium leading-[1.62] text-[color:var(--on-dark)]">
              {standfirst}
            </p>
          ) : null}
          {asideTitle ? (
            <div className="shrink-0 border-t-2 border-hot pt-3 lg:w-[250px] lg:border-l-2 lg:border-t-0 lg:pl-7 lg:pt-0">
              {asideLat ? <span className="kicker block text-hot">{asideLat}</span> : null}
              <span className="krb mt-2 block text-[clamp(16px,4vw,25px)] leading-tight">
                {asideTitle}
              </span>
              {asideNote ? (
                <span className="mt-1.5 block text-[11.5px] tracking-[.08em] text-[color:var(--on-dark-dim)]">
                  {asideNote}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return href ? (
    <Link href={href} className="tile block">
      {body}
    </Link>
  ) : (
    body
  );
}

/** 표제의 마지막 어절을 떼어낸다 (핑크가 될 자리) */
function splitHot(headline: string, hot?: string): { head: string; tail: string | null } {
  if (hot && headline.includes(hot)) {
    const i = headline.lastIndexOf(hot);
    return { head: headline.slice(0, i), tail: headline.slice(i) };
  }
  const words = headline.trim().split(/\s+/);
  if (words.length < 2) return { head: headline, tail: null };
  const last = words[words.length - 1];
  const i = headline.lastIndexOf(last);
  return { head: headline.slice(0, i), tail: headline.slice(i) };
}

/* ── 다음 일정 ────────────────────────────────────────────── */

/** 제호를 자르고 들어오는 핑크 띠. 첫 화면에서 제일 큰 활자. */
export function NextUpBand({
  time,
  title,
  until,
  note,
  rest,
  empty,
}: {
  time?: string;
  title?: string;
  until?: string;
  note?: string;
  rest: { time: string; title: string; tag?: string; strong?: boolean }[];
  empty?: string;
}) {
  return (
    <section className="relative bg-hot px-5 pb-6 pt-5 text-[color:var(--on-accent)] sm:px-7 lg:px-10 lg:pb-7 lg:pt-6 xl:pr-[210px]">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-10">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <span className="kicker">Next up</span>
            <span className="kicker-kr tracking-[.2em]">다 음 일 정</span>
            {until ? (
              <span className="krb ml-auto shrink-0 bg-ink px-2.5 py-1 text-[11px] tracking-[.1em] text-hot lg:hidden">
                {until}
              </span>
            ) : null}
          </div>

          {title ? (
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span
                className="num tnum text-[clamp(46px,13vw,124px)] leading-[.84]"
                style={{ fontVariationSettings: '"opsz" 62' }}
              >
                {time}
              </span>
              <span className="krd min-w-0 text-[clamp(26px,6.6vw,60px)] leading-[.96]">
                {title}
              </span>
            </div>
          ) : (
            <p className="krd text-[clamp(26px,6.6vw,56px)] leading-[.98] opacity-70">
              {empty ?? "남은 일정이 없습니다"}
            </p>
          )}

          {note ? (
            <p className="kicker-kr mt-2 text-[10.5px] tracking-[.16em] opacity-75">{note}</p>
          ) : null}
        </div>

        <div className="relative lg:pl-7">
          <span
            aria-hidden
            className="absolute left-0 top-0 hidden h-full w-[2px] bg-[color:var(--on-accent)] lg:block"
          />
          {rest.length ? (
            <ul>
              {rest.map((e, i) => (
                <li
                  key={`${e.time}-${e.title}-${i}`}
                  className={
                    "flex items-baseline gap-4 border-b border-[color:var(--on-accent)]/35 py-2 " +
                    (i === 0 ? "border-t" : "") +
                    (e.strong ? "" : " opacity-55")
                  }
                >
                  <span className="num tnum w-[58px] shrink-0 text-[clamp(14px,3.4vw,21px)]">
                    {e.time}
                  </span>
                  <span className="krb min-w-0 flex-1 truncate text-[clamp(13px,3.2vw,18px)]">
                    {e.title}
                  </span>
                  {e.tag ? (
                    <span className="kicker-kr shrink-0 border-[1.5px] border-current px-2 py-[3px] text-[9.5px]">
                      {e.tag}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="kicker-kr pt-1 text-[11px] tracking-[.14em] opacity-70">
              오늘 다른 일정 없음
            </p>
          )}
        </div>
      </div>

      {until ? (
        <span
          aria-hidden
          className="absolute right-9 top-1/2 hidden size-[136px] -translate-y-1/2 -rotate-[7deg] flex-col items-center justify-center rounded-full border-[5px] border-paper bg-ink text-[color:var(--on-dark)] xl:flex"
        >
          <span className="kicker text-[7.5px] text-hot">In</span>
          <span
            className="num text-[46px] leading-[.92] text-hot"
            style={{ fontVariationSettings: '"opsz" 24' }}
          >
            {untilNum(until)}
          </span>
          <span className="kicker-kr text-[11px] tracking-[.02em]">{untilUnit(until)}</span>
        </span>
      ) : null}
    </section>
  );
}

function untilNum(s: string) {
  return s.match(/\d+/)?.[0] ?? s;
}
function untilUnit(s: string) {
  return s.replace(/[\d\s]/g, "") || "뒤";
}

/* ── 실행 패널 (할 일 · 습관 · 인박스) ────────────────────── */

export function Ledger({
  lat,
  kr,
  done,
  total,
  tone = "paper",
  children,
  footer,
}: {
  lat: string;
  kr: string;
  done?: number;
  total?: number;
  tone?: "paper" | "blush";
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section
      className={
        "flex min-w-0 flex-col px-5 pb-5 pt-4 sm:px-7 lg:px-8 " +
        (tone === "blush" ? "bg-blush lg:border-l-[3px] lg:border-ink" : "bg-paper")
      }
    >
      <div className="mb-1 flex items-end justify-between gap-4 border-b-[3px] border-ink pb-2">
        <span className="min-w-0">
          <span className="kicker block text-hot-deep">{lat}</span>
          <span className="krb mt-1.5 block text-[clamp(21px,5vw,28px)] leading-none">{kr}</span>
        </span>
        {total !== undefined ? (
          <span
            className="num shrink-0 text-[clamp(38px,9vw,60px)] leading-[.76] text-hot"
            style={{ fontVariationSettings: '"opsz" 20' }}
          >
            {done ?? 0}
            <span className="text-[.42em] text-ink">/{total}</span>
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </section>
  );
}

/** 빈 칸에 놓는 한 줄 */
export function EmptyNote({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="border-b border-line py-5">
      <p className="krb text-[clamp(15px,3.8vw,19px)] leading-snug text-muted">{children}</p>
      {sub ? <p className="mt-1.5 text-[12.5px] leading-relaxed text-faint">{sub}</p> : null}
    </div>
  );
}

/**
 * 비어 있음을 지면으로 만드는 자리.
 *
 * 0 을 속 빈 활자로 크게 놓고, 바로 옆에서 다음에 할 일을 가리킨다.
 * 빈 칸을 여백으로 남기면 "아직 아무것도 안 했다"만 남지만,
 * 가리킬 곳이 있으면 같은 빈 칸이 시작점이 된다.
 */
export function ZeroState({
  numeral,
  title,
  sub,
  actionLabel,
  href,
}: {
  numeral: number | string;
  title: string;
  sub?: string;
  actionLabel?: string;
  href?: string;
}) {
  return (
    <div className="flex flex-col gap-4 py-5 sm:gap-6 sm:py-7">
      <div className="flex items-center gap-5 sm:gap-7">
        <span
          className="num outline shrink-0 leading-[.72] text-ink"
          style={{
            fontSize: "clamp(74px,16vw,140px)",
            ...hollowStyle("3px", "paper"),
          }}
        >
          {numeral}
        </span>
        <span className="min-w-0">
          <span className="krb block text-[clamp(17px,4.4vw,24px)] leading-tight">{title}</span>
          {sub ? (
            <span className="mt-2 block max-w-[34ch] text-[13px] leading-relaxed text-muted">
              {sub}
            </span>
          ) : null}
        </span>
      </div>

      {actionLabel && href ? (
        <Link
          href={href}
          className="group flex items-center gap-3 border-t-2 border-ink pt-2.5"
        >
          <span className="krb text-[clamp(14px,3.6vw,17px)] group-hover:text-hot-deep">
            {actionLabel}
          </span>
          <span aria-hidden className="h-[2px] min-w-[10px] flex-1 bg-line" />
          <span aria-hidden className="num text-[20px] leading-none text-hot">→</span>
        </Link>
      ) : null}
    </div>
  );
}

/**
 * 표지 색면이 아직 담을 것이 없을 때 대신 놓는 한 줄.
 * 0 두 개를 지면 폭만큼 키워 광고하느니, 줄 하나로 자리만 지킨다.
 */
export function CoverLine({
  lat,
  kr,
  text,
  href,
  cta,
}: {
  lat?: string;
  kr: string;
  text: string;
  href?: string;
  cta?: string;
}) {
  const inner = (
    <div className="flex flex-col gap-2 border-y-2 border-hot bg-blush px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-7">
      <span className="flex shrink-0 items-baseline gap-2">
        {lat ? <span className="kicker text-hot-deep">{lat}</span> : null}
        <span className="kicker-kr text-ink">{kr}</span>
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted">{text}</span>
      {cta ? (
        <span className="krb shrink-0 text-[12.5px] text-hot-deep">{cta} →</span>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/* ── 이번 호 낱장 ─────────────────────────────────────────── */

export type PlateKind = "locator" | "spine" | "tracks" | "film" | "tag";

export function kindFor(slug: string, collectionKind: string): PlateKind {
  if (slug === "books") return "spine";
  if (slug === "music") return "tracks";
  if (slug === "watch") return "film";
  if (collectionKind === "product") return "tag";
  return "locator";
}

/** 이번 호에 오르는 낱장 하나 */
export function HighlightPlate({
  n,
  rubric,
  title,
  note,
  meta,
  region,
  href,
  kind,
  tone,
  image,
}: {
  n: number;
  rubric: string;
  title: string;
  note?: string | null;
  meta?: string | null;
  region?: string | null;
  href: string;
  kind: PlateKind;
  tone: Tone;
  image?: string | null;
}) {
  return (
    <Link href={href} className="tile group flex min-w-0 flex-col">
      <Plate tone={tone} dots={!image} className="aspect-[16/10] w-full">
        <PlateNum n={String(n).padStart(2, "0")} tone={tone === "paper" ? "ink" : "paper"} />

        {image ? (
          <>
            {/* 사진이 들어오면 색면이 그대로 인쇄 잉크가 된다 — 예외이자 상급 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              loading="lazy"
              className="zoom absolute inset-0 size-full object-cover mix-blend-multiply"
              style={{ filter: "grayscale(1) brightness(1.6) contrast(1.06)" }}
            />
            <span className="absolute inset-x-0 bottom-0 z-[3] bg-ink px-4 py-2.5 text-[color:var(--on-dark)]">
              <span className="krd block truncate text-[clamp(16px,4vw,30px)] leading-none">
                {title}
              </span>
            </span>
          </>
        ) : kind === "spine" ? (
          <Spines title={title} tone={tone} />
        ) : kind === "tracks" ? (
          <Tracks title={title} tone={tone} />
        ) : kind === "film" ? (
          <FilmStrip title={title} tone={tone} />
        ) : kind === "tag" ? (
          <TagPlate title={title} tone={tone} />
        ) : (
          <Locator title={title} region={region} tone={tone} />
        )}
      </Plate>

      {/* 제목은 색면이 이미 크게 말했다. 여기서는 어느 서랍의 것인지와
          그 한 줄만 — 같은 말을 두 번 싣지 않는다. */}
      <div className="mt-2.5 flex min-w-0 items-baseline gap-3 border-t-[3px] border-ink pt-2">
        <span className="kicker-kr shrink-0 text-[11px] group-hover:text-hot-deep">{rubric}</span>
        {note ? (
          <span className="min-w-0 flex-1 truncate text-[12.5px] leading-snug text-muted">
            {note}
          </span>
        ) : (
          <span aria-hidden className="h-px min-w-[10px] flex-1 bg-line" />
        )}
        {meta ? (
          <span className="kicker-kr shrink-0 text-[10.5px] tracking-[.1em] text-faint">{meta}</span>
        ) : null}
      </div>
    </Link>
  );
}

/* ── 컬렉션 색인 ──────────────────────────────────────────
   빈 컬렉션이 큰 색면을 차지하면 지면이 비어 보인다.
   목차 줄로 내리면 0 도 정보가 된다. */

export function IndexRow({
  name,
  total,
  meta,
  href,
}: {
  name: string;
  total: number;
  meta?: string;
  href: string;
}) {
  const empty = total === 0;
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 border-t border-line py-3 last:border-b sm:gap-5"
    >
      <span
        className={
          "krb min-w-0 shrink-0 text-[clamp(14px,3.6vw,19px)] " +
          (empty ? "text-faint" : "text-ink group-hover:text-hot-deep")
        }
      >
        {name}
      </span>
      <span aria-hidden className="h-px min-w-[10px] flex-1 bg-line" />
      {empty ? (
        <span className="kicker-kr shrink-0 text-[10.5px] tracking-[.12em] text-faint">
          {meta ?? "비어 있음"}
        </span>
      ) : (
        <>
          {meta ? (
            <span className="hidden text-[11.5px] text-faint sm:block">{meta}</span>
          ) : null}
          <span className="num shrink-0 text-[clamp(17px,4vw,26px)] leading-none text-ink">
            {total}
          </span>
        </>
      )}
    </Link>
  );
}
