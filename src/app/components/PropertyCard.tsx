import { MapPin, BedDouble, CheckCircle2 } from 'lucide-react';
import { Property } from '../context/AppContext';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface PropertyCardProps {
  property: Property;
  onClick: () => void;
}

export function PropertyCard({ property, onClick }: PropertyCardProps) {
  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
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
        {property.status === 'active' && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-green-600 text-white hover:bg-green-700">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          </div>
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
