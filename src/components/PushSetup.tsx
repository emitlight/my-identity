"use client";

import { useEffect, useState } from "react";
import { saveSubscription, removeSubscription } from "@/lib/actions/push";
import { Button, Card } from "@/components/ui";

type State =
  | "checking"
  | "unsupported"
  | "ios-needs-install"   // iOS 는 홈 화면에 추가해야만 푸시가 동작한다
  | "denied"
  | "ready"               // 지원되지만 아직 구독 안 함
  | "subscribed";

// applicationServerKey 는 ArrayBuffer 기반 뷰를 요구한다.
// Uint8Array.from 은 ArrayBufferLike 로 추론되어 타입이 맞지 않는다.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 는 데스크탑 사파리로 위장한다
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS 사파리 전용 플래그
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PushSetup({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // iOS 는 홈 화면에 추가하기 전까지 PushManager 자체가 없다.
        // "지원 안 함"으로 끝내면 "알림이 안 와요"로 끝난다.
        setState(isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");

      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "subscribed" : "ready");
    })();
  }, []);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const json = sub.toJSON();
      const res = await saveSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent.slice(0, 400),
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }
      setState("subscribed");
    } catch {
      setError("알림을 켜지 못했습니다. 브라우저 설정에서 알림이 차단되어 있는지 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removeSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("ready");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <h2 className="text-[15px] font-semibold">알림</h2>

      {state === "checking" ? (
        <p className="mt-2 text-[13.5px] text-faint">확인 중…</p>
      ) : null}

      {state === "ios-needs-install" ? (
        <div className="mt-2">
          <p className="text-[13.5px] leading-relaxed text-muted">
            아이폰은 <b className="text-ink">홈 화면에 추가</b>해야 알림을 받을 수 있습니다.
            사파리 하단 <b className="text-ink">공유 버튼</b> → <b className="text-ink">홈 화면에 추가</b>를
            누른 뒤, 홈 화면 아이콘으로 다시 들어와 주세요.
          </p>
          <p className="mt-2 text-[12.5px] text-faint">
            이 단계를 건너뛰면 알림이 오지 않습니다. 사파리의 제약이라 우회할 방법이 없습니다.
          </p>
        </div>
      ) : null}

      {state === "unsupported" ? (
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          이 브라우저는 웹 푸시를 지원하지 않습니다. 크롬이나 사파리 최신 버전에서
          열어 주세요.
        </p>
      ) : null}

      {state === "denied" ? (
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          알림이 차단되어 있습니다. 브라우저 주소창의 자물쇠 아이콘 → 알림 → 허용으로
          바꾼 뒤 이 페이지를 새로고침해 주세요.
        </p>
      ) : null}

      {state === "ready" ? (
        <div className="mt-2">
          <p className="text-[13.5px] leading-relaxed text-muted">
            아침 브리핑, 일정 리마인더, 저녁 회고를 폰으로 받습니다.
          </p>
          <Button onClick={subscribe} disabled={busy} className="mt-3">
            {busy ? "켜는 중…" : "알림 켜기"}
          </Button>
        </div>
      ) : null}

      {state === "subscribed" ? (
        <div className="mt-2">
          <p className="text-[13.5px] text-accent">이 기기에서 알림을 받습니다.</p>
          <button
            onClick={unsubscribe}
            disabled={busy}
            className="mt-3 text-[12.5px] text-faint underline underline-offset-2 hover:text-muted"
          >
            이 기기에서 끄기
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
