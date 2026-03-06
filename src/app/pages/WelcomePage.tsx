import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';

type Role = 'tenant' | 'owner' | 'both';

const BHK_OPTIONS = ['1BHK', '2BHK', '3BHK', '4BHK+'];

const STEPS = [
  { id: 1, title: 'Your Role', subtitle: 'Are you looking to rent or list a property?' },
  { id: 2, title: 'Your City',  subtitle: 'Which city are you based in?' },
  { id: 3, title: 'Preferences', subtitle: 'Help us personalise your experience' },
];

export function WelcomePage() {
  const navigate   = useNavigate();
  const { user, profile, profileLoading } = useApp();

  const [step, setStep]             = useState(1);
  const [role, setRole]             = useState<Role | null>(null);
  const [city, setCity]             = useState('');
  const [phone, setPhone]           = useState('');
  const [bhkFilters, setBhkFilters] = useState<string[]>([]);
  const [maxBudget, setMaxBudget]   = useState('');
  const [isSaving, setIsSaving]     = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!profileLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [profileLoading, user, navigate]);

  // Already completed onboarding — skip to home
  useEffect(() => {
    if (!profileLoading && profile?.onboarding_complete) {
      navigate('/', { replace: true });
    }
  }, [profileLoading, profile, navigate]);

  const handleNext = () => {
    if (step === 1 && !role) {
      toast.error('Please select your role to continue');
      return;
    }
    if (step === 2 && !city.trim()) {
      toast.error('Please enter your city');
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  const handleComplete = async () => {
    if (!user) return;

    const phoneDigits = phone.replace(/[^0-9]/g, '');
    if (phone.trim() && phoneDigits.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          role,
          city: city.trim(),
          phone: phoneDigits.length >= 10 ? phoneDigits : null,
          onboarding_complete: true,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Welcome to TownHall! 🎉');

      // Owners go to list their first property; tenants/both go to listings
      navigate(role === 'owner' ? '/add-property' : '/', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleBhk = (bhk: string) => {
    setBhkFilters((prev) =>
      prev.includes(bhk) ? prev.filter((b) => b !== bhk) : [...prev, bhk],
    );
  };

  if (profileLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`h-2 rounded-full transition-all duration-300 ${
                s.id === step
                  ? 'w-8 bg-indigo-600'
                  : s.id < step
                  ? 'w-2 bg-indigo-300'
                  : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <Card className="p-8 shadow-xl border-0">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-1">
              Step {step} of {STEPS.length}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">{STEPS[step - 1].title}</h1>
            <p className="text-gray-500 mt-1">{STEPS[step - 1].subtitle}</p>
          </div>

          {/* ── Step 1: Role ── */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['tenant', 'owner', 'both'] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    role === r
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-indigo-300 text-gray-700'
                  }`}
                >
                  <div className="text-3xl mb-2">
                    {r === 'tenant' ? '🏠' : r === 'owner' ? '🏢' : '⚡'}
                  </div>
                  <p className="font-semibold capitalize">{r}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {r === 'tenant'
                      ? 'Find a home to rent'
                      : r === 'owner'
                      ? 'List your property'
                      : 'Both rent & list'}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2: City ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bangalore, Mumbai, Pune"
                  className="mt-1 text-base"
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-500">
                We'll show you listings relevant to your city by default.
              </p>
            </div>
          )}

          {/* ── Step 3: Preferences ── */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Phone */}
              <div>
                <Label htmlFor="phone">
                  Phone Number
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used so owners can contact you directly. Never shown publicly.
                </p>
              </div>

              {/* BHK preference (tenants / both only) */}
              {role !== 'owner' && (
                <div>
                  <Label>BHK Preference</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {BHK_OPTIONS.map((bhk) => (
                      <button
                        key={bhk}
                        type="button"
                        onClick={() => toggleBhk(bhk)}
                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                          bhkFilters.includes(bhk)
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-gray-300 text-gray-600 hover:border-indigo-300'
                        }`}
                      >
                        {bhk}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Max budget (tenants / both only) */}
              {role !== 'owner' && (
                <div>
                  <Label htmlFor="budget">
                    Max Monthly Budget (₹)
                    <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  </Label>
                  <Input
                    id="budget"
                    type="number"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value)}
                    placeholder="25000"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex gap-3">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="flex-1"
              >
                Back
              </Button>
            )}
            {step < STEPS.length ? (
              <Button
                type="button"
                onClick={handleNext}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleComplete}
                disabled={isSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSaving ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2" />
                ) : null}
                {role === 'owner' ? 'List My Property →' : 'Find Homes →'}
              </Button>
            )}
          </div>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          By continuing you agree to our{' '}
          <a href="/terms-of-service" className="underline hover:text-gray-600">Terms</a>
          {' '}and{' '}
          <a href="/privacy-policy" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
