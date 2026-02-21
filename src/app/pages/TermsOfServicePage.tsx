import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

export function TermsOfServicePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 21, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using RoingRent ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Eligibility</h2>
            <p>You must be at least 18 years of age to use RoingRent. By using the platform, you represent that you meet this requirement and have the legal capacity to enter into agreements.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. User Accounts</h2>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>You are responsible for maintaining the confidentiality of your account.</li>
              <li>You agree to provide accurate and up-to-date information.</li>
              <li>You must notify us immediately of any unauthorized use of your account.</li>
              <li>One person may not maintain more than one account for deceptive purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Property Listings</h2>
            <p>As a property owner, you agree that:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>All listing information is accurate and truthful.</li>
              <li>You have the legal right to rent the listed property.</li>
              <li>Photos and descriptions genuinely represent the property.</li>
              <li>You will not post duplicate listings for the same property.</li>
              <li>You will promptly remove listings that are no longer available.</li>
              <li>Contact details shared are valid and actively monitored.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Prohibited Activities</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Post false, misleading, or fraudulent listings.</li>
              <li>Harass, threaten, or discriminate against other users.</li>
              <li>Use the platform for any unlawful purpose.</li>
              <li>Scrape, crawl, or extract data without written permission.</li>
              <li>Attempt to circumvent the platform to conduct transactions off-platform to avoid fees.</li>
              <li>Upload malicious code, viruses, or harmful content.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Fees and Payments</h2>
            <p>RoingRent charges a listing fee to activate property listings. All fees are clearly displayed before payment. Fees are non-refundable once the listing is activated, unless the listing is rejected by our moderation team.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Limitation of Liability</h2>
            <p>RoingRent is a listing platform and is not a party to any rental agreements between owners and tenants. We are not responsible for:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>The accuracy of listing information provided by owners.</li>
              <li>Disputes between owners and tenants.</li>
              <li>Any losses arising from use of the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Termination</h2>
            <p>We reserve the right to suspend or terminate accounts that violate these terms, at our sole discretion, without prior notice. You may also delete your account at any time.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes to Terms</h2>
            <p>We may modify these Terms at any time. Continued use of the platform after changes constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact</h2>
            <div className="bg-gray-100 rounded-lg p-4 text-sm mt-2">
              <p className="font-semibold">RoingRent</p>
              <p>Email: <a href="mailto:support@roingrent.com" className="text-indigo-600 hover:underline">support@roingrent.com</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
