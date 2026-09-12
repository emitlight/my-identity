import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * 서버 컴포넌트 · 서버 액션 · 라우트 핸들러에서 쓰는 클라이언트.
 * anon 키를 쓰므로 모든 쿼리가 RLS 를 통과한다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: CookieToSet[]) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 미들웨어가 세션을
            // 갱신하고 있으므로 여기서 실패해도 로그인은 유지된다.
          }
        },
      },
    },
  );
}

/**
 * service_role 클라이언트 — RLS 를 우회한다.
 *
 * 크론(알림 발송)처럼 사용자 세션 없이 여러 사용자의 행을 읽어야 하는
 * 경로에서만 쓴다. 요청 처리 경로에서 이걸 쓰면 RLS 방어선이 통째로
 * 무력해지므로, 새로 쓸 때마다 정말 필요한지 확인할 것.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 없습니다");

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
