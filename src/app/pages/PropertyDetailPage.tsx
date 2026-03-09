import { useState, useEffect } from 'react';
import { MapPin, BedDouble, IndianRupee, Phone, MessageCircle, CheckCircle2, ChevronLeft, ChevronRight, Share2, Sparkles, Flag } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../../lib/supabase';
import { loadRazorpayScript } from '../../lib/razorpay';
import type { RazorpayResponse } from '../../lib/razorpay';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { BuyCreditsDialog } from '../components/BuyCreditsDialog';
import { ReportListingDialog } from '../components/ReportListingDialog';
import { toast } from 'sonner';

export function PropertyDetailPage() {
  const { id: propertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { properties, user, profile } = useApp();
  const property = properties.find(p => p.id === propertyId);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);
  const [revealedPhone, setRevealedPhone]     = useState<string | null>(null);
  const [isRevealingPhone, setIsRevealingPhone] = useState(false);
  const [revealsUsed, setRevealsUsed]         = useState<number | null>(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [enquiryName, setEnquiryName]           = useState(user?.name ?? '');
  const [enquiryMessage, setEnquiryMessage]     = useState('');
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);

  // Fetch the number of phone reveals used this calendar month
  useEffect(() => {
    if (!user || profile?.reveal_unlimited) return;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    supabase
      .from('contact_reveals')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', user.id)
      .gte('created_at', monthStart.toISOString())
      .then(({ count }) => setRevealsUsed(count ?? 0));
  }, [user?.id, profile?.reveal_unlimited]);

  // Increment view count once per page load — rate-limited server-side via Upstash Redis
  useEffect(() => {
    if (!propertyId) return;
    supabase.functions
      .invoke('increment-view', { body: { property_id: propertyId } })
      .catch(() => {}); // silent fail — never block UI for analytics
  }, [propertyId]);

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Property Not Found</h2>
          <Button onClick={() => navigate('/')} className="bg-indigo-600 hover:bg-indigo-700">
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  const handleContactOwner = () => {
    if (!user) {
      toast.error('Please login to contact the owner');
      navigate('/login');
      return;
    }
    setShowEnquiryForm(true);
  };

  const handleShowPhone = async () => {
    if (!user) {
      toast.error('Please login to view phone number');
      navigate('/login');
      return;
    }
    // Already revealed — just show it again without burning another credit
    if (revealedPhone) {
      setShowPhoneNumber(true);
      return;
    }
    try {
      setIsRevealingPhone(true);
      const { data, error } = await supabase.rpc('reveal_owner_phone', {
        p_property_id: propertyId,
      });
      if (error) {
        if (error.message.includes('quota exceeded')) {
          setShowBuyCredits(true);
        } else {
          toast.error('Could not retrieve phone number. Please try again.');
        }
        return;
      }
      setRevealedPhone(data as string);
      setShowPhoneNumber(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not retrieve phone number');
    } finally {
      setIsRevealingPhone(false);
    }
  };

  const handleCreditsSuccess = (pack: '10credits' | 'unlimited') => {
    if (pack === 'unlimited') {
      setRevealsUsed(null);
    }
  };

  const handleWhatsAppContact = async () => {
    if (!user) {
      toast.error('Please login to contact the owner');
      navigate('/login');
      return;
    }

    // Re-use cached phone or reveal it first
    let phone = revealedPhone;
    if (!phone) {
      try {
        setIsRevealingPhone(true);
        const { data, error } = await supabase.rpc('reveal_owner_phone', {
          p_property_id: propertyId,
        });
        if (error) throw error;
        phone = data as string;
        setRevealedPhone(data as string);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not get owner contact');
        return;
      } finally {
        setIsRevealingPhone(false);
      }
    }

    if (!phone) {
      toast.error('Owner phone number is not available');
      return;
    }

    let phoneNumber = phone.replace(/[^0-9]/g, '');
    if (phoneNumber.length === 10 && !phoneNumber.startsWith('91')) {
      phoneNumber = '91' + phoneNumber;
    }
    if (phoneNumber.length < 10) {
      toast.error('Invalid phone number');
      return;
    }

    const message = encodeURIComponent(
      `Hi, I'm interested in your property: ${property.title}\n\nRent: ₹${property.rent.toLocaleString()}/month\nLocation: ${property.location}`,
    );
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: property?.title ?? 'Check out this property',
      text: `${property?.title} - ₹${property?.rent.toLocaleString()}/month at ${property?.location}`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleSubmitEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enquiryName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (enquiryMessage.trim().length < 5) {
      toast.error('Message must be at least 5 characters');
      return;
    }
    try {
      setIsSubmittingInquiry(true);

      // supabase.functions.invoke falls back to the anon key when the session has
      // expired. Calling getSession() first forces an automatic token refresh via
      // the refresh token, then we pass the access_token explicitly.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Your session has expired. Please sign in again.');
        navigate('/login');
        return;
      }

      const { error } = await supabase.functions.invoke('send-inquiry-email', {
        body: { property_id: propertyId, message: enquiryMessage.trim() },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      toast.success('Enquiry sent! The owner will contact you soon.');
      setShowEnquiryForm(false);
      setEnquiryMessage('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send enquiry. Please try again.');
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % property.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <div className="max-w-5xl mx-auto">
        {/* Image Gallery */}
        <div className="relative w-full h-64 sm:h-96 lg:h-[500px] bg-gray-900">
          <ImageWithFallback
            src={property.images[currentImageIndex]}
            alt={property.title}
            className="w-full h-full object-cover"
          />
          
          {property.images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
              >
                <ChevronLeft className="w-6 h-6 text-gray-900" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
              >
                <ChevronRight className="w-6 h-6 text-gray-900" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {property.images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentImageIndex ? 'bg-white w-8' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-6 sm:px-6 lg:px-8 space-y-6">
          {/* Property Header */}
          <div>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{property.title}</h1>
                <div className="flex items-center text-gray-600">
                  <MapPin className="w-5 h-5 mr-2" />
                  <span>{property.location}</span>
                </div>
              </div>
              <Badge className="bg-indigo-600 text-white hover:bg-indigo-700">
                {property.bhk}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Price Card */}
              <Card className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Monthly Rent</p>
                    <p className="text-3xl font-bold text-gray-900">
                      ₹{property.rent.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Security Deposit</p>
                    <p className="text-3xl font-bold text-gray-900">
                      ₹{property.deposit.toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Description */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-3">Description</h2>
                <p className="text-gray-700 leading-relaxed">{property.description}</p>
              </Card>

              {/* Amenities */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {property.amenities.map((amenity, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-gray-700">{amenity}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Map */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Location</h2>
                <div className="rounded-lg overflow-hidden h-64">
                  <iframe
                    title="Property Location"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={
                      property.latitude && property.longitude
                        ? `https://maps.google.com/maps?q=${property.latitude},${property.longitude}&output=embed`
                        : `https://maps.google.com/maps?q=${encodeURIComponent(property.location)}&output=embed`
                    }
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2 flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {property.location}
                </p>
              </Card>
            </div>

            {/* Sidebar - Contact Owner */}
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-20">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Owner</h2>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-600">Owner Name</p>
                    <p className="font-semibold text-gray-900">{property.ownerName}</p>
                  </div>
                  {property.status === 'active' && (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Verified Owner
                    </Badge>
                  )}
                </div>

                {user?.id === property.ownerId ? (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 text-center">
                    This is your listing. Contact options are only visible to other users.
                  </div>
                ) : (
                <>
                <div className="space-y-3">
                  {/* Phone revealed state — show number + action buttons */}
                  {showPhoneNumber && (
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <p className="text-sm text-indigo-700 mb-1">Owner's Phone</p>
                      <a
                        href={`tel:${revealedPhone}`}
                        className="text-xl font-bold text-indigo-900 hover:text-indigo-600 flex items-center"
                      >
                        <Phone className="w-5 h-5 mr-2" />
                        {revealedPhone}
                      </a>
                    </div>
                  )}

                  {/* Call + WhatsApp — always shown, reveal on first tap */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={handleShowPhone}
                      disabled={isRevealingPhone}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {isRevealingPhone ? (
                        <span className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                      ) : (
                        <Phone className="w-4 h-4 mr-2" />
                      )}
                      Call
                    </Button>
                    <Button
                      onClick={handleWhatsAppContact}
                      disabled={isRevealingPhone}
                      className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-60"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Button>
                  </div>

                  {/* Reveal quota counter */}
                  {user && (
                    profile?.reveal_unlimited ? (
                      <p className="text-xs text-center text-green-600 flex items-center justify-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Unlimited reveals active
                      </p>
                    ) : revealsUsed !== null ? (
                      <p className="text-xs text-center text-gray-500">
                        {revealsUsed}/3 reveals used this month
                        {revealsUsed >= 3 && (
                          <button
                            onClick={() => setShowBuyCredits(true)}
                            className="ml-1 text-indigo-600 underline hover:text-indigo-800"
                          >
                            Get more
                          </button>
                        )}
                      </p>
                    ) : null
                  )}
                  
                  <Button
                    onClick={handleContactOwner}
                    variant="outline"
                    className="w-full border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Send Enquiry
                  </Button>

                  {/* Share Button */}
                  <Button
                    onClick={handleShare}
                    variant="outline"
                    className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Property
                  </Button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Move-In Checklist</p>
                  {[
                    'Verify owner ID before signing',
                    'Get rental agreement before paying',
                    'Document existing damage with photos',
                    'Confirm deposit refund terms in writing',
                    'Check water, power & gas connections',
                  ].map((item) => (
                    <div key={item} className="flex items-start space-x-2 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                </> )} {/* end owner check */}

              {/* Report this listing — only for non-owners when logged in */}
              {user && user.id !== property.ownerId && (
                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  <button
                    type="button"
                    onClick={() => setShowReport(true)}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Flag className="w-3 h-3" />
                    Report this listing
                  </button>
                </div>
              )}
              </Card>

              
            </div>
          </div>
        </div>
      </div>

      <BuyCreditsDialog
        open={showBuyCredits}
        onOpenChange={setShowBuyCredits}
        onSuccess={handleCreditsSuccess}
      />

      <ReportListingDialog
        propertyId={propertyId ?? ''}
        open={showReport}
        onOpenChange={setShowReport}
      />

      {/* Enquiry Form Dialog */}
      <Dialog open={showEnquiryForm} onOpenChange={setShowEnquiryForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Enquiry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitEnquiry} className="space-y-4">
            <div>
              <Label htmlFor="enquiry-name">Your Name</Label>
              <Input
                id="enquiry-name"
                type="text"
                placeholder="Enter your name"
                value={enquiryName}
                onChange={(e) => setEnquiryName(e.target.value)}
                className="mt-1"
                disabled={isSubmittingInquiry}
              />
            </div>
            <div>
              <Label htmlFor="enquiry-message">
                Message
                <span className="text-gray-400 font-normal ml-1 text-xs">(max 500 characters)</span>
              </Label>
              <Textarea
                id="enquiry-message"
                placeholder="I'm interested in this property. Please share more details..."
                value={enquiryMessage}
                maxLength={500}
                onChange={(e) => setEnquiryMessage(e.target.value)}
                className="mt-1 min-h-28 resize-none"
                disabled={isSubmittingInquiry}
              />
              <p className={`text-xs mt-1 text-right ${enquiryMessage.length >= 450 ? 'text-amber-600' : 'text-gray-400'}`}>
                {enquiryMessage.length}/500
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEnquiryForm(false)}
                className="flex-1"
                disabled={isSubmittingInquiry}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
                disabled={isSubmittingInquiry}
              >
                {isSubmittingInquiry && (
                  <span className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                )}
                Send Enquiry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}