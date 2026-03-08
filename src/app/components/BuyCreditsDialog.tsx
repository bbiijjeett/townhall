import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../../lib/supabase';
import { loadRazorpayScript } from '../../lib/razorpay';
import type { RazorpayResponse } from '../../lib/razorpay';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful payment so callers can update local state */
  onSuccess?: (pack: '10credits' | 'unlimited') => void;
}

export function BuyCreditsDialog({ open, onOpenChange, onSuccess }: Props) {
  const { user } = useApp();
  const navigate = useNavigate();
  const [isBuying, setIsBuying] = useState(false);

  const handleBuy = async (pack: '10credits' | 'unlimited') => {
    setIsBuying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Your session has expired. Please sign in again.');
        navigate('/login');
        return;
      }

      const { data: orderData, error: orderError } = await supabase.functions.invoke(
        'create-razorpay-order',
        {
          body: { type: 'credits', pack },
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

      await loadRazorpayScript();
      setIsBuying(false);
      onOpenChange(false); // close dialog before Razorpay overlay opens

      const rzp = new window.Razorpay({
        key: key_id,
        amount: amount_paise,
        currency: 'INR',
        order_id,
        name: 'TownHall',
        description: pack === 'unlimited' ? 'Unlimited Reveals — This Month' : '10 Reveal Credits',
        notes: { pack, user_id: user!.id },
        handler: async (response: RazorpayResponse) => {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
            'verify-credits-payment',
            {
              body: {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                pack,
              },
              headers: { Authorization: `Bearer ${session.access_token}` },
            },
          );

          if (verifyError) {
            toast.error('Payment verification failed. Contact support if amount was deducted.');
            return;
          }

          if (pack === 'unlimited') {
            toast.success('Unlimited reveals activated! You can now view all owner contacts this month.');
          } else {
            toast.success('10 reveal credits added to your account!');
          }

          onSuccess?.(pack);
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: () => setIsBuying(false),
        },
      });

      rzp.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Get More Reveal Credits</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 mb-4">
          Purchase credits to view owner phone numbers and contact them directly.
        </p>
        <div className="space-y-3">
          {/* 10 Credits pack */}
          <button
            onClick={() => handleBuy('10credits')}
            disabled={isBuying}
            className="w-full text-left p-4 rounded-lg border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">10 Reveal Credits</p>
                <p className="text-sm text-gray-500">View up to 10 more owner contacts</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-indigo-600">₹49</p>
                <p className="text-xs text-gray-400">one-time</p>
              </div>
            </div>
          </button>

          {/* Unlimited pack */}
          <button
            onClick={() => handleBuy('unlimited')}
            disabled={isBuying}
            className="w-full text-left p-4 rounded-lg border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-50 relative"
          >
            <div className="absolute -top-2 right-3">
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">Best Value</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Unlimited Reveals</p>
                <p className="text-sm text-gray-500">No limit for the rest of this month</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-amber-600">₹149</p>
                <p className="text-xs text-gray-400">this month</p>
              </div>
            </div>
          </button>
        </div>
        {isBuying && (
          <p className="text-sm text-center text-gray-500 mt-2">Opening payment…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
