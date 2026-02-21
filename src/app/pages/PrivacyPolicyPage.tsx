import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 21, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Information We Collect</h2>
            <p>When you use RoingRent, we collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Account Information:</strong> Name, email address, and profile photo provided via Google Sign-In.</li>
              <li><strong>Property Listings:</strong> Details you submit when listing a property, including address, photos, and contact number.</li>
              <li><strong>Usage Data:</strong> Pages visited, search queries, and interactions with listings.</li>
              <li><strong>Device Information:</strong> Browser type, IP address, and operating system for security and analytics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Create and manage your account.</li>
              <li>Display your property listings to potential tenants.</li>
              <li>Facilitate communication between owners and tenants.</li>
              <li>Improve our platform and user experience.</li>
              <li>Send transactional emails and notifications.</li>
              <li>Prevent fraud and ensure platform security.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Sharing of Information</h2>
            <p>We do not sell your personal information. We may share data with:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong>Service Providers:</strong> Supabase (database), Cloudinary (image hosting), who process data on our behalf.</li>
              <li><strong>Other Users:</strong> Owner contact details are visible to logged-in users who view a listing.</li>
              <li><strong>Legal Obligations:</strong> When required by law or to protect rights and safety.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Security</h2>
            <p>We implement industry-standard security measures including HTTPS encryption, secure database access controls, and regular security audits to protect your data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction or deletion of your data.</li>
              <li>Withdraw consent for data processing.</li>
              <li>Export your data in a portable format.</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us at <a href="mailto:support@roingrent.com" className="text-indigo-600 hover:underline">support@roingrent.com</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Cookies</h2>
            <p>We use cookies to maintain sessions and improve performance. See our <a href="/cookie-policy" className="text-indigo-600 hover:underline">Cookie Policy</a> for details.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Changes to This Policy</h2>
            <p>We may update this policy from time to time. We'll notify you of significant changes via email or an in-app notice. Continued use of RoingRent after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact:</p>
            <div className="mt-2 bg-gray-100 rounded-lg p-4 text-sm">
              <p className="font-semibold">RoingRent</p>
              <p>Email: <a href="mailto:support@roingrent.com" className="text-indigo-600 hover:underline">support@roingrent.com</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
