import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * 이 앱은 1인용이다. 구글 로그인은 누구나 시도할 수 있으므로,
 * 통과 여부는 이 목록이 결정한다.
 *
 * 목록이 비어 있으면 전원 거부한다. 설정을 빠뜨렸을 때 "아무나 들어옴"
 * 보다 "아무도 못 들어옴" 이 안전한 실패다.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/** 로그인·허용 여부를 모두 확인하고 사용자를 돌려준다. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAllowedEmail(user.email)) redirect("/login?error=not_allowed");

  return { user, supabase };
}
