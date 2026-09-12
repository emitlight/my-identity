/* My Identity — 서비스 워커
 *
 * 푸시 표시와 클릭 처리만 한다. 오프라인 캐싱은 넣지 않았다.
 * 캐시된 옛날 할 일 목록을 보여주는 것은 안 보여주는 것보다 나쁘다.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "My Identity", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "My Identity";
  const url = payload.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag || undefined,
      renotify: false,
      data: { url, id: payload.id || null },
      // 알림에서 바로 끝낼 수 있어야 한다. 앱을 열게 만들면 안 하게 된다.
      actions: payload.actions || [],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || "/", self.location.origin);
  if (data.id) target.searchParams.set("n", data.id);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(target.toString());
          return c.focus();
        }
      }
      return self.clients.openWindow(target.toString());
    }),
  );
});
