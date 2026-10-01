import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById, getUserSettings } from "@/lib/queries/data";
import { SettingsShell } from "@/components/SettingsShell";
import { PreferenceSettings } from "@/components/PreferenceSettings";

export default async function PrivasiPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  const settings = await getUserSettings(user.id);

  return (
    <SettingsShell
      title="Privasi & Data"
      subtitle="Atur data yang dikumpulkan, dan apa yang terlihat oleh siapa lewat link kuis."
    >
      <PreferenceSettings initial={settings} mode="privacy" />

      <div
        className="card"
        style={{ padding: 14, marginTop: 24, lineHeight: 1.7 }}
      >
        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          Data yang disimpan EaLearn
        </h4>
        <ul
          className="t-soft"
          style={{ fontSize: 12, margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}
        >
          <li>Email dan nama tampilan akun orang tua.</li>
          <li>
            Kuis yang kamu buat, lengkap dengan soal dan jawabannya.
          </li>
          <li>
            Nama yang diketik anak sendiri, skor, dan waktu pengerjaan setiap
            attempt.
          </li>
        </ul>
        <p className="t-soft" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
          Data anak tidak pernah dibagikan ke pihak lain, dan tidak ikut
          terkirim ke kanal notifikasi yang kamu matikan di halaman Notifikasi.
        </p>
      </div>
    </SettingsShell>
  );
}
