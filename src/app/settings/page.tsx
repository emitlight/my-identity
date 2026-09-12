import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PushSetup } from "@/components/PushSetup";
import { Card } from "@/components/ui";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user } = await requireUser();
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <AppShell active="settings" title="설정">
      <div className="flex flex-col gap-4">
        {vapid ? (
          <PushSetup vapidPublicKey={vapid} />
        ) : (
          <Card className="p-4">
            <h2 className="text-[15px] font-semibold">알림</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              VAPID 키가 설정되지 않아 알림을 켤 수 없습니다.
              <br />
              <code className="text-[12px]">npx web-push generate-vapid-keys</code> 로
              키를 만들어 환경변수에 넣어 주세요.
            </p>
          </Card>
        )}

        <Card className="p-4">
          <h2 className="text-[15px] font-semibold">계정</h2>
          <p className="mt-2 text-[13.5px] text-muted">{user.email}</p>
          <SignOutButton />
        </Card>
      </div>
    </AppShell>
  );
}
