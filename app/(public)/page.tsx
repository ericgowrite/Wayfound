import Link from "next/link";

/* ── Inline SVG illustration ───────────────────────────────────────────────── */

function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Sky gradient */}
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B8D4E3" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#F8FAFB" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sunGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8A87C" />
          <stop offset="100%" stopColor="#F0C4A0" />
        </linearGradient>
      </defs>

      {/* Background wash */}
      <rect width="480" height="400" fill="url(#sky)" rx="24" />

      {/* Far mountains */}
      <path d="M0 320 L60 220 L120 270 L180 190 L240 240 L300 180 L360 230 L420 200 L480 260 L480 400 L0 400Z" fill="#B8D4E3" opacity="0.4" />

      {/* Mid mountains */}
      <path d="M0 340 L80 260 L140 300 L200 240 L260 280 L340 220 L400 270 L480 240 L480 400 L0 400Z" fill="#5B8BA0" opacity="0.35" />

      {/* Near mountains */}
      <path d="M0 360 L70 300 L160 330 L230 280 L310 320 L380 290 L480 330 L480 400 L0 400Z" fill="#3D5A6E" opacity="0.5" />

      {/* Sun / destination circle */}
      <circle cx="360" cy="120" r="56" fill="url(#sunGlow)" opacity="0.85" />
      <circle cx="360" cy="120" r="46" fill="#E8A87C" opacity="0.4" />

      {/* Winding path */}
      <path
        d="M120 390 C140 350, 160 340, 180 330 C210 315, 200 290, 230 275 C260 260, 250 240, 280 220 C310 200, 320 180, 350 150"
        stroke="#E8A87C"
        strokeWidth="3"
        strokeDasharray="8 6"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />

      {/* Small accent dots along path */}
      <circle cx="180" cy="330" r="4" fill="#E8A87C" opacity="0.6" />
      <circle cx="230" cy="275" r="4" fill="#5B8BA0" opacity="0.6" />
      <circle cx="280" cy="220" r="4" fill="#E8A87C" opacity="0.6" />
      <circle cx="350" cy="150" r="5" fill="#5B8BA0" opacity="0.8" />

      {/* Subtle clouds */}
      <ellipse cx="100" cy="100" rx="50" ry="14" fill="white" opacity="0.5" />
      <ellipse cx="260" cy="70" rx="40" ry="10" fill="white" opacity="0.4" />
    </svg>
  );
}

/* ── Step card icons (simple geometric) ────────────────────────────────────── */

const STEPS = [
  { num: "1", title: "Discover your travel style", desc: "Take a quick 5-minute quiz to reveal your travel personality", color: "bg-[#5B8BA0]" },
  { num: "2", title: "Search destinations", desc: "Find hotels, tours, restaurants, and activities worldwide", color: "bg-[#E8A87C]" },
  { num: "3", title: "See your fit score", desc: "Results ranked by how well they match you — not popularity", color: "bg-[#5B8BA0]" },
  { num: "4", title: "Book with confidence", desc: "Save, compare, and plan trips that actually feel right", color: "bg-[#E8A87C]" },
];

const BENEFITS = [
  { title: "Based on you", desc: "Not generic reviews" },
  { title: "Personality-matched", desc: "Fit scores built from how you're wired" },
  { title: "Group travel ready", desc: "See fit for everyone" },
  { title: "Always free", desc: "No hidden costs" },
];

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFB] text-[#2C3E50]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <span className="text-lg font-bold tracking-tight text-[#3D5A6E]">ViyaWay</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-[#6B8299] hover:text-[#2C3E50] transition-colors">
            Log in
          </Link>
          <Link
            href="/dashboard"
            className="text-sm px-5 py-2 bg-[#5B8BA0] text-white rounded-full hover:bg-[#4A7A8F] transition-colors font-medium"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-12 sm:pt-20 pb-16">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Text */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight text-[#2C3E50]">
              Your true path to travel
            </h1>
            <p className="mt-4 text-lg text-[#6B8299] max-w-lg mx-auto lg:mx-0">
              No more endless scrolling or relying on reviews that aren&apos;t right for you. ViyaWay matches destinations to your personality.
            </p>
            <div className="mt-8">
              <Link
                href="/dashboard"
                className="inline-block px-8 py-3.5 bg-[#5B8BA0] text-white rounded-full hover:bg-[#4A7A8F] transition-colors text-base font-semibold shadow-lg shadow-[#5B8BA0]/20"
              >
                Get started — it&apos;s free
              </Link>
            </div>
            {/* Trust indicators */}
            <div className="mt-6 flex items-center gap-4 justify-center lg:justify-start text-xs text-[#6B8299]">
              <span className="flex items-center gap-1"><span className="text-[#E8A87C]">&#10003;</span> No credit card</span>
              <span className="flex items-center gap-1"><span className="text-[#E8A87C]">&#10003;</span> 5-minute setup</span>
              <span className="flex items-center gap-1"><span className="text-[#E8A87C]">&#10003;</span> Free forever</span>
            </div>
          </div>

          {/* Illustration */}
          <div className="flex-1 w-full max-w-md lg:max-w-none">
            <HeroIllustration className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-[#EEF4F8]">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8A87C] text-center mb-3">
            How it works
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-[#2C3E50] mb-12">
            Travel that fits who you are
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div
                key={s.num}
                className="bg-white rounded-xl border border-[#E0E8ED] p-6 text-center hover:shadow-md transition-shadow"
              >
                <div
                  className={`w-10 h-10 rounded-full ${s.color} text-white flex items-center justify-center text-sm font-bold mx-auto mb-4`}
                >
                  {s.num}
                </div>
                <h3 className="font-semibold text-sm text-[#2C3E50] mb-1">{s.title}</h3>
                <p className="text-sm text-[#6B8299]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why ViyaWay — dark section */}
      <section className="py-20 bg-[#3D5A6E]">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-12">
            Why ViyaWay?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="flex items-start gap-3 p-5 rounded-xl bg-white/10 border border-white/10"
              >
                <span className="text-[#E8A87C] mt-0.5 flex-shrink-0 text-lg">&#10003;</span>
                <div>
                  <p className="font-semibold text-white text-sm">{b.title}</p>
                  <p className="text-sm text-white/70 mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-[#F8FAFB]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#2C3E50] mb-6">
            Ready to find your path?
          </h2>
          <Link
            href="/dashboard"
            className="inline-block px-8 py-3.5 bg-[#5B8BA0] text-white rounded-full hover:bg-[#4A7A8F] transition-colors text-base font-semibold shadow-lg shadow-[#5B8BA0]/20"
          >
            Start your journey
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E0E8ED] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B8299]">
          <p>&copy; 2026 ViyaWay</p>
          <div className="flex items-center gap-1">
            <Link href="/privacy" className="hover:text-[#2C3E50] transition-colors">Privacy Policy</Link>
            <span className="mx-1.5">&bull;</span>
            <Link href="/terms" className="hover:text-[#2C3E50] transition-colors">Terms of Service</Link>
            <span className="mx-1.5">&bull;</span>
            <Link href="/affiliate-disclosure" className="hover:text-[#2C3E50] transition-colors">How We Make Money</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
