"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { IconLogOut } from "./Icon";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await signOut({ callbackUrl: "/" });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="text-link"
      /* padding: 0 made this a 62x21px target for a destructive-ish action. The
         min-height gives it the standard touch size without changing the
         header's layout. */
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 0,
        minHeight: 44,
      }}
      aria-label="Keluar"
    >
      <IconLogOut size={16} />
      {loading ? "Keluar..." : "Keluar"}
    </button>
  );
}
