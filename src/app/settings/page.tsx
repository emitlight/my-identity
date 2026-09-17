import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PushSetup } from "@/components/PushSetup";
import { SectionLabel } from "@/components/ui";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user } = await requireUser();
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <AppShell active="settings" title="설정">
      <div className="flex flex-col gap-10 pt-4 lg:pt-6">
        <section>
          <SectionLabel latin="Notifications">알림</SectionLabel>
          <div className="pt-4">
            {vapid ? (
              <PushSetup vapidPublicKey={vapid} />
            ) : (
              <p className="max-w-[56ch] text-[13.5px] leading-relaxed text-muted">
                VAPID 키가 설정되지 않아 알림을 켤 수 없습니다.{" "}
                <code className="bg-line-soft px-1.5 py-0.5 text-[12px]">
                  npx web-push generate-vapid-keys
                </code>{" "}
                로 키를 만들어 환경변수에 넣어 주세요.
              </p>
            )}
          </div>
        </section>

        <section>
          <SectionLabel latin="Account">계정</SectionLabel>
          <div className="flex flex-col items-start gap-4 pt-4">
            <p className="krb text-[15px]">{user.email}</p>
            <SignOutButton />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
