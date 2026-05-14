import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Privacy Policy — ViyaWay" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="May 5, 2026"
      sections={[
        {
          heading: "Overview",
          body: (
            <p>
              ViyaWay is a travel discovery application that helps users find travel experiences matched to their personality and preferences.
              This Privacy Policy explains how we collect, use, and protect your information.
            </p>
          ),
        },
        {
          heading: "Information We Collect",
          body: (
            <>
              <p><strong className="text-[#2C3E50] dark:text-[#B8D4E3]">Information you provide:</strong> Name, travel style preferences, and axis weights you set or we determine through the travel style assessment; search queries; saved options; and any notes you add.</p>
              <p><strong className="text-[#2C3E50] dark:text-[#B8D4E3]">Information collected automatically:</strong> Usage data (searches, saves, rejects), device information (browser type, OS, screen resolution for display purposes), and preferences stored locally on your device.</p>
              <p><strong className="text-[#2C3E50] dark:text-[#B8D4E3]">Information from third parties:</strong> When you search, we retrieve publicly available information about travel options. Your search queries and profile preferences are sent to Google&apos;s Gemini API to score and rank options.</p>
            </>
          ),
        },
        {
          heading: "How We Use Your Information",
          body: (
            <>
              <p>We use your information to personalize results, improve recommendations, provide the service, and improve the app.</p>
              <p>We do <strong className="text-[#2C3E50] dark:text-[#B8D4E3]">not</strong> sell your personal information, share your profile or search history with advertisers, or use your data for purposes unrelated to providing and improving the service.</p>
            </>
          ),
        },
        {
          heading: "Third-Party Services",
          body: (
            <>
              <p><strong className="text-[#2C3E50] dark:text-[#B8D4E3]">Google Gemini API:</strong> We use Google&apos;s Gemini API to process searches and score travel options. Your query and profile preferences are sent to Google&apos;s servers and processed according to their{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline">Privacy Policy</a>.
              </p>
              <p><strong className="text-[#2C3E50] dark:text-[#B8D4E3]">Affiliate partners:</strong> When you click &ldquo;Book&rdquo; links, you may be directed to Booking.com, Viator, GetYourGuide, Tripadvisor, or Hotels.com. These partners have their own privacy policies. We may earn a commission from bookings, which does not affect your price.</p>
            </>
          ),
        },
        {
          heading: "Data Storage",
          body: (
            <>
              <p>Your profile, preferences, and saved options are stored locally on your device. We do not maintain user accounts or store your personal data on our servers.</p>
              <p>Local data remains on your device until you clear it. We may retain anonymized, aggregated usage data to improve the service. Your data is not currently synced to the cloud.</p>
            </>
          ),
        },
        {
          heading: "Your Rights and Choices",
          body: (
            <>
              <p>You can view, edit, or delete your data within the app at any time. You can decline automatic profile adjustments when prompted, and clear your search and save history at any time.</p>
            </>
          ),
        },
        {
          heading: "Children's Privacy",
          body: (
            <p>ViyaWay is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13.</p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>Questions about this Privacy Policy? Email us at <a href="mailto:support@viyaway.com" className="text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline">support@viyaway.com</a></p>
          ),
        },
      ]}
    />
  );
}
