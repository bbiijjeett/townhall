import { useState, useEffect } from 'react';
import { Upload, X, Check, MapPin, Eye, Save, ChevronRight, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { PropertyPreview } from '../components/PropertyPreview';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';

// Cloudinary widget types
declare global {
  interface Window {
    cloudinary?: any;
  }
}

interface PropertyFormData {
  title: string;
  rent: string;
  deposit: string;
  bhk: string;
  street1: string;
  street2: string;
  nearby: string;
  city: string;
  description: string;
  imageUrls: string[];
  amenities: string[];
  phoneNumber: string;
  area: string;
  floor: string;
  totalFloors: string;
  availableFrom: string;
  furnishing: 'Fully Furnished' | 'Semi Furnished' | 'Unfurnished';
  preferredTenants: 'Family' | 'Bachelor' | 'Any';
  isPetFriendly: boolean;
  latitude?: number;
  longitude?: number;
}

const STEPS = [
  { id: 1, title: 'Basic Info', description: 'Property details' },
  { id: 2, title: 'Location', description: 'Where is it?' },
  { id: 3, title: 'Pricing', description: 'Set your price' },
  { id: 4, title: 'Photos', description: 'Add images' },
  { id: 5, title: 'Amenities', description: 'Facilities' },
  { id: 6, title: 'Review', description: 'Preview & submit' },
];

const DRAFT_KEY = 'propertyDraft';

export function AddPropertyPage() {
  const navigate = useNavigate();
  const { user, addProperty } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const [formData, setFormData] = useState<PropertyFormData>({
    title: '',
    rent: '',
    deposit: '',
    bhk: '1BHK',
    street1: '',
    street2: '',
    nearby: '',
    city: '',
    description: '',
    imageUrls: [],
    amenities: [],
    phoneNumber: user?.phone || '',
    area: '',
    floor: '',
    totalFloors: '',
    availableFrom: new Date().toISOString().split('T')[0],
    furnishing: 'Semi Furnished',
    preferredTenants: 'Any',
    isPetFriendly: false,
  });

  // Load draft from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...draft }));
        toast.info('Draft loaded', { description: 'Your previous work was restored' });
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.title || formData.street1 || formData.description) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData]);

  // Cloudinary upload widget
  const openCloudinaryWidget = () => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      toast.error('Cloudinary not configured. Please add images via URL.');
      return;
    }

    if (window.cloudinary) {
      window.cloudinary.openUploadWidget(
        {
          cloudName,
          uploadPreset,
          sources: ['local', 'camera', 'url'],
          multiple: true,
          maxFiles: 10,
          resourceType: 'image',
          clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxFileSize: 5000000, // 5MB
          folder: `townrent/${user?.id}`,
        },
        (error: any, result: any) => {
          if (!error && result && result.event === 'success') {
            setFormData(prev => ({
              ...prev,
              imageUrls: [...prev.imageUrls, result.info.secure_url],
            }));
            toast.success('Image uploaded successfully!');
          } else if (error) {
            toast.error('Upload failed: ' + error.message);
          }
        }
      );
    } else {
      // Load Cloudinary widget script
      const script = document.createElement('script');
      script.src = 'https://upload-widget.cloudinary.com/global/all.js';
      script.async = true;
      document.head.appendChild(script);
      script.onload = () => openCloudinaryWidget();
    }
  };

  const availableAmenities = [
    'Parking', 'WiFi', 'AC', 'Power Backup', 'Water Supply', 'Furnished',
    'Gym', 'Swimming Pool', 'Garden', 'Security', 'Elevator', 'Refrigerator',
  ];

  const updateField = (field: keyof PropertyFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAmenityToggle = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const handleRemoveImage = (url: string) => {
    setFormData(prev => ({
      ...prev,
      imageUrls: prev.imageUrls.filter(img => img !== url),
    }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.title.trim()) {
          toast.error('Please enter a property title');
          return false;
        }
        if (!formData.phoneNumber || formData.phoneNumber.length < 10) {
          toast.error('Please provide a valid contact number');
          return false;
        }
        return true;
      case 2:
        if (!formData.street1.trim()) {
          toast.error('Please enter street address');
          return false;
        }
        if (!formData.city.trim()) {
          toast.error('Please enter city');
          return false;
        }
        return true;
      case 3:
        if (!formData.rent || Number(formData.rent) <= 0) {
          toast.error('Please enter a valid rent amount');
          return false;
        }
        if (!formData.deposit || Number(formData.deposit) <= 0) {
          toast.error('Please enter a valid deposit amount');
          return false;
        }
        return true;
      case 4:
        if (formData.imageUrls.length === 0) {
          toast.error('Please add at least one property image');
          return false;
        }
        return true;
      case 5:
        if (!formData.description.trim() || formData.description.length < 20) {
          toast.error('Please provide a detailed description (at least 20 characters)');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
  };

  // Combine location fields for display
  const getFullLocation = () => {
    const parts = [
      formData.street1.trim(),
      formData.street2.trim(),
      formData.nearby.trim(),
      formData.city.trim()
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;

    try {
      setIsSubmitting(true);
      
      // Combine location fields
      const locationParts = [
        formData.street1.trim(),
        formData.street2.trim(),
        formData.nearby.trim(),
        formData.city.trim()
      ].filter(Boolean);
      const fullLocation = locationParts.join(', ');
      
      const propertyId = await addProperty({
        title: formData.title.trim(),
        rent: Number(formData.rent),
        deposit: Number(formData.deposit),
        bhk: formData.bhk,
        location: fullLocation,
        description: formData.description.trim(),
        images: formData.imageUrls,
        amenities: formData.amenities,
        ownerPhone: formData.phoneNumber.trim(),
        area: formData.area ? Number(formData.area) : undefined,
        floor: formData.floor ? Number(formData.floor) : undefined,
        totalFloors: formData.totalFloors ? Number(formData.totalFloors) : undefined,
        availableFrom: formData.availableFrom ? new Date(formData.availableFrom) : undefined,
        furnishing: formData.furnishing,
        preferredTenants: formData.preferredTenants,
        isPetFriendly: formData.isPetFriendly,
        latitude: formData.latitude,
        longitude: formData.longitude,
      });

      clearDraft();
      toast.success('Property added successfully!');
      navigate('/payment/' + propertyId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add property';
      toast.error(message);
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="title">Property Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="e.g., Spacious 2BHK Near City Center"
                className="mt-1"
              />
            </div>

            <div>
              <Label>BHK Type *</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {['1BHK', '2BHK', '3BHK', '4BHK'].map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={formData.bhk === type ? 'default' : 'outline'}
                    onClick={() => updateField('bhk', type)}
                    className={formData.bhk === type ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="area">Area (sq ft)</Label>
                <Input
                  id="area"
                  type="number"
                  value={formData.area}
                  onChange={(e) => updateField('area', e.target.value)}
                  placeholder="1200"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="furnishing">Furnishing Status</Label>
                <select
                  id="furnishing"
                  value={formData.furnishing}
                  onChange={(e) => updateField('furnishing', e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option>Fully Furnished</option>
                  <option>Semi Furnished</option>
                  <option>Unfurnished</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="floor">Floor</Label>
                <Input
                  id="floor"
                  type="number"
                  value={formData.floor}
                  onChange={(e) => updateField('floor', e.target.value)}
                  placeholder="3"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="totalFloors">Total Floors</Label>
                <Input
                  id="totalFloors"
                  type="number"
                  value={formData.totalFloors}
                  onChange={(e) => updateField('totalFloors', e.target.value)}
                  placeholder="5"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="availableFrom">Available From</Label>
                <Input
                  id="availableFrom"
                  type="date"
                  value={formData.availableFrom}
                  onChange={(e) => updateField('availableFrom', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Contact Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => updateField('phoneNumber', e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="preferredTenants">Preferred Tenants</Label>
              <select
                id="preferredTenants"
                value={formData.preferredTenants}
                onChange={(e) => updateField('preferredTenants', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option>Any</option>
                <option>Family</option>
                <option>Bachelor</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="petFriendly"
                checked={formData.isPetFriendly}
                onCheckedChange={(checked) => updateField('isPetFriendly', checked)}
              />
              <Label htmlFor="petFriendly" className="cursor-pointer">
                Pet Friendly
              </Label>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="street1">Street Address Line 1 *</Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="street1"
                  value={formData.street1}
                  onChange={(e) => updateField('street1', e.target.value)}
                  placeholder="e.g., Building Name, Street Name"
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="street2">Street Address Line 2 (Optional)</Label>
              <Input
                id="street2"
                value={formData.street2}
                onChange={(e) => updateField('street2', e.target.value)}
                placeholder="e.g., Apartment/Floor Number, Area Name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="nearby">Nearby Landmark (Optional)</Label>
              <Input
                id="nearby"
                value={formData.nearby}
                onChange={(e) => updateField('nearby', e.target.value)}
                placeholder="e.g., Near Phoenix Mall, Behind City Hospital"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Mention nearby metro stations, bus stops, malls, or popular landmarks
              </p>
            </div>

            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="e.g., Bangalore, Mumbai, Delhi"
                className="mt-1"
              />
            </div>

            <div className="rounded-lg border p-6 bg-blue-50">
              <h4 className="font-medium text-blue-900 mb-2">💡 Location Tips:</h4>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>Be specific with street address for accurate location</li>
                <li>Landmarks help tenants find your property easily</li>
                <li>Mention nearby metro/bus stops for better visibility</li>
                <li>Example: "Sunshine Apartments, MG Road | Koramangala | Near Phoenix Mall | Bangalore"</li>
              </ul>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="rent">Monthly Rent (₹) *</Label>
                <Input
                  id="rent"
                  type="number"
                  value={formData.rent}
                  onChange={(e) => updateField('rent', e.target.value)}
                  placeholder="12000"
                  className="mt-1"
                />
                {formData.rent && (
                  <p className="text-xs text-gray-600 mt-1">
                    ₹{Number(formData.rent).toLocaleString()}/month
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="deposit">Security Deposit (₹) *</Label>
                <Input
                  id="deposit"
                  type="number"
                  value={formData.deposit}
                  onChange={(e) => updateField('deposit', e.target.value)}
                  placeholder="24000"
                  className="mt-1"
                />
                {formData.deposit && (
                  <p className="text-xs text-gray-600 mt-1">
                    ₹{Number(formData.deposit).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-6 bg-blue-50">
              <h4 className="font-medium text-blue-900 mb-2">💡 Pricing Tips:</h4>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>Research similar properties in your area</li>
                <li>Deposit is typically 1-3 months rent</li>
                <li>Competitive pricing attracts more inquiries</li>
                <li>You can always negotiate later</li>
              </ul>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <Label>Property Photos *</Label>
              <div className="mt-2 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    onClick={openCloudinaryWidget}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload from Device
                  </Button>
                </div>

                <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-4">
                  <p className="font-medium mb-2">📸 Photo Guidelines:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Upload 3-10 high-quality photos</li>
                    <li>First photo will be the main listing image</li>
                    <li>Show living room, bedrooms, kitchen, bathroom</li>
                    <li>Good lighting and clean rooms attract more tenants</li>
                    <li>Max 5MB per image</li>
                  </ul>
                </div>

                {formData.imageUrls.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Uploaded Photos ({formData.imageUrls.length})
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {formData.imageUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <ImageWithFallback
                            src={url}
                            alt={`Property ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          {index === 0 && (
                            <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded">
                              Main Photo
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(url)}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="description">Property Description * (min 20 characters)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe your property, nearby facilities, public transport, schools, hospitals, shopping centers, etc."
                className="mt-1 min-h-40"
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500">Be detailed to attract quality tenants</p>
                <p className={`text-xs ${formData.description.length < 20 ? 'text-red-500' : 'text-green-600'}`}>
                  {formData.description.length} characters
                </p>
              </div>
            </div>

            <div>
              <Label>Amenities & Facilities</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                {availableAmenities.map((amenity) => (
                  <div key={amenity} className="flex items-center space-x-2">
                    <Checkbox
                      id={amenity}
                      checked={formData.amenities.includes(amenity)}
                      onCheckedChange={() => handleAmenityToggle(amenity)}
                    />
                    <Label htmlFor={amenity} className="text-sm cursor-pointer">
                      {amenity}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center py-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Review Your Property</h3>
              <p className="text-gray-600">Check all details before submitting</p>
            </div>
            
            <PropertyPreview
              title={formData.title}
              rent={Number(formData.rent)}
              deposit={Number(formData.deposit)}
              bhk={formData.bhk}
              location={getFullLocation()}
              description={formData.description}
              images={formData.imageUrls}
              amenities={formData.amenities}
              area={formData.area ? Number(formData.area) : undefined}
              furnishing={formData.furnishing}
              availableFrom={formData.availableFrom ? new Date(formData.availableFrom) : undefined}
            />

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                ℹ️ After submission, you'll be redirected to pay a listing fee of ₹199 
                to activate your property for 30 days.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">You need to be logged in to add a property.</p>
          <Button onClick={() => navigate('/login')} className="bg-indigo-600 hover:bg-indigo-700">
            Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-white">
            <h1 className="text-3xl font-bold mb-2">List Your Property</h1>
            <p className="text-indigo-100">Fill in details step by step</p>
          </div>

          {/* Progress Indicator */}
          <div className="bg-white border-b">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-2">
                {STEPS.map((step, index) => (
                  <div key={step.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                          currentStep > step.id
                            ? 'bg-green-500 text-white'
                            : currentStep === step.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
                      </div>
                      <div className="text-xs mt-1 hidden sm:block text-center">
                        <p className="font-medium text-gray-900">{step.title}</p>
                        <p className="text-gray-500">{step.description}</p>
                      </div>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`h-1 w-8 sm:w-16 mx-2 transition-colors ${
                          currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="px-6 py-8">
            {renderStep()}
          </div>

          {/* Navigation Buttons */}
          <div className="bg-gray-50 px-4 sm:px-6 py-4 border-t">
            {/* Mobile: Primary navigation buttons full-width */}
            <div className="flex flex-col sm:hidden gap-3">
              <div className="flex gap-2">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                )}
                
                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Submit & Pay
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {/* Secondary actions row on mobile */}
              <div className="flex gap-2 text-sm">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/dashboard')}
                  disabled={isSubmitting}
                  size="sm"
                  className="flex-1 text-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowPreview(true)}
                  size="sm"
                  className="flex-1 text-gray-600"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearDraft}
                  size="sm"
                  className="flex-1 text-gray-600"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            {/* Desktop: Original layout */}
            <div className="hidden sm:flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearDraft}
                  className="text-gray-600"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Clear Draft
                </Button>
              </div>

              <div className="flex gap-2">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={isSubmitting}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                )}
                
                <Button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  variant="outline"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>

                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Submit & Pay
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Property Preview</DialogTitle>
          </DialogHeader>
          <PropertyPreview
            title={formData.title}
            rent={Number(formData.rent)}
            deposit={Number(formData.deposit)}
            bhk={formData.bhk}
            location={getFullLocation()}
            description={formData.description}
            images={formData.imageUrls}
            amenities={formData.amenities}
            area={formData.area ? Number(formData.area) : undefined}
            furnishing={formData.furnishing}
            availableFrom={formData.availableFrom ? new Date(formData.availableFrom) : undefined}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}