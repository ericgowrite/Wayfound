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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top nav */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            ← Viya
          </Link>
          <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <Link href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Terms</Link>
            <Link href="/affiliate-disclosure" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">How We Make Money</Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && <p className="text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
          {lastUpdated && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Last updated: {lastUpdated}</p>}
        </div>

        <div className="space-y-8">
          {sections.map((s, i) => (
            <div key={i}>
              {s.heading && (
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">
                  {s.heading}
                </h2>
              )}
              <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed space-y-3">
                {s.body}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            Viya may earn a commission from bookings. This doesn&apos;t affect our recommendations.
          </p>
          <div className="flex justify-center gap-4 text-xs text-gray-400 dark:text-gray-500">
            <Link href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms of Service</Link>
            <span>·</span>
            <Link href="/affiliate-disclosure" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">How We Make Money</Link>
          </div>
          <p className="text-xs text-gray-300 dark:text-gray-700 mt-3">© 2026 ViyaWay.com</p>
        </div>
      </div>
    </div>
  );
}
