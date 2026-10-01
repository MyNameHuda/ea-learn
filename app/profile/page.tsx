import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/queries/data";
import { LogoutButton } from "@/components/LogoutButton";
import {
  IconArrowLeft,
  IconBell,
  IconShield,
  IconHelpCircle,
  IconUser,
  type IconComponent,
} from "@/components/Icon";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  // Every entry points at a real screen now. These were all href="#" placeholders.
  const menuItems: {
    icon: IconComponent;
    title: string;
    desc: string;
    href: string;
  }[] = [
    { icon: IconBell, title: "Notifikasi", desc: "Email, WhatsApp, in-app", href: "/profile/notifikasi" },
    { icon: IconShield, title: "Akun & Keamanan", desc: "Email & password kamu", href: "/profile/akun" },
    { icon: IconShield, title: "Privasi & Data", desc: "Pengaturan privasi", href: "/profile/privasi" },
    { icon: IconHelpCircle, title: "Bantuan", desc: "FAQ & kontak support", href: "/profile/bantuan" },
    { icon: IconUser, title: "Tentang", desc: "Cara kerja EaLearn", href: "/profile/tentang" },
  ];

  return (
    <>
      <div className="bg-aurora bg-aurora-dashboard" aria-hidden="true" />
      <div
        className="shell-mobile-full"
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <header className="page-header">
          <Link href="/dashboard" className="back" aria-label="Kembali">
            {/* Was <IconArrowRight style={{ transform: "rotate(180deg)" }} />.
                The icons destructure only { size, className } and never forward
                `style` to the <svg>, so that rotation was silently dropped and
                the "back" arrow pointed forwards. */}
            <IconArrowLeft size={20} />
          </Link>
          <h1>Profil</h1>
          <div style={{ width: 36 }} />
        </header>

        <main
          className="animate-fade-in"
          style={{ flex: 1, padding: "20px 16px 32px" }}
        >
          {/* Profile card */}
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: 28,
              marginBottom: 24,
              background:
                "linear-gradient(135deg, var(--primary-soft) 0%, var(--accent-soft) 100%)",
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--primary), var(--primary-dark))",
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                fontWeight: 800,
                marginBottom: 12,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
              {user.displayName}
            </h2>
            <div className="t-muted">{user.email}</div>
            {/* No verification badge. The column `email_verified` still exists
                in the schema but nothing sets it any more: signup never sends
                a code, so there is no verified/unverified state to show. A
                badge reading "Belum verifikasi" on someone who is signed in
                and using the app is a contradiction; a badge reading
                "terverifikasi" would be a claim the app cannot actually make. */}
          </div>

          {/* The "Anak-anak" section was removed. The child's name is typed by
              the child themselves on /play/<uuid>/name when they start a quiz,
              so a parent-side profile of them was a second place to maintain
              the same fact — and it was routinely stale, because nothing there
              wrote back to the attempt rows. Attempt results are the real
              record of who took a quiz. */}

          {/* Menu */}
          <section style={{ marginBottom: 24 }}>
            <h3 className="h-section" style={{ marginBottom: 12 }}>
              Pengaturan
            </h3>
            <div
              className="card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              {/* Was menuItems.slice(1): the first entry used to be
                  "Anak-anak", which the section above already rendered, so it
                  was dropped here to avoid showing it twice. With that entry
                  removed, slice(1) silently ate "Notifikasi" instead. Render
                  the array as-is. */}
              {menuItems.map((item, i) => (
                <Link
                  key={item.title}
                  href={item.href}
                  style={{
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    borderBottom: i < menuItems.length - 1 ? "1px solid var(--border-soft)" : "none",
                    textDecoration: "none",
                    color: "var(--text)",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "var(--bg-soft)",
                      color: "var(--primary-ink)",
                      flexShrink: 0,
                    }}
                  >
                    <item.icon size={20} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {item.title}
                    </div>
                    <div className="t-soft">{item.desc}</div>
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 18 }}>›</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Logout */}
          <div style={{ marginTop: 16 }}>
            <LogoutButton />
          </div>

          <div
            className="t-soft"
            style={{ textAlign: "center", marginTop: 32 }}
          >
            {/* Was "EaLearn v0.1 · Dibuat untuk orang tua Indonesia". The version number
            is release metadata, not something a parent needs on their profile
            screen, and printing a 0.x on it told users the app was unfinished. */}
            Dibuat untuk orang tua Indonesia
          </div>
        </main>
      </div>
    </>
  );
}
