import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

/**
 * Type pairing (v4): Outfit for display, Inter for UI/body.
 *
 * v3 pointed both --font-sans and --font-display at the system stack, so
 * every heading rendered in Segoe UI / SF — the single biggest reason the
 * app read as generic rather than designed.
 *
 * Outfit over Poppins (the usual "friendly education" pick): Poppins' very
 * round counters read dated now, while Outfit keeps the friendly geometry
 * with tighter, more product-like spacing. Inter carries the body/UI text
 * because it stays legible at the 12-15px sizes this app uses heavily.
 *
 * Both self-host via next/font, so there is no external font request and
 * no layout shift.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "EaLearn — Buat soal latihan untuk anak, dalam 5 menit",
  description:
    "Cara tercepat orang tua bikin soal latihan untuk anaknya. Multiple choice & essay, share link, lihat hasil langsung.",
  applicationName: "EaLearn",
  appleWebApp: { capable: true, title: "EaLearn", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "EaLearn — Buat soal latihan untuk anak, dalam 5 menit",
    description:
      "Bikin kuis pilihan ganda & essay, share link ke anak, auto-grade. Tanpa install app.",
    type: "website",
    locale: "id_ID",
  },
  // Was an inline data-URI SVG: a green (#4f6b3a) rounded square with a letter
  // "E" set in a system font. Two things were wrong with it. The colour was
  // from the pre-navy palette, so it did not match anything else in the app.
  // And because it is a data: URI, it was the only icon some browsers chose —
  // the rebuilt app/favicon.ico was being served correctly and never seen,
  // which is why replacing the .ico alone appeared to change nothing.
  //
  // Point at the real file instead. The SVG is preferred by modern browsers
  // and stays sharp on HiDPI displays; app/favicon.ico remains as the raster
  // fallback for anything that does not take SVG.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    // PNG, not the SVG: iOS is the one consumer that still mishandles SVG
    // here, and an apple-touch-icon that fails to render shows a screenshot of
    // the home screen instead of the app's icon.
    apple: [{ url: "/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1b3663",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Lets the sticky bottom bar sit clear of the iPhone home indicator.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} ${outfit.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
