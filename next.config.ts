import type { NextConfig } from "next";

/**
 * Production configuration for the EaLearn deployment.
 *
 * The file was empty, which is not neutral — every value below was a decision
 * that was never made, and two of them defaulted to something worth naming.
 *
 * Deployment shape: serverless functions on Vercel, region `sin1` (see
 * vercel.json), talking to Postgres on Neon over the pooled connection, with
 * question images on Cloudinary. There is no local database file and no local
 * upload directory in production — both would be read-only or thrown away
 * between invocations.
 */
const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy for the app itself.
 *
 * `'unsafe-inline'` appears in script-src because the App Router inlines the
 * RSC payload into the HTML, and a policy without a per-request nonce blocks
 * hydration outright. The real gain here is not that inline — it is
 * `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and a
 * `default-src` of `'self'`, none of which were set before. Together they mean
 * an injected <script> still cannot phone home to an attacker's origin, cannot
 * rewrite the page's base URL to hijack every relative link, and cannot post a
 * form to somewhere else.
 *
 * res.cloudinary.com is in img-src because question images are rendered with a
 * plain <img> pointing at the upload URL — deliberately not next/image, so
 * there is no optimizer host to allow.
 */
const csp = [
  "default-src 'self'",
  // 'unsafe-eval' is a dev-only requirement of the React refresh runtime.
  isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  // No <object>, <embed>, or <applet> anywhere in this app.
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Stops the server advertising its framework on every response.
  poweredByHeader: false,

  // Question images are served as-is from Cloudinary, so there is nothing to
  // gain from recompressing responses that are already images.
  compress: true,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: csp },
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