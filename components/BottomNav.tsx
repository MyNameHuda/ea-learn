"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChart, IconHome, IconList, IconUser } from "@/components/Icon";

/**
 * Primary navigation.
 *
 * v3 shipped four emoji (🏠 📝 📊 👤) and pointed two of them at routes that
 * do not exist — /dashboard/quizzes and /dashboard/stats were never
 * created, so tapping "Kuis" or "Statistik" 404'd. Both are folded into
 * /dashboard, which is where the quiz list and the attempt stats already
 * live (the dashboard renders "Kuis Aktif", "Akses cepat" and the stats
 * tiles). /quiz/new stays reachable through its own affordances.
 *
 * "Hasil" used to be `/dashboard#hasil` — an anchor that exists nowhere in
 * the app, so the item scrolled nowhere. It is a real page now: /hasil rolls
 * up every quiz the parent has shared, with attempts, averages and pass
 * counts, and drills into /quiz/<id>/results.
 */
const navItems = [
  { href: "/dashboard", icon: IconHome, label: "Beranda" },
  { href: "/quiz/new", icon: IconList, label: "Buat Kuis" },
  { href: "/hasil", icon: IconChart, label: "Hasil" },
  { href: "/profile", icon: IconUser, label: "Profil" },
];

export function BottomNav() {
  const pathname = usePathname();

  // "/hasil" and "/quiz/<id>/results" both mean "results", so match on the
  // segment rather than with a bare startsWith on the exact href.
  const isActive = (href: string) => {
    if (href === "/hasil") {
      const p = pathname ?? "";
      return p === "/hasil" || p.startsWith("/quiz/") && p.includes("/results");
    }
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href);
  };

  return (
    <nav className="bottom-nav" aria-label="Navigasi utama">
      {navItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              <Icon size={22} />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
