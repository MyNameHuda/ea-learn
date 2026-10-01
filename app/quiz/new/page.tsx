import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/queries/data";
import { IconArrowLeft } from "@/components/Icon";
import { NewQuizForm } from "@/components/NewQuizForm";

export default async function NewQuizPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await getUserById(session.user.id);
  if (!user) redirect("/login");

  return (
    <>
      <div className="bg-aurora bg-aurora-dashboard" aria-hidden="true" />
      <div
        className="shell-mobile-full"
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <header className="page-header">
          <Link href="/dashboard" className="back" aria-label="Kembali">
            <IconArrowLeft size={20} />
          </Link>
          <h1>Kuis Baru</h1>
          <div style={{ width: 44 }} />
        </header>

        <main
          className="animate-fade-in"
          style={{ flex: 1, padding: "20px 16px 32px" }}
        >
          {/*
            Roadmap, not a wizard. These were four hardcoded dots and four
            labels with no state and no handlers, which read as four clickable
            steps. Only step 1 lives on this page; Soal, Publish and Share
            happen on /quiz/[id]/edit, the publish toggle, and
            /quiz/[id]/share respectively. Now it says so.
          */}
          <ol
            className="wizard-progress"
            style={{ padding: 0, marginBottom: 8, listStyle: "none" }}
          >
            <li className="step-dot active" style={{ width: 56 }} />
            <li className="step-dot" style={{ width: 56 }} />
            <li className="step-dot" style={{ width: 56 }} />
            <li className="step-dot" style={{ width: 56 }} />
          </ol>
          <p
            className="t-soft"
            style={{ textAlign: "center", marginBottom: 24 }}
          >
            Langkah 1 dari 4 &middot; Info kuis. Tambah soal, publish, dan
            share dilakukan di layar berikutnya.
          </p>

          <div style={{ marginBottom: 24 }}>
            <h2 className="h-title" style={{ marginBottom: 6 }}>
              Mulai dari info dasar
            </h2>
            <p className="t-muted">
              Isi detail kuis. Bisa diedit lagi nanti.
            </p>
          </div>

          <NewQuizForm />

          <Link
            href="/dashboard"
            className="btn btn-ghost btn-block"
            style={{ marginTop: 8 }}
          >
            Batal
          </Link>
        </main>
      </div>
    </>
  );
}
