import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getQuizById, getUserById } from "@/lib/queries/data";
import ShareActions from "@/components/ShareActions";
import { IconArrowLeft, IconCheck } from "@/components/Icon";

export default async function ShareQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  const { id } = await params;
  const quiz = await getQuizById(id);
  if (!quiz) notFound();
  if (quiz.userId !== user.id) notFound();

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const shareLink = `${baseUrl}/play/${quiz.shareUuid}`;

  // The QR block that used to live here was `qr-placeholder` — a decorative
  // checkerboard with two fake finder squares and the caption "Scan QR atau
  // copy link di bawah". It was not a QR code and never encoded the link, so
  // it actively invited a scan that could only fail. Removed in favour of the
  // real link + real share targets below.

  return (
    <>
      <div className="bg-aurora bg-aurora-share" aria-hidden="true" />
      <div className="shell-mobile-full" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <header className="page-header" style={{ background: "rgba(255,255,255,0.12)", borderBottom: "1px solid rgba(255,255,255,0.18)", color: "#fff" }}>
          <Link href={`/quiz/${quiz.id}`} className="back" style={{ color: "#fff" }} aria-label="Kembali">
            <IconArrowLeft size={20} />
          </Link>
          <h1 style={{ fontSize: 14 }}>Bagikan Kuis</h1>
          <div style={{ width: 36 }} />
        </header>

        <main
          className="animate-fade-in"
          style={{
            flex: 1,
            padding: "32px 16px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            color: "#fff",
          }}
        >
          <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
            {/* Success indicator */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                border: "1px solid rgba(255,255,255,0.24)",
              }}
            >
              <IconCheck size={40} />
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
              Kuis siap dishare!
            </h2>
            <p style={{ opacity: 0.92, marginBottom: 28, fontSize: 15 }}>
              Kirim link ini ke anak, lalu dia bisa langsung kerjakan.
            </p>

            <ShareActions shareUrl={shareLink} title={quiz.title} />
          </div>
        </main>
      </div>
    </>
  );
}
