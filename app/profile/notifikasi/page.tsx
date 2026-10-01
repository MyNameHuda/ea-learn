import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById, getUserSettings } from "@/lib/queries/data";
import { SettingsShell } from "@/components/SettingsShell";
import { PreferenceSettings } from "@/components/PreferenceSettings";

export default async function NotifikasiPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  const settings = await getUserSettings(user.id);

  return (
    <SettingsShell
      title="Notifikasi"
      subtitle={`EaLearn mengabari ${user.displayName.split(" ")[0]} lewat kanal yang kamu pilih di bawah.`}
    >
      <PreferenceSettings initial={settings} mode="notification" />
    </SettingsShell>
  );
}
