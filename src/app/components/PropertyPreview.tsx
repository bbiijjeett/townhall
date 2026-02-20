import { IndianRupee, MapPin, Home, Calendar } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface PropertyPreviewProps {
  title: string;
  rent: number;
  deposit: number;
  bhk: string;
  location: string;
  description: string;
  images: string[];
  amenities: string[];
  area?: number;
  furnishing?: string;
  availableFrom?: Date;
}

export function PropertyPreview({
  title,
  rent,
  deposit,
  bhk,
  location,
  description,
  images,
  amenities,
  area,
  furnishing,
  availableFrom,
}: PropertyPreviewProps) {
  return (
    <Card className="overflow-hidden">
      {/* Main Image */}
      {images.length > 0 && (
        <div className="relative h-64 w-full">
          <ImageWithFallback
            src={images[0]}
            alt={title}
            className="w-full h-full object-cover"
          />
          <Badge className="absolute top-3 right-3 bg-white text-gray-900 hover:bg-white">
            {bhk}
          </Badge>
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* Title & Location */}
        <div>
          <h3 className="text-2xl font-bold text-gray-900">{title || 'Your Property Title'}</h3>
          <div className="flex items-center text-gray-600 mt-1">
            <MapPin className="w-4 h-4 mr-1" />
            <span className="text-sm">{location || 'Location'}</span>
          </div>
        </div>

        {/* Pricing */}
        <div className="flex items-baseline gap-6">
          <div>
            <p className="text-sm text-gray-600">Monthly Rent</p>
            <p className="text-2xl font-bold text-gray-900 flex items-center">
              <IndianRupee className="w-5 h-5" />
              {rent ? rent.toLocaleString() : '0'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Deposit</p>
            <p className="text-lg font-semibold text-gray-700 flex items-center">
              <IndianRupee className="w-4 h-4" />
              {deposit ? deposit.toLocaleString() : '0'}
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {area && (
            <div className="flex items-center">
              <Home className="w-4 h-4 mr-1" />
              <span>{area} sq ft</span>
            </div>
          )}
          {furnishing && (
            <div className="flex items-center">
              <span>{furnishing}</span>
            </div>
          )}
          {availableFrom && (
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              <span>Available from {availableFrom.toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <div>
            <p className="text-gray-700 text-sm line-clamp-3">{description}</p>
          </div>
        )}

        {/* Amenities */}
        {amenities.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-900 mb-2">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {amenities.slice(0, 6).map((amenity) => (
                <Badge key={amenity} variant="outline" className="text-xs">
                  {amenity}
                </Badge>
              ))}
              {amenities.length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{amenities.length - 6} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Image Gallery Preview */}
        {images.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {images.slice(1, 5).map((img, idx) => (
              <div key={idx} className="aspect-square rounded overflow-hidden">
                <ImageWithFallback
                  src={img}
                  alt={`${title} ${idx + 2}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
