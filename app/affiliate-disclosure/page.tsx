import LegalPage from "@/components/LegalPage";

export const metadata = { title: "How We Make Money — Viya" };

export default function AffiliatePage() {
  return (
    <LegalPage
      title="How We Make Money"
      lastUpdated="May 5, 2026"
      sections={[
        {
          heading: "The Short Version",
          body: (
            <p>Viya is free to use. When you click a booking link and complete a purchase on a partner site, we may receive a small commission — at no additional cost to you. The price you pay is identical whether you use our link or go directly to the site.</p>
          ),
        },
        {
          heading: "Our Affiliate Partners",
          body: (
            <>
              <p>We currently partner with:</p>
              <ul className="space-y-1.5 mt-2">
                {[
                  ["Booking.com", "Hotels and accommodations"],
                  ["Viator", "Tours and activities"],
                  ["GetYourGuide", "Tours and activities"],
                  ["Tripadvisor", "Hotels, restaurants, and attractions"],
                  ["Hotels.com", "Hotels and accommodations"],
                ].map(([name, desc]) => (
                  <li key={name} className="flex gap-2">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{name}</span>
                    <span className="text-gray-400">—</span>
                    <span>{desc}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-gray-400 dark:text-gray-500 text-xs">This list may be updated as we add new partners.</p>
            </>
          ),
        },
        {
          heading: "Our Commitment to You",
          body: (
            <>
              <p><strong className="text-gray-800 dark:text-gray-200">Recommendations are independent.</strong> Our fit scores are calculated based on your personality profile and preferences — not on which options pay us the highest commission.</p>
              <p>We will never rank an option higher because it pays more, hide better-fit options to promote partners, or let affiliate relationships influence our scoring algorithm.</p>
              <p><strong className="text-gray-800 dark:text-gray-200">Transparency.</strong> Affiliate booking links are clearly labeled with partner names. Our scoring methodology is identical for all options, affiliate or not.</p>
            </>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>Questions about our affiliate relationships? Email us at <a href="mailto:support@viyaway.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@viyaway.com</a></p>
          ),
        },
      ]}
    />
  );
}
