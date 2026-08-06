import Link from "next/link";

interface Section {
  heading?: string;
  body: React.ReactNode;
}

interface Props {
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  sections: Section[];
}

export default function LegalPage({ title, subtitle, lastUpdated, sections }: Props) {
  return (
    <div className="min-h-screen bg-[#F8FAFB] dark:bg-[#0f1923]">
      {/* Top nav */}
      <div className="border-b border-[#E0E8ED] dark:border-[#2a3f52] bg-white dark:bg-[#1e2d3d]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[#2C3E50] dark:text-white hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors">
            ← Wayfound
          </Link>
          <div className="flex items-center gap-4 text-xs text-[#9BB0C1] dark:text-[#6B8299]">
            <Link href="/privacy" className="hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3] transition-colors">Terms</Link>
            <Link href="/affiliate-disclosure" className="hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3] transition-colors">How We Make Money</Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#2C3E50] dark:text-white">{title}</h1>
          {subtitle && <p className="text-[#6B8299] dark:text-[#9BB0C1] mt-1">{subtitle}</p>}
          {lastUpdated && <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] mt-2">Last updated: {lastUpdated}</p>}
        </div>

        <div className="space-y-8">
          {sections.map((s, i) => (
            <div key={i}>
              {s.heading && (
                <h2 className="text-sm font-semibold text-[#2C3E50] dark:text-white uppercase tracking-wide mb-3">
                  {s.heading}
                </h2>
              )}
              <div className="text-sm text-[#6B8299] dark:text-[#9BB0C1] leading-relaxed space-y-3">
                {s.body}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-[#E0E8ED] dark:border-[#2a3f52] text-center">
          <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] mb-3">
            Wayfound may earn a commission from bookings. This doesn&apos;t affect our recommendations.
          </p>
          <div className="flex justify-center gap-4 text-xs text-[#9BB0C1] dark:text-[#6B8299]">
            <Link href="/privacy" className="hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors">Terms of Service</Link>
            <span>·</span>
            <Link href="/affiliate-disclosure" className="hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors">How We Make Money</Link>
          </div>
          <p className="text-xs text-[#B8D4E3] dark:text-[#3D5A6E] mt-3">© 2026 gowayfound.com</p>
        </div>
      </div>
    </div>
  );
}
