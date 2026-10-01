"use client";

/**
 * Notification + privacy preferences.
 *
 * Each toggle saves on change — no separate "Simpan" button to forget — and
 * reverts the switch if the request fails, so the UI never claims a setting
 * that was not actually stored.
 */
import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { ToggleRow, SettingsCard } from "@/components/SettingsShell";
import type { UserSettings, SettingKey } from "@/lib/queries/data";

const NOTIFICATION_ROWS: { key: SettingKey; title: string; desc: string }[] = [
  {
    key: "notifyAttempt",
    title: "Saat anak selesai kuis",
    desc: "Langsung tahu begitu anak menekan Submit.",
  },
  {
    key: "notifyEmail",
    title: "Email",
    desc: "Ringkasan hasil ke email kamu.",
  },
  {
    key: "notifyWhatsapp",
    title: "WhatsApp",
    desc: "Kirim ringkasan lewat WhatsApp.",
  },
  {
    key: "notifyInapp",
    title: "Notifikasi di aplikasi",
    desc: "Tampil sebagai lonceng di dalam aplikasi.",
  },
];

const PRIVACY_ROWS: { key: SettingKey; title: string; desc: string }[] = [
  {
    key: "anonymousShare",
    title: "Sembunyikan nama di halaman kuis",
    desc: "Judul kuis yang dibagikan tidak memuat namamu.",
  },
  {
    key: "allowAnalytics",
    title: "Bantu kami memperbaiki aplikasi",
    desc: "Kirim data pemakaian tanpa isi jawaban anak.",
  },
  {
    key: "allowMarketing",
    title: "Info fitur baru",
    desc: "Kabar fitur baru dan tips parenthood.",
  },
];

export function PreferenceSettings({
  initial,
  mode,
}: {
  initial: UserSettings;
  mode: "notification" | "privacy";
}) {
  const [settings, setSettings] = useState<UserSettings>(initial);
  const [saving, startSave] = useTransition();
  const { showToast } = useToast();

  const rows = mode === "notification" ? NOTIFICATION_ROWS : PRIVACY_ROWS;

  function toggle(key: SettingKey, next: boolean) {
    const prev = settings;
    // Optimistic: flip immediately, roll back if the write fails.
    setSettings((s) => ({ ...s, [key]: next }));
    startSave(async () => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) {
        setSettings(prev);
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Gagal menyimpan pengaturan", "error");
      }
    });
  }

  return (
    <div style={{ opacity: saving ? 0.85 : 1, transition: "opacity 0.15s ease" }}>
      <SettingsCard
        title={mode === "notification" ? "Kanal notifikasi" : "Privasi & data"}
        desc={
          mode === "notification"
            ? "Pilih ke mana EaLearn mengabari kamu. Tidak ada yang dikirim ke semua kanal sekaligus."
            : "Atur data apa yang dikumpulkan dan apa yang ditampilkan di link kuis."
        }
      >
        {rows.map((r, i) => (
          <div
            key={r.key}
            style={{
              borderBottom:
                i < rows.length - 1 ? "1px solid var(--border-soft)" : "none",
            }}
          >
            <ToggleRow
              title={r.title}
              desc={r.desc}
              checked={settings[r.key]}
              disabled={saving}
              onChange={(next) => toggle(r.key, next)}
            />
          </div>
        ))}
      </SettingsCard>

      <p
        className="t-soft"
        style={{ fontSize: 12, lineHeight: 1.6, textAlign: "center" }}
      >
        {saving ? "Menyimpan…" : "Perubahan langsung tersimpan."}
      </p>
    </div>
  );
}
