import { useState } from 'react';
import { MapPin, BedDouble, IndianRupee, Phone, MessageCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { toast } from 'sonner';

export function PropertyDetailPage() {
  const { id: propertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { properties, user } = useApp();
  const property = properties.find(p => p.id === propertyId);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [showPhoneNumber, setShowPhoneNumber] = useState(false);
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [enquiryMessage, setEnquiryMessage] = useState('');

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

  const handleShowPhone = () => {
    if (!user) {
      toast.error('Please login to view phone number');
      navigate('/login');
      return;
    }
    setShowPhoneNumber(true);
  };

  const handleWhatsAppContact = () => {
    if (!user) {
      toast.error('Please login to contact the owner');
      navigate('/login');
      return;
    }
    
    // Extract only numbers from phone
    let phoneNumber = property.ownerPhone.replace(/[^0-9]/g, '');
    
    // If phone doesn't start with country code (91 for India), add it
    if (phoneNumber.length === 10 && !phoneNumber.startsWith('91')) {
      phoneNumber = '91' + phoneNumber;
    }
    
    // Validate phone number length
    if (phoneNumber.length < 10) {
      toast.error('Invalid phone number');
      return;
    }
    
    const message = encodeURIComponent(
      `Hi, I'm interested in your property: ${property.title}\n\nRent: ₹${property.rent.toLocaleString()}/month\nLocation: ${property.location}`
    );
    
    // Open WhatsApp with the formatted number
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleSubmitEnquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enquiryName || !enquiryPhone || !enquiryMessage) {
      toast.error('Please fill in all fields');
      return;
    }
    toast.success('Enquiry sent successfully! The owner will contact you soon.');
    setShowEnquiryForm(false);
    setEnquiryName('');
    setEnquiryPhone('');
    setEnquiryMessage('');
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

              {/* Map Placeholder */}
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Location</h2>
                <div className="bg-gray-200 h-64 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Map view coming soon</p>
                    <p className="text-sm text-gray-500 mt-1">{property.location}</p>
                  </div>
                </div>
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

                <div className="space-y-3">
                  {!showPhoneNumber ? (
                    <Button
                      onClick={handleShowPhone}
                      className="w-full bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Show Phone Number
                    </Button>
                  ) : (
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <p className="text-sm text-indigo-700 mb-1">Owner's Phone</p>
                      <a
                        href={`tel:${property.ownerPhone}`}
                        className="text-xl font-bold text-indigo-900 hover:text-indigo-600 flex items-center"
                      >
                        <Phone className="w-5 h-5 mr-2" />
                        {property.ownerPhone}
                      </a>
                    </div>
                  )}
                  
                  <Button
                    onClick={handleWhatsAppContact}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    WhatsApp Owner
                  </Button>
                  
                  <Button
                    onClick={handleContactOwner}
                    variant="outline"
                    className="w-full border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Send Enquiry
                  </Button>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span>No Broker Fee</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span>Direct Owner Contact</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

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
              />
            </div>
            <div>
              <Label htmlFor="enquiry-phone">Phone Number</Label>
              <Input
                id="enquiry-phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={enquiryPhone}
                onChange={(e) => setEnquiryPhone(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="enquiry-message">Message</Label>
              <Textarea
                id="enquiry-message"
                placeholder="I'm interested in this property..."
                value={enquiryMessage}
                onChange={(e) => setEnquiryMessage(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEnquiryForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                Send Enquiry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}