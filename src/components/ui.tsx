import { clsx } from "clsx";

/* 가판대 판형의 공통 부품.
   둥근 모서리와 그림자를 쓰지 않는다. 이 지면의 재료는 색면·괘선·활자
   세 가지뿐이고, 카드가 떠 보이기 시작하면 잡지가 아니라 대시보드로
   돌아간다. */

/** 섹션 머리 — 라틴 러버릭 + 한글, 그리고 굵은 밑줄 */
export function SectionLabel({
  children,
  right,
  latin,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  latin?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b-[3px] border-ink pb-1.5">
      <span className="flex flex-col gap-1.5">
        {latin ? <span className="kicker text-key-ink">{latin}</span> : null}
        <span className="krb text-[19px] leading-none lg:text-[24px]">{children}</span>
      </span>
      {right ? (
        <span className="num text-[22px] leading-none text-key-ink lg:text-[28px]">{right}</span>
      ) : null}
    </div>
  );
}

/** 괘선으로 두른 칸. 배경으로 띄우지 않고 선으로만 묶는다. */
export function Card({
  children,
  className,
  tone = "plain",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "plain" | "signal" | "ink";
}) {
  return (
    <div
      className={clsx(
        tone === "signal"
          ? "border-[2px] border-key bg-key-soft"
          : tone === "ink"
            ? "border-[2px] border-ink bg-ink text-[color:var(--on-dark)]"
            : "border border-line bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 역할 색. 점이 아니라 짧은 막대 — 괘선의 언어에 맞춘다. */
export function RoleDot({ color }: { color?: string | null }) {
  if (!color) return null;
  return (
    <span
      aria-hidden
      className="inline-block h-[3px] w-4 shrink-0"
      style={{ background: color }}
    />
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="krb py-8 text-center text-[14px] text-faint">{children}</p>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet";
}) {
  return (
    <button
      {...props}
      className={clsx(
        "krb px-5 py-2.5 text-[13px] tracking-[.06em] transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary"
          ? "bg-ink text-key-on-dark hover:bg-key hover:text-ink"
          : "border-2 border-ink bg-transparent text-ink hover:bg-key-soft",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** 파싱 결과 칩 — 저장 전에 무엇으로 해석됐는지 보여주고 고치게 한다.
    핑크 바탕 위의 글자는 key 이 아니라 key-ink 이어야 읽힌다. */
export function Chip({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "signal" | "quiet";
}) {
  return (
    <span
      className={clsx(
        "krb inline-flex items-center whitespace-nowrap px-2 py-[3px] text-[11.5px] tnum",
        tone === "accent" && "bg-key-soft text-key-ink",
        tone === "signal" && "bg-ink text-key-on-dark",
        tone === "quiet" && "bg-line-soft text-muted",
      )}
    >
      {children}
    </span>
  );
}
