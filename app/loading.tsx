import { MobileFrame } from "@/components/MobileFrame";

export default function Loading() {
  return (
    <MobileFrame>
      <main
        style={{
          minHeight: "100vh",
          padding: 24,
        }}
      >
        <div className="skeleton skeleton-text lg" />
        <div className="skeleton skeleton-text md" />
        <div className="skeleton skeleton-text md" style={{ width: "60%" }} />
        <div style={{ marginTop: 32 }}>
          <div className="skeleton" style={{ height: 80, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 80, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 80 }} />
        </div>
      </main>
    </MobileFrame>
  );
}
