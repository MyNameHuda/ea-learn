import type { NextConfig } from "next";

/**
 * Production configuration for the EaLearn deployment.
 *
 * The file was empty, which is not neutral — every value below was a decision
 * that was never made, and two of them defaulted to something worth naming.
 */
const nextConfig: NextConfig = {
  // Stops the server advertising its framework on every response.
  poweredByHeader: false,

  // The app renders on one custom server (raw SQLite, not serverless), so the
  // deployment is a long-lived Node process. These matter more than usual here:
  // user uploads land in public/uploads/questions and the database file is
  // written on every request.
  compress: true,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The service worker must be allowed to control the whole origin,
          // and the app ships no inline event handlers that this would break.
          // (Permissions-Policy is left at the browser default on purpose: a
          // wrong list here silently disables camera or clipboard for the
          // whole app, which is worse than not setting it.)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
      {
        // Uploaded question images are content, not code. Forbidding script
        // execution means that even if an SVG ever slipped past the upload
        // filter, the browser would not run it.
        source: "/uploads/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // A service worker that is never updated keeps serving an old app.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;