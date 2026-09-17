import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { LoginButton } from "./LoginButton";

const MESSAGES: Record<string, string> = {
  not_allowed: "이 계정은 접근 권한이 없습니다. 등록된 계정으로 로그인해 주세요.",
  exchange_failed: "로그인을 마치지 못했습니다. 다시 시도해 주세요.",
  no_code: "로그인 정보가 전달되지 않았습니다. 다시 시도해 주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && isAllowedEmail(user.email) && !error) redirect(next ?? "/");

  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      {/* 리본 — 잡지 표지의 발행 정보 자리 */}
      <div className="flex h-10 items-center justify-between bg-hot px-5 text-[color:var(--on-accent)] lg:h-[46px] lg:px-10">
        <span className="kicker">A Daily Magazine of One Life</span>
        <span className="kicker hidden sm:inline">Members Only</span>
      </div>

      <div className="flex flex-1 flex-col justify-center px-5 py-10 lg:px-10">
        <div className="mx-auto w-full max-w-[1120px]">
          <div className="masthead-wrap">
            <h1 className="masthead text-center">MY IDENTITY</h1>
          </div>

          <div className="mt-6 grid gap-8 border-t-[4px] border-ink pt-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16 lg:pt-8">
            <div>
              <p className="kicker text-hot-deep">Issue No. 1</p>
              <p className="krd mt-3 text-[30px] leading-[1.1] lg:text-[46px]">
                일상 · 비즈니스 · 취미를
                <br />
                한 지면으로
              </p>
              <p className="mt-4 max-w-[46ch] text-[14px] leading-relaxed text-muted lg:text-[15.5px]">
                모아둔 것이 서랍 안에서 잠들지 않도록, 오늘의 맥락에 맞는
                것을 먼저 꺼내는 개인 지면입니다.
              </p>
            </div>

            <div className="flex flex-col justify-end">
              {error ? (
                <p
                  role="alert"
                  className="mb-4 border-2 border-hot bg-blush px-4 py-3 text-[13.5px] leading-relaxed text-hot-deep"
                >
                  {MESSAGES[error] ?? "로그인에 실패했습니다. 다시 시도해 주세요."}
                </p>
              ) : null}

              <LoginButton next={next} />

              <p className="mt-4 text-[12px] leading-relaxed text-faint">
                등록된 계정만 들어올 수 있습니다. 데이터는 본인 계정에만
                연결되며 다른 사람에게 보이지 않습니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
