import Link from "next/link";
import HeroVideoCarousel from "@/components/HeroVideoCarousel";

const HOW_IT_WORKS = [
  { num: "1", title: "Tell us who you are", desc: "A few questions, not a form. Two minutes, and we've got your type." },
  { num: "2", title: "Search like you would with a friend", desc: "Stays, restaurants, activities, tours — one search, every category." },
  { num: "3", title: "Get the why, not just the what", desc: "Every result comes with a one-line reason it's yours. No stars. No guessing." },
  { num: "4", title: "Bring everyone along", desc: "Add who's coming. Results account for the whole group, not just you." },
];

const WHY = [
  { title: "Judgment, not popularity", desc: "We tell you why a place fits — not how many people liked it." },
  { title: "Built for planning together", desc: "Invite the people coming with you — results fit the whole group." },
  { title: "Every kind of experience", desc: "Stays, restaurants, activities, tours, and attractions — one search." },
  { title: "Free, always", desc: "No hidden costs, no upsell — just better fit." },
];

const TRUST_SIGNALS = ["No credit card", "Free, always", "Built for planning together"];

export default function LandingPage() {
  const encodeSemi = "var(--font-encode-semi), ui-sans-serif, system-ui, sans-serif";
  const encode = "var(--font-encode), ui-sans-serif, system-ui, sans-serif";
  const notoSerif = "var(--font-noto-serif), Georgia, ui-serif, serif";
  const permanentMarker = "var(--font-permanent-marker), cursive";

  return (
    <div style={{ fontFamily: encode, color: "#1A1A1A", background: "#FAF8F5", minHeight: "100vh" }}>
      <style>{`
        .v5-card { transition: border-color 200ms ease; }
        .v5-card:hover { border-color: #C4956A !important; }
      `}</style>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "rgba(250,248,245,0.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid #E8E8E8" }}>
        <div className="max-w-[1200px] mx-auto px-5 md:px-10 flex justify-between items-center py-[18px]">
          <div style={{ fontFamily: "var(--font-lexend-giga), ui-sans-serif, sans-serif", fontWeight: 400, fontSize: 18, color: "#2C3E50", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            WAY<span style={{ color: "#C4956A" }}>FOUND</span>
          </div>
          <div className="flex items-center gap-5 md:gap-7">
            <Link href="/login" className="hidden sm:block" style={{ fontFamily: encodeSemi, fontSize: 15, fontWeight: 400, color: "#3D5A73", textDecoration: "none" }}>
              Log in
            </Link>
            <Link
              href="/dashboard"
              style={{ fontFamily: encodeSemi, fontSize: 15, fontWeight: 600, background: "#C4956A", color: "#fff", padding: "10px 20px", borderRadius: 9999, textDecoration: "none", display: "inline-block" }}
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          height: "100vh",
          minHeight: 640,
          background: "#2C3E50",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <HeroVideoCarousel />
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2 }} />
        <div className="relative px-[8%] max-w-[900px]" style={{ zIndex: 3 }}>
          <p style={{ fontFamily: permanentMarker, fontSize: "clamp(36px, 6vw, 80px)", fontWeight: 400, color: "#FFFFFF", lineHeight: 1.15, margin: 0, textTransform: "none" }}>
            Travel that fits<br />who you are.
          </p>
          <Link
            href="/dashboard"
            style={{
              display: "inline-block",
              marginTop: 36,
              fontFamily: encodeSemi,
              fontSize: 15,
              fontWeight: 600,
              background: "#C4956A",
              color: "#fff",
              padding: "16px 32px",
              borderRadius: 12,
              textDecoration: "none",
            }}
          >
            Get started — it&apos;s free
          </Link>
          <div className="flex flex-wrap gap-4 md:gap-6 mt-4">
            {TRUST_SIGNALS.map((label) => (
              <span key={label} style={{ fontFamily: encode, fontSize: 13, color: "rgba(255,255,255,0.70)" }}>
                ✓ {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto px-5 md:px-10 py-12 md:py-20">
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{ fontFamily: encodeSemi, fontSize: 14, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3D5A73", margin: 0 }}>
            How it works
          </p>
          <h2 style={{ fontFamily: notoSerif, fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 600, color: "#2C3E50", lineHeight: 1.3, marginTop: 12, marginBottom: 0 }}>
            A trusted friend, not a search engine.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {HOW_IT_WORKS.map(({ num, title, desc }) => (
            <div
              key={num}
              className="v5-card"
              style={{
                background: "#FAF8F5",
                border: "1px solid #E8E8E8",
                borderRadius: 12,
                padding: "32px 24px",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#2C3E50", color: "#fff", fontSize: 14, fontFamily: encodeSemi, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {num}
              </div>
              <h3 style={{ fontFamily: notoSerif, fontSize: 18, fontWeight: 600, color: "#2C3E50", marginTop: 16, marginBottom: 0, lineHeight: 1.3 }}>
                {title}
              </h3>
              <p style={{ fontFamily: encode, fontSize: 15, color: "#3D5A73", marginTop: 8, lineHeight: 1.6, marginBottom: 0 }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why Wayfound ──────────────────────────────────────────────────────── */}
      <section className="px-5 md:px-10 py-12 md:py-20" style={{ background: "#2C3E50" }}>
        <div className="max-w-[1200px] mx-auto text-center">
          <h2 style={{ fontFamily: encodeSemi, fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 400, color: "#FFFFFF", lineHeight: 1.3, marginTop: 0, marginBottom: 40 }}>
            Why Wayfound?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
            {WHY.map(({ title, desc }) => (
              <div key={title} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "24px", textAlign: "left" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#C4956A", marginTop: 1 }}>✓</span>
                  <div>
                    <p style={{ fontFamily: notoSerif, fontSize: 17, fontWeight: 600, color: "#FFFFFF", margin: 0, lineHeight: 1.3 }}>
                      {title}
                    </p>
                    <p style={{ fontFamily: encode, fontSize: 14, color: "rgba(255,255,255,0.65)", marginTop: 6, lineHeight: 1.6, marginBottom: 0 }}>
                      {desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="max-w-[720px] mx-auto px-5 md:px-10 py-16 md:py-24 text-center">
        <h2 style={{ fontFamily: notoSerif, fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 400, color: "#2C3E50", lineHeight: 1.3, marginTop: 0, marginBottom: 32 }}>
          Ready to find what fits?
        </h2>
        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
            fontFamily: encodeSemi,
            fontSize: 15,
            fontWeight: 600,
            background: "#C4956A",
            color: "#fff",
            padding: "16px 36px",
            borderRadius: 32,
            textDecoration: "none",
          }}
        >
          Get started — it&apos;s free
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E8E8E8] px-5 md:px-10 py-6">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center flex-wrap gap-3">
          <span style={{ fontFamily: encodeSemi, fontSize: 13, color: "#3D5A73", fontWeight: 400 }}>
            © 2026 Wayfound
          </span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/privacy" style={{ fontFamily: encode, fontSize: 13, color: "#3D5A73", textDecoration: "none" }}>Privacy</Link>
            <Link href="/terms" style={{ fontFamily: encode, fontSize: 13, color: "#3D5A73", textDecoration: "none" }}>Terms</Link>
            <Link href="/affiliate-disclosure" style={{ fontFamily: encode, fontSize: 13, color: "#3D5A73", textDecoration: "none" }}>Affiliate disclosure</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
