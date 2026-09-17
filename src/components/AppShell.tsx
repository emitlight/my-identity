import Link from "next/link";

const NAV = [
  { href: "/", label: "오늘", key: "today" },
  { href: "/calendar", label: "캘린더", key: "calendar" },
  { href: "/tasks", label: "할 일", key: "tasks" },
  { href: "/goals", label: "목표", key: "goals" },
  { href: "/collections", label: "컬렉션", key: "collections" },
];

const SECONDARY = [
  { href: "/identity", label: "나", key: "identity" },
  { href: "/settings", label: "설정", key: "settings" },
];

/**
 * 매거진 판형의 앱 셸.
 *
 * 데스크탑과 모바일이 같은 트리를 쓰되 판형만 바뀐다.
 *   데스크탑  [제호 · 메뉴 · 실행 레일] | 본지
 *   모바일    제호 → 실행 스트립 → 본지 → 하단 탭
 *
 * rail 은 한 번만 렌더한다. 브레이크포인트마다 따로 렌더하면
 * 체크박스 같은 클라이언트 상태가 두 벌 생기고, 안 보이는 쪽이
 * 조용히 어긋난다.
 */
export function AppShell({
  children,
  active,
  title,
  subtitle,
  rail,
  /** 제호 오른쪽에 붙는 한 줄 (발행 정보) */
  dateline,
}: {
  children: React.ReactNode;
  active: string;
  title: string;
  subtitle?: string;
  rail?: React.ReactNode;
  dateline?: string;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* ─────────── 왼쪽 레일 (모바일에서는 상단으로 흐른다) ─────────── */}
      <aside
        className={
          "px-5 pt-7 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-9 " +
          "lg:overflow-y-auto lg:border-r lg:border-line lg:bg-surface-2 lg:px-7 lg:pt-10 lg:pb-12"
        }
      >
        <div>
          <div className="flex items-end justify-between gap-3">
            <Link href="/" className="masthead text-[19px] leading-none lg:text-[24px] lg:leading-[1.06]">
              MY<span className="lg:hidden"> </span>
              <br className="hidden lg:inline" />
              IDENTITY
            </Link>
            <span className="flex shrink-0 items-center gap-3 lg:hidden">
              {SECONDARY.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  className="text-[12.5px] text-faint hover:text-ink"
                >
                  {s.label}
                </Link>
              ))}
            </span>
          </div>
          <div className="mt-2.5 h-px bg-ink lg:mt-3" />
          <div className="mt-2.5 flex items-baseline justify-between gap-3">
            <span className="kicker">{title}</span>
            {dateline ?? subtitle ? (
              <span className="text-[11.5px] tnum text-faint">{dateline ?? subtitle}</span>
            ) : null}
          </div>
        </div>

        {/* 데스크탑 전용 메뉴 — 모바일은 하단 탭이 대신한다 */}
        <nav aria-label="주요 메뉴" className="hidden lg:flex lg:flex-col lg:gap-3">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={active === n.key ? "page" : undefined}
              className={
                "flex items-center gap-2.5 text-[15px] transition-colors " +
                (active === n.key
                  ? "font-medium text-ink"
                  : "pl-[26px] text-muted hover:text-ink")
              }
            >
              {active === n.key ? (
                <span aria-hidden className="h-px w-4 bg-accent" />
              ) : null}
              {n.label}
            </Link>
          ))}
          <span className="mt-1 h-px bg-line" />
          {SECONDARY.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              aria-current={active === s.key ? "page" : undefined}
              className={
                "flex items-center gap-2.5 text-[15px] transition-colors " +
                (active === s.key
                  ? "font-medium text-ink"
                  : "pl-[26px] text-muted hover:text-ink")
              }
            >
              {active === s.key ? (
                <span aria-hidden className="h-px w-4 bg-accent" />
              ) : null}
              {s.label}
            </Link>
          ))}
        </nav>

        {rail ? <div className="mt-5 lg:mt-0 lg:flex-1">{rail}</div> : null}
      </aside>

      {/* ─────────── 본지 ─────────── */}
      <main className="px-5 pt-7 pb-28 lg:px-12 lg:pt-10 lg:pb-16">{children}</main>

      {/* ─────────── 모바일 탭 ─────────── */}
      <nav
        aria-label="주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex w-full max-w-[560px]">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={active === n.key ? "page" : undefined}
              className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1.5"
            >
              <span
                aria-hidden
                className={
                  "h-px w-3.5 " + (active === n.key ? "bg-accent" : "bg-transparent")
                }
              />
              <span
                className={
                  "text-[11.5px] transition-colors " +
                  (active === n.key ? "text-ink" : "text-faint")
                }
              >
                {n.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
