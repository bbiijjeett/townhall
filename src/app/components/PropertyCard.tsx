import { MapPin, CheckCircle2, Heart, Sparkles, Star, Clock, AlertCircle, BedDouble, Maximize2, CalendarCheck, Sofa } from 'lucide-react';
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

type FreshnessLevel = 'today' | 'recent' | 'aging' | 'stale';

interface FreshnessInfo {
  level: FreshnessLevel;
  label: string;
  dotColor: string;
  textColor: string;
}

function getFreshness(createdAt: Date): FreshnessInfo {
  const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
  if (daysAgo === 0) return { level: 'today',  label: 'Posted today',           dotColor: 'bg-green-500', textColor: 'text-green-700' };
  if (daysAgo <= 7)  return { level: 'recent', label: `Posted ${daysAgo}d ago`, dotColor: 'bg-green-400', textColor: 'text-green-600' };
  if (daysAgo <= 21) return { level: 'aging',  label: `Posted ${daysAgo}d ago`, dotColor: 'bg-amber-400', textColor: 'text-amber-600' };
  return               { level: 'stale',  label: `Posted ${daysAgo}d ago`,      dotColor: 'bg-red-400',   textColor: 'text-red-600' };
}

function formatAvailableFrom(date: Date | undefined): string | null {
  if (!date) return null;
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'Available now';
  if (diffDays <= 30) return `Available in ${diffDays}d`;
  return `Available ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

export function PropertyCard({ property, onClick, isSaved, onToggleSave }: PropertyCardProps) {
  const isPremium  = property.planType === 'premium'  && property.paymentStatus === 'paid';
  const isFeatured = property.planType === 'featured' && property.paymentStatus === 'paid';
  const isAgent    = property.ownerAccountType === 'agent';
  const freshness  = getFreshness(property.createdAt);
  const availability = formatAvailableFrom(property.availableFrom);

  return (
    <Card
      className={`overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200 group ${
        isPremium  ? 'ring-2 ring-indigo-500 shadow-indigo-100 shadow-md' :
        isFeatured ? 'ring-2 ring-amber-400 shadow-amber-100 shadow-md' : 'shadow-sm hover:-translate-y-0.5'
      }`}
      onClick={onClick}
    >
      {/* ── Image ── */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <ImageWithFallback
          src={property.images[0]}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Bottom gradient for overlay legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* BHK — top left */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 bg-white/95 text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
            <BedDouble className="w-3.5 h-3.5 text-indigo-600" />
            {property.bhk}
          </span>
        </div>

        {/* Plan / Agent badges — top right */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
          {isPremium && (
            <Badge className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">
              <Star className="w-3 h-3 mr-1 fill-white" />
              Premium
            </Badge>
          )}
          {isFeatured && (
            <Badge className="bg-amber-500 text-white hover:bg-amber-600 shadow-sm">
              <Sparkles className="w-3 h-3 mr-1" />
              Featured
            </Badge>
          )}
          {property.status === 'active' && !isPremium && !isFeatured && !isAgent && (
            <Badge className="bg-green-600 text-white hover:bg-green-700 shadow-sm">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          )}
          {isAgent && (
            <Badge className="bg-white/95 text-purple-700 hover:bg-white border border-purple-200 shadow-sm">
              Agent
            </Badge>
          )}
        </div>

        {/* Availability pill — bottom left */}
        {availability && (
          <div className="absolute bottom-3 left-3">
            <span className="inline-flex items-center gap-1 bg-white/95 text-gray-800 text-xs font-medium px-2.5 py-1 rounded-full shadow-sm">
              <CalendarCheck className="w-3 h-3 text-green-600" />
              {availability}
            </span>
          </div>
        )}

        {/* Save button — bottom right */}
        {onToggleSave !== undefined && (
          <button
            onClick={onToggleSave}
            aria-label={isSaved ? 'Unsave property' : 'Save property'}
            className="absolute bottom-3 right-3 p-1.5 rounded-full bg-white/95 hover:bg-white shadow-md transition-all hover:scale-110"
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} />
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p-4 space-y-3">
        {/* Title + location */}
        <div>
          <h3 className="font-semibold text-base text-gray-900 line-clamp-1 leading-snug group-hover:text-indigo-700 transition-colors">
            {property.title}
          </h3>
          <div className="flex items-center text-gray-500 mt-1">
            <MapPin className="w-3.5 h-3.5 mr-1 flex-shrink-0 text-indigo-400" />
            <span className="text-xs line-clamp-1">{property.location}</span>
          </div>
        </div>

        {/* Key specs row */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {property.furnishing && (
            <span className="flex items-center gap-1">
              <Sofa className="w-3.5 h-3.5 text-gray-400" />
              {property.furnishing.replace(' Furnished', '')}
            </span>
          )}
          {property.area && (
            <span className="flex items-center gap-1">
              <Maximize2 className="w-3.5 h-3.5 text-gray-400" />
              {property.area.toLocaleString()} sq ft
            </span>
          )}
          {property.floor != null && property.totalFloors != null && (
            <span className="flex items-center gap-1 text-gray-400">
              Floor {property.floor}/{property.totalFloors}
            </span>
          )}
        </div>

        {/* Price row */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xl font-bold text-gray-900 leading-none">
              ₹{property.rent.toLocaleString()}
              <span className="text-xs font-normal text-gray-400 ml-1">/mo</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Deposit</p>
            <p className="text-sm font-semibold text-gray-700">₹{property.deposit.toLocaleString()}</p>
          </div>
        </div>

        {/* Amenity pills */}
        {property.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {property.amenities.slice(0, 3).map((amenity) => (
              <span key={amenity} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {amenity}
              </span>
            ))}
            {property.amenities.length > 3 && (
              <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                +{property.amenities.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Freshness bar */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <span className={`flex items-center gap-1.5 text-xs font-medium ${freshness.textColor}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${freshness.dotColor}`} />
            {freshness.level === 'today' ? 'Posted today' : (
              <><Clock className="w-3 h-3" />{freshness.label}</>
            )}
          </span>
          {freshness.level === 'stale' && (
            <button
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium underline underline-offset-2"
            >
              <AlertCircle className="w-3 h-3" />
              Still available?
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

