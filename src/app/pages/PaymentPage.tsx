import { useState } from 'react';
import { CheckCircle, IndianRupee, CreditCard, Building2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { toast } from 'sonner';

export function PaymentPage() {
  const { id: propertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { properties, updatePropertyPayment } = useApp();
  const property = properties.find(p => p.id === propertyId);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'netbanking'>('card');

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

  const listingFee = 199;

  const handlePayment = async () => {
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await updatePropertyPayment(propertyId!);
      setShowPaymentModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment failed';
      toast.error(message);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigate('/owner-dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Card className="p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Complete Your Listing</h1>

          {/* Property Summary */}
          <Card className="bg-gray-50 p-6 mb-6">
            <h2 className="font-semibold text-lg text-gray-900 mb-4">Property Details</h2>
            <div className="space-y-2">
              <p className="text-gray-700"><span className="font-medium">Title:</span> {property.title}</p>
              <p className="text-gray-700"><span className="font-medium">Location:</span> {property.location}</p>
              <p className="text-gray-700"><span className="font-medium">Type:</span> {property.bhk}</p>
              <p className="text-gray-700"><span className="font-medium">Rent:</span> ₹{property.rent.toLocaleString()}/month</p>
            </div>
          </Card>

          {/* Pricing Details */}
          <div className="space-y-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Listing Fee</h2>
            
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-700 mb-1">30 Days Premium Listing</p>
                  <p className="text-sm text-gray-600">Get maximum visibility for your property</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900">₹{listingFee}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  <span>Verified Owner Badge</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  <span>Featured in Search Results</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  <span>Direct Contact Details Visible</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  <span>30 Days Active Listing</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">Listing Fee</span>
                <span className="font-semibold text-gray-900">₹{listingFee}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">GST (18%)</span>
                <span className="font-semibold text-gray-900">₹{Math.round(listingFee * 0.18)}</span>
              </div>
              <div className="border-t border-gray-300 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total Amount</span>
                  <span className="text-2xl font-bold text-indigo-600">
                    ₹{Math.round(listingFee * 1.18)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/owner-dashboard')}
              className="flex-1"
            >
              Pay Later
            </Button>
            <Button
              onClick={() => setShowPaymentModal(true)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              <IndianRupee className="w-4 h-4 mr-2" />
              Pay Now
            </Button>
          </div>
        </Card>
      </div>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <div className="p-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Payment Method</h2>

            <div className="space-y-3 mb-6">
              <Card
                className={`p-4 cursor-pointer transition-all ${
                  paymentMethod === 'card' ? 'border-indigo-600 bg-indigo-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => setPaymentMethod('card')}
              >
                <div className="flex items-center">
                  <CreditCard className="w-6 h-6 text-indigo-600 mr-3" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Credit / Debit Card</p>
                    <p className="text-sm text-gray-600">Pay using your card</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 ${
                    paymentMethod === 'card' ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                  }`}>
                    {paymentMethod === 'card' && (
                      <CheckCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              </Card>

              <Card
                className={`p-4 cursor-pointer transition-all ${
                  paymentMethod === 'upi' ? 'border-indigo-600 bg-indigo-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => setPaymentMethod('upi')}
              >
                <div className="flex items-center">
                  <IndianRupee className="w-6 h-6 text-indigo-600 mr-3" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">UPI</p>
                    <p className="text-sm text-gray-600">Pay using UPI apps</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 ${
                    paymentMethod === 'upi' ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                  }`}>
                    {paymentMethod === 'upi' && (
                      <CheckCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              </Card>

              <Card
                className={`p-4 cursor-pointer transition-all ${
                  paymentMethod === 'netbanking' ? 'border-indigo-600 bg-indigo-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => setPaymentMethod('netbanking')}
              >
                <div className="flex items-center">
                  <Building2 className="w-6 h-6 text-indigo-600 mr-3" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">Net Banking</p>
                    <p className="text-sm text-gray-600">Pay using internet banking</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 ${
                    paymentMethod === 'netbanking' ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                  }`}>
                    {paymentMethod === 'netbanking' && (
                      <CheckCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              </Card>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Amount to Pay</span>
                <span className="text-2xl font-bold text-indigo-600">
                  ₹{Math.round(listingFee * 1.18)}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePayment}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Pay ₹{Math.round(listingFee * 1.18)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={handleSuccessClose}>
        <DialogContent className="max-w-md">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-gray-600 mb-6">
              Your property is now live and visible to potential tenants.
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