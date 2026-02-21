import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';

export function CookiePolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 text-gray-600">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 21, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. What Are Cookies?</h2>
            <p>Cookies are small text files stored on your device when you visit a website. They help the site remember your preferences and improve your experience. RoingRent uses cookies and similar technologies (such as local storage) to operate the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Types of Cookies We Use</h2>

            <div className="space-y-4 mt-3">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-1">Essential Cookies</h3>
                <p className="text-sm">Required for the platform to function. These include authentication tokens that keep you logged in and session identifiers. These cannot be disabled.</p>
                <p className="text-xs text-gray-500 mt-1">Examples: Supabase auth token, session storage</p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-1">Functional Cookies</h3>
                <p className="text-sm">Remember your preferences and settings, such as draft property forms, filters, and display preferences.</p>
                <p className="text-xs text-gray-500 mt-1">Examples: propertyDraft (localStorage), filter preferences</p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-1">Analytics Cookies</h3>
                <p className="text-sm">Help us understand how users interact with the platform so we can improve it. Data collected is anonymised.</p>
                <p className="text-xs text-gray-500 mt-1">Examples: Page views, session duration, navigation patterns</p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-1">Third-Party Cookies</h3>
                <p className="text-sm">Some features embed content from third parties that may set their own cookies:</p>
                <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                  <li>OpenStreetMap / Google Maps (location picker and property maps)</li>
                  <li>Cloudinary (image upload widget)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Managing Cookies</h2>
            <p>You can control cookies through your browser settings. Most browsers allow you to:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>View cookies stored on your device.</li>
              <li>Delete all or specific cookies.</li>
              <li>Block cookies from specific websites.</li>
              <li>Block all third-party cookies.</li>
            </ul>
            <p className="mt-3 text-sm text-gray-500">Note: Disabling essential cookies will prevent you from logging in or using core features of RoingRent.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Local Storage</h2>
            <p>In addition to cookies, we use browser local storage to save your property listing drafts. This data is stored only on your device and is never transmitted to our servers until you submit the form. You can clear this data at any time from your browser settings.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Changes to This Policy</h2>
            <p>We may update this Cookie Policy as our use of technologies changes. We will notify users of significant changes via in-app notice.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contact Us</h2>
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
