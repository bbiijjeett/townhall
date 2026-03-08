import { useState } from 'react';
import { CheckCircle, Star, Crown, Zap } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../../lib/supabase';
import { loadRazorpayScript } from '../../lib/razorpay';
import type { RazorpayResponse } from '../../lib/razorpay';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

type PlanType = 'free' | 'featured' | 'premium';

interface Plan {
  id: PlanType;
  name: string;
  price: number;
  duration: string;
  durationDays: number;
  description: string;
  features: string[];
  icon: React.ReactNode;
  badgeColor: string;
  buttonLabel: string;
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    duration: '30 days',
    durationDays: 30,
    description: 'Get your property listed and reach tenants',
    features: [
      'Listed for 30 days',
      'Verified Owner Badge',
      'Search visibility',
      'Direct enquiries',
    ],
    icon: <Zap className="w-6 h-6" />,
    badgeColor: 'bg-gray-100 text-gray-700',
    buttonLabel: 'Activate Free',
  },
  {
    id: 'featured',
    name: 'Featured',
    price: 199,
    duration: '30 days',
    durationDays: 30,
    description: 'Stand out in search results',
    features: [
      'Listed for 30 days',
      'Verified Owner Badge',
      '+30 ranking boost',
      'Highlighted in search',
      'Priority support',
    ],
    icon: <Star className="w-6 h-6" />,
    badgeColor: 'bg-indigo-100 text-indigo-700',
    buttonLabel: 'Pay ₹199',
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 499,
    duration: '60 days',
    durationDays: 60,
    description: 'Maximum visibility for twice as long',
    features: [
      'Listed for 60 days',
      'Verified Owner Badge',
      'Top placement in search',
      'Highlighted in search',
      'Priority listing badge',
      'Priority support',
    ],
    icon: <Crown className="w-6 h-6" />,
    badgeColor: 'bg-amber-100 text-amber-700',
    buttonLabel: 'Pay ₹499',
  },
];

export function PaymentPage() {
  const { id: propertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { properties, user, updatePropertyPayment, fetchProperties } = useApp();
  const property = properties.find(p => p.id === propertyId);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [activatingPlan, setActivatingPlan] = useState<PlanType | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successPlan, setSuccessPlan] = useState<PlanType>('free');

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Property Not Found</h2>
          <Button onClick={() => navigate('/owner-dashboard')} className="bg-indigo-600 hover:bg-indigo-700">
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const isRenewal = property.status === 'expired';
  const pageTitle = isRenewal ? 'Renew Your Listing' : 'Choose Your Listing Plan';

  const handleFreePlan = async () => {
    setActivatingPlan('free');
    try {
      await updatePropertyPayment(propertyId!, 'free');
      setSuccessPlan('free');
      setShowSuccessModal(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate listing');
    } finally {
      setActivatingPlan(null);
    }
  };

  const handlePaidPlan = async (planType: 'featured' | 'premium') => {
    setActivatingPlan(planType);
    setIsLoadingPayment(true);
    try {
      // 1. Refresh session — avoids 401 on stale tokens
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Your session has expired. Please sign in again.');
        navigate('/login');
        return;
      }

      // 2. Create Razorpay order server-side
      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        {
          body: { type: 'listing', property_id: propertyId, plan_type: planType },
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (orderError || !orderData?.data) {
        toast.error('Could not initiate payment. Please try again.');
        return;
      }

      const { order_id, amount_paise, key_id } = orderData.data as {
        order_id: string;
        amount_paise: number;
        key_id: string;
      };

      // 3. Load Razorpay checkout.js
      await loadRazorpayScript();
      setIsLoadingPayment(false);

      // 4. Open Razorpay checkout
      const plan = PLANS.find(p => p.id === planType)!;
      const rzp = new window.Razorpay({
        key: key_id,
        amount: amount_paise,
        currency: 'INR',
        order_id,
        name: 'TownHall',
        description: `${plan.name} Listing — ${plan.duration}`,
        notes: { property_id: propertyId!, plan_type: planType },
        handler: async (response: RazorpayResponse) => {
          // 5. Verify payment & activate listing
          const { error: verifyError } = await supabase.functions.invoke('verify-payment', {
            body: {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              property_id: propertyId,
              plan_type: planType,
            },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });

          if (verifyError) {
            toast.error('Payment verification failed. Contact support if amount was deducted.');
            return;
          }

          await fetchProperties();
          setSuccessPlan(planType);
          setShowSuccessModal(true);
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: () => setActivatingPlan(null),
        },
      });

      rzp.open();

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setIsLoadingPayment(false);
      // activatingPlan is cleared by modal.ondismiss or success handler
    }
  };

  const handlePlanSelect = (planType: PlanType) => {
    if (planType === 'free') {
      handleFreePlan();
    } else {
      handlePaidPlan(planType);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    setActivatingPlan(null);
    navigate('/owner-dashboard');
  };

  const successPlanName = PLANS.find(p => p.id === successPlan)?.name ?? 'Free';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{pageTitle}</h1>
          <p className="text-gray-600">Select the plan that best suits your needs for</p>
          <p className="font-semibold text-gray-900">{property.title}</p>
        </div>

        {/* Property summary strip */}
        <Card className="p-4 mb-8 bg-white flex flex-wrap gap-4 items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Location</p>
            <p className="font-medium text-gray-900">{property.location}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Type</p>
            <p className="font-medium text-gray-900">{property.bhk}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Monthly Rent</p>
            <p className="font-medium text-gray-900">₹{property.rent.toLocaleString()}</p>
          </div>
          {isRenewal && (
            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
              Renewal
            </Badge>
          )}
        </Card>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`p-6 flex flex-col relative transition-shadow ${
                plan.highlight
                  ? 'ring-2 ring-indigo-500 shadow-lg'
                  : 'hover:shadow-md'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-indigo-600 text-white hover:bg-indigo-600 text-xs px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${plan.badgeColor}`}>
                  {plan.icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                  <p className="text-xs text-gray-500">{plan.duration}</p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                {plan.price === 0 ? (
                  <p className="text-3xl font-bold text-gray-900">Free</p>
                ) : (
                  <p className="text-3xl font-bold text-gray-900">
                    ₹{plan.price}
                    <span className="text-sm font-normal text-gray-500 ml-1">one-time</span>
                  </p>
                )}
                <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                onClick={() => handlePlanSelect(plan.id)}
                disabled={isLoadingPayment || activatingPlan !== null}
                className={`w-full ${
                  plan.id === 'free'
                    ? 'bg-gray-800 hover:bg-gray-900'
                    : plan.highlight
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-amber-500 hover:bg-amber-600'
                } disabled:opacity-60`}
              >
                {activatingPlan === plan.id ? (
                  <span className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                ) : null}
                {activatingPlan === plan.id ? 'Processing…' : plan.buttonLabel}
              </Button>
            </Card>
          ))}
        </div>

        {/* Skip / pay later */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/owner-dashboard')}
            className="text-gray-500 hover:text-gray-700"
          >
            Skip for now — activate later from dashboard
          </Button>
        </div>
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={handleSuccessClose}>
        <DialogContent className="max-w-md">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isRenewal ? 'Listing Renewed!' : 'Listing Activated!'}
            </h2>
            <p className="text-gray-600 mb-1">
              Your property is now live on the <strong>{successPlanName}</strong> plan.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Tenants can now find and contact you directly.
            </p>
            <Button
              onClick={handleSuccessClose}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              View My Listings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}