/**
 * ResponsiveShell — wraps page content.
 * Mobile: max-width 480px shell with bg.
 * Desktop: max-width 1200px wide layout (used by pages).
 */
export function ResponsiveShell({
  children,
  fullBleed = false,
}: {
  children: React.ReactNode;
  fullBleed?: boolean;
}) {
  return (
    <div className={fullBleed ? "shell-mobile-full" : "shell-mobile"}>
      {children}
    </div>
  );
}

// Backwards-compatible alias for older pages
export const MobileFrame = ResponsiveShell;
export default ResponsiveShell;
