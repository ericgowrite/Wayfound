import LegalPage from "@/components/LegalPage";

export const metadata = { title: "Terms of Service — Viya" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="May 5, 2026"
      sections={[
        {
          heading: "Agreement to Terms",
          body: (
            <p>By accessing or using Viya, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.</p>
          ),
        },
        {
          heading: "Description of Service",
          body: (
            <p>Viya is a travel discovery application that uses personality-based matching to help users find travel experiences suited to their preferences, including a travel style assessment, personalized search and scoring, fit explanations, and tools to save and compare options.</p>
          ),
        },
        {
          heading: "Use of the Service",
          body: (
            <>
              <p><strong className="text-gray-800 dark:text-gray-200">Eligibility:</strong> You must be at least 13 years old to use Viya.</p>
              <p><strong className="text-gray-800 dark:text-gray-200">Acceptable use:</strong> You agree to use Viya only for lawful purposes. You may not attempt to interfere with the app&apos;s functionality, access data not intended for you, use automated systems (bots, scrapers) to access the app, or misrepresent your identity.</p>
              <p><strong className="text-gray-800 dark:text-gray-200">User content:</strong> You retain ownership of any content you provide (profile info, notes, saved preferences) but grant us a license to use it to provide and improve the service.</p>
            </>
          ),
        },
        {
          heading: "Intellectual Property",
          body: (
            <>
              <p>The app, including its design, features, and underlying technology, is owned by Viya and protected by intellectual property laws. Our specific implementation, scoring methodology, axis definitions, and travel matching algorithms are proprietary.</p>
              <p>Travel information in search results may be sourced from third parties and subject to their respective copyrights.</p>
            </>
          ),
        },
        {
          heading: "Third-Party Services",
          body: (
            <>
              <p><strong className="text-gray-800 dark:text-gray-200">Booking partners:</strong> When you click booking links, you leave Viya and enter a third-party site. Your interactions are governed by that site&apos;s terms and privacy policy. We are not responsible for third-party content, policies, or practices. We may receive a commission from bookings, which does not affect your price.</p>
              <p><strong className="text-gray-800 dark:text-gray-200">AI services:</strong> We use Google&apos;s Gemini API to process searches. Your use of these features is also subject to{" "}
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Google&apos;s Terms of Service</a>.
              </p>
            </>
          ),
        },
        {
          heading: "Disclaimers",
          body: (
            <>
              <p><strong className="text-gray-800 dark:text-gray-200">No guarantee of accuracy:</strong> Travel information is provided for informational purposes only. We do not guarantee the accuracy of pricing, availability, hours, descriptions, or ratings. Always verify details directly with travel providers before booking.</p>
              <p><strong className="text-gray-800 dark:text-gray-200">Personality assessment:</strong> The travel style assessment is intended for personalization purposes. It is not a clinical psychological assessment. Results are suggestions, not prescriptions.</p>
              <p>Viya is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied.</p>
            </>
          ),
        },
        {
          heading: "Limitation of Liability",
          body: (
            <p>To the fullest extent permitted by law, Viya and its owners shall not be liable for any indirect, incidental, special, or consequential damages, including loss of profits, data, or goodwill, travel experiences that do not meet expectations, or actions of third-party booking partners.</p>
          ),
        },
        {
          heading: "Governing Law",
          body: (
            <p>These Terms shall be governed by the laws of the State of California, United States. Disputes shall be resolved through binding arbitration under the American Arbitration Association. You waive any right to a jury trial or class action.</p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>Questions about these Terms? Email us at <a href="mailto:support@viyaway.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@viyaway.com</a></p>
          ),
        },
      ]}
    />
  );
}
