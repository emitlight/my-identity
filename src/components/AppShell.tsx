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
 *   데스크탑  [제호 · 메뉴 · 실행 레일] | 본지
 *   모바일    제호 → (요약 띠) → 본지 → 실행 레일 → 하단 탭
 *
 * 레일이 판형마다 다른 자리에 오지만 DOM 에는 한 번만 있다. aside 를
 * 모바일에서 display:contents 로 풀어 바깥 플렉스의 항목이 되게 하고
 * order 로 자리를 옮긴다. 브레이크포인트마다 따로 렌더하면 체크박스
 * 같은 클라이언트 상태가 두 벌 생기고, 안 보이는 쪽이 조용히 어긋난다.
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
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside
        className={
          "contents lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-9 " +
          "lg:overflow-y-auto lg:border-r lg:border-line lg:bg-surface-2 lg:px-7 lg:pt-10 lg:pb-12"
        }
      >
        {/* ── 제호 ── */}
        <div className="order-1 px-5 pt-7 lg:order-none lg:p-0">
          <div className="flex items-end justify-between gap-3">
            <Link
              href="/"
              className="masthead text-[19px] leading-none lg:text-[24px] lg:leading-[1.06]"
            >
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
          {[...NAV, null, ...SECONDARY].map((n, i) =>
            n === null ? (
              <span key="rule" className="mt-1 h-px bg-line" />
            ) : (
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
            ),
          )}
        </nav>

        {/* 레일 — 모바일에서는 본지 아래(order-3), 데스크탑에서는 왼쪽 단 */}
        {rail ? (
          <div id="today-list" className="order-3 px-5 pb-8 lg:order-none lg:flex-1 lg:p-0">
            <div className="mb-6 h-px bg-line lg:hidden" />
            {rail}
          </div>
        ) : null}
      </aside>

      {/* ─────────── 본지 ─────────── */}
      <main className="order-2 px-5 pt-7 pb-8 lg:order-none lg:px-12 lg:pt-10 lg:pb-16">
        {children}
      </main>

      {/* 하단 탭이 마지막 줄을 가리지 않게 */}
      <div aria-hidden className="order-4 h-20 lg:hidden" />

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
