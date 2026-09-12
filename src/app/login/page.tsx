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
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          Personal Dashboard
        </p>
        <h1 className="mt-3 text-[34px] font-semibold leading-tight tracking-tight">
          My Identity
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          일상 · 비즈니스 · 취미를 한 화면으로.
          <br />
          적절한 순간에 알아서 꺼내주는 대시보드.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-md border border-signal/35 bg-signal-soft px-4 py-3 text-[13.5px] leading-relaxed text-signal"
        >
          {MESSAGES[error] ?? "로그인에 실패했습니다. 다시 시도해 주세요."}
        </p>
      ) : null}

      <LoginButton next={next} />

      <p className="mt-6 text-[12.5px] leading-relaxed text-faint">
        등록된 계정만 들어올 수 있습니다. 데이터는 본인 계정에만 연결되며
        다른 사람에게 보이지 않습니다.
      </p>
    </main>
  );
}
