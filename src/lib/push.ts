import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

let configured = false;

function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("VAPID 키가 설정되지 않았습니다");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:noreply@example.com",
    pub,
    priv,
  );
  configured = true;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

/**
 * 한 사용자의 모든 기기에 보낸다.
 *
 * 만료된 구독(410/404)은 즉시 지운다. 남겨두면 매 틱마다 실패하고,
 * 실패 로그에 묻혀 진짜 문제가 안 보이게 된다.
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload,
  notificationId?: string,
): Promise<{ sent: number; removed: number }> {
  configure();
  const admin = createAdminClient();

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return { sent: 0, removed: 0 };

  const body = JSON.stringify({ ...payload, id: notificationId ?? null });
  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent++;
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
      }
    }),
  );

  if (dead.length) {
    await admin.from("push_subscriptions").delete().in("id", dead);
  }

  return { sent, removed: dead.length };
}
