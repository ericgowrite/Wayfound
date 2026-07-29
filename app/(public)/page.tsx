import Link from "next/link";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.5l6.5-6.5C35.2 2.7 30 0.5 24 0.5 14.6 0.5 6.5 5.9 2.6 13.9l7.6 5.9C12.1 13.5 17.5 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.6c-.5 3-2.2 5.5-4.7 7.2l7.3 5.6c4.3-4 6.8-9.8 6.8-17.1z"/>
      <path fill="#FBBC05" d="M10.2 19.8a14.4 14.4 0 0 0 0 8.4l-7.6 5.9a24 24 0 0 1 0-20.2z"/>
      <path fill="#34A853" d="M24 47.5c6 0 11.2-2 14.9-5.3l-7.3-5.6c-2 1.4-4.6 2.2-7.6 2.2-6.5 0-12-4.4-14-10.3l-7.6 5.9C6.5 42.1 14.6 47.5 24 47.5z"/>
    </svg>
  );
}

const HOW_IT_WORKS = [
  { num: "1", bg: "#2C3E50", title: "Tell us how you travel", desc: "A short conversation, not a form — a few questions and we know your type." },
  { num: "2", bg: "#C4956A", title: "Search anything", desc: "Places to stay, restaurants, activities, tours, attractions — one search, every category." },
  { num: "3", bg: "#2C3E50", title: "See why it fits", desc: "A one-line judgment, not a star rating — the reason a place is right for you." },
  { num: "4", bg: "#C4956A", title: "Plan it together", desc: "Invite who's coming — results account for everyone, not just you." },
];

const WHY = [
  { title: "Judgment, not popularity", desc: "We tell you why a place fits — not how many people liked it." },
  { title: "Built for planning together", desc: "Invite the people coming with you — results fit the whole group." },
  { title: "Every kind of experience", desc: "Stays, restaurants, activities, tours, and attractions — one search." },
  { title: "Free, always", desc: "No hidden costs, no upsell — just better fit." },
];

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#1A1A1A", background: "#FFFFFF" }}>

      {/* Nav */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: '"Lora", serif', fontStyle: "italic", fontWeight: 500, fontSize: 22, color: "#2C3E50" }}>
          viya<span style={{ color: "#C4956A" }}>way</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/login" style={{ fontSize: 14, color: "#888888", textDecoration: "none" }}>Log in</Link>
          <Link href="/dashboard" style={{ background: "#2C3E50", color: "#fff", fontSize: 14, fontWeight: 600, padding: "11px 20px", borderRadius: 999, textDecoration: "none", display: "inline-block" }}>
            Get started
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 40px 96px", display: "flex", gap: 56, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 380 }}>
          <div style={{ fontFamily: '"Lora", serif', fontWeight: 600, fontSize: 48, lineHeight: 1.15, color: "#2C3E50" }}>
            Travel that fits who you are.
          </div>
          <div style={{ fontSize: 17, color: "#888888", lineHeight: 1.6, marginTop: 20, maxWidth: 460 }}>
            No more scrolling through reviews that were never written for you.{" "}
            <span style={{ fontFamily: '"Lora", serif', fontStyle: "italic" }}>
              viya<span style={{ color: "#C4956A" }}>way</span>
            </span>{" "}
            learns how you actually travel, and tells you why a place fits — not just that it&apos;s popular.
          </div>
          <Link href="/dashboard" style={{ background: "#2C3E50", color: "#fff", fontSize: 15, fontWeight: 600, padding: "16px 28px", borderRadius: 999, marginTop: 32, display: "inline-block", textDecoration: "none" }}>
            Get started — it&apos;s free
          </Link>
          <div style={{ display: "flex", gap: 28, marginTop: 24, flexWrap: "wrap" }}>
            {[["No credit card"], ["Free, always"], ["Built for planning together"]].map(([label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#888888" }}>
                <span style={{ color: "#C4956A" }}>✓</span>{label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 340, background: "#F5F4F0", borderRadius: 4, height: 420, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 13, color: "#888888" }}>Illustration</span>
        </div>
      </div>

      {/* How it works */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4956A" }}>
          How it works
        </div>
        <div style={{ fontFamily: '"Lora", serif', fontWeight: 600, fontSize: 32, color: "#2C3E50", marginTop: 12 }}>
          A trusted friend, not a search engine.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginTop: 48 }}>
          {HOW_IT_WORKS.map(({ num, bg, title, desc }) => (
            <div key={num} style={{ border: "1px solid #E8E8E8", borderRadius: 4, padding: "32px 24px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: bg, color: "#fff", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                {num}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#2C3E50", marginTop: 16 }}>{title}</div>
              <div style={{ fontSize: 13, color: "#888888", marginTop: 8, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Why ViyaWay */}
      <div style={{ background: "#2C3E50", padding: "72px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: '"Lora", serif', fontWeight: 600, fontSize: 32, color: "#fff" }}>
            Why viya<span style={{ color: "#C4956A" }}>way</span>?
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 40 }}>
            {WHY.map(({ title, desc }) => (
              <div key={title} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, padding: 24, textAlign: "left" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span style={{ color: "#C4956A" }}>✓</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{title}</div>
                    <div style={{ fontSize: 13, color: "#B9C3CC", marginTop: 4 }}>{desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 40px", textAlign: "center" }}>
        <div style={{ fontFamily: '"Lora", serif', fontWeight: 600, fontSize: 32, color: "#2C3E50" }}>
          Ready to find what fits?
        </div>
        <Link href="/dashboard" style={{ background: "#2C3E50", color: "#fff", fontSize: 15, fontWeight: 600, padding: "16px 28px", borderRadius: 999, marginTop: 28, display: "inline-block", textDecoration: "none" }}>
          Get started — it&apos;s free
        </Link>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #E8E8E8", padding: "24px 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#888888", flexWrap: "wrap", gap: 12 }}>
          <span>© 2026 ViyaWay</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/privacy" style={{ color: "#888888", textDecoration: "none" }}>Privacy</Link>
            <Link href="/terms" style={{ color: "#888888", textDecoration: "none" }}>Terms</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
