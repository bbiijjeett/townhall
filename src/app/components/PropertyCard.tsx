import { MapPin, BedDouble, CheckCircle2, Heart, Sparkles, Star } from 'lucide-react';
import { Property } from '../context/AppContext';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface PropertyCardProps {
  property: Property;
  onClick: () => void;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
}

export function PropertyCard({ property, onClick, isSaved, onToggleSave }: PropertyCardProps) {
  const isPremium  = property.planType === 'premium'  && property.paymentStatus === 'paid';
  const isFeatured = property.planType === 'featured' && property.paymentStatus === 'paid';

  return (
    <Card
      className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow ${
        isPremium  ? 'ring-2 ring-indigo-500 shadow-indigo-100 shadow-md' :
        isFeatured ? 'ring-2 ring-amber-400 shadow-amber-100 shadow-md' : ''
      }`}
      onClick={onClick}
    >
      <div className="relative aspect-video overflow-hidden">
        <ImageWithFallback
          src={property.images[0]}
          alt={property.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3">
          <Badge className="bg-indigo-600 text-white hover:bg-indigo-700">
            {property.bhk}
          </Badge>
        </div>
        {/* Plan badge — top right */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
          {isPremium && (
            <Badge className="bg-indigo-600 text-white hover:bg-indigo-700">
              <Star className="w-3 h-3 mr-1 fill-white" />
              Premium
            </Badge>
          )}
          {isFeatured && (
            <Badge className="bg-amber-500 text-white hover:bg-amber-600">
              <Sparkles className="w-3 h-3 mr-1" />
              Featured
            </Badge>
          )}
          {property.status === 'active' && !isPremium && !isFeatured && (
            <Badge className="bg-green-600 text-white hover:bg-green-700">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>
        {onToggleSave !== undefined && (
          <button
            onClick={onToggleSave}
            aria-label={isSaved ? 'Unsave property' : 'Save property'}
            className="absolute bottom-3 right-3 p-1.5 rounded-full bg-white/90 hover:bg-white shadow-md transition-all"
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
          {property.title}
        </h3>

        <div className="flex items-center text-gray-600">
          <MapPin className="w-4 h-4 mr-1" />
          <span className="text-sm">{property.location}</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              ₹{property.rent.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">per month</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Deposit</p>
            <p className="font-semibold text-gray-900">₹{property.deposit.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {property.amenities.slice(0, 3).map((amenity, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {amenity}
            </Badge>
          ))}
          {property.amenities.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{property.amenities.length - 3} more
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
