import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Slider } from './ui/slider';

export interface FilterOptions {
  bhk: string[];
  rentRange: [number, number];
  furnishing: string[];
  amenities: string[];
}

interface FilterBarProps {
  onFilterChange: (filters: FilterOptions) => void;
}

const AMENITY_OPTIONS = [
  'Parking', 'WiFi', 'AC', 'Geyser', 'Power Backup',
  'Lift', 'Security', 'Gym', 'Swimming Pool', 'Water Supply',
];

const FURNISHING_OPTIONS = ['Fully Furnished', 'Semi Furnished', 'Unfurnished'];

export function FilterBar({ onFilterChange }: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [bhk, setBhk] = useState<string[]>([]);
  const [rentRange, setRentRange] = useState<[number, number]>([0, 25000]);
  const [furnishing, setFurnishing] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);

  const emit = (
    newBhk = bhk,
    newRange = rentRange,
    newFurnishing = furnishing,
    newAmenities = amenities,
  ) => onFilterChange({ bhk: newBhk, rentRange: newRange, furnishing: newFurnishing, amenities: newAmenities });

  const handleBhkToggle = (value: string) => {
    const next = bhk.includes(value) ? bhk.filter(b => b !== value) : [...bhk, value];
    setBhk(next);
    emit(next);
  };

  const handleFurnishingToggle = (value: string) => {
    const next = furnishing.includes(value) ? furnishing.filter(f => f !== value) : [...furnishing, value];
    setFurnishing(next);
    emit(bhk, rentRange, next);
  };

  const handleAmenityToggle = (value: string) => {
    const next = amenities.includes(value) ? amenities.filter(a => a !== value) : [...amenities, value];
    setAmenities(next);
    emit(bhk, rentRange, furnishing, next);
  };

  const handleRentRangeChange = (value: number[]) => {
    const newRange: [number, number] = [value[0], value[1]];
    setRentRange(newRange);
    emit(bhk, newRange);
  };

  const clearFilters = () => {
    setBhk([]);
    setRentRange([0, 25000]);
    setFurnishing([]);
    setAmenities([]);
    onFilterChange({ bhk: [], rentRange: [0, 25000], furnishing: [], amenities: [] });
  };

  const hasActiveFilters = bhk.length > 0 || furnishing.length > 0 || amenities.length > 0 || rentRange[0] > 0 || rentRange[1] < 25000;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
        </Button>
        
        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="text-sm text-indigo-600"
          >
            Clear All
          </Button>
        )}
      </div>

      {showFilters && (
        <Card className="p-4 space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">BHK Type</h3>
            <div className="flex flex-wrap gap-2">
              {['1BHK', '2BHK', '3BHK', '4BHK'].map((value) => (
                <Button
                  key={value}
                  variant={bhk.includes(value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleBhkToggle(value)}
                  className={bhk.includes(value) ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              Rent Range: ₹{rentRange[0].toLocaleString()} - ₹{rentRange[1].toLocaleString()}
            </h3>
            <Slider
              value={rentRange}
              onValueChange={handleRentRangeChange}
              min={0}
              max={25000}
              step={1000}
              className="w-full"
            />
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Furnishing</h3>
            <div className="flex flex-wrap gap-2">
              {FURNISHING_OPTIONS.map((value) => (
                <Button
                  key={value}
                  variant={furnishing.includes(value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFurnishingToggle(value)}
                  className={furnishing.includes(value) ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((value) => (
                <Button
                  key={value}
                  variant={amenities.includes(value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleAmenityToggle(value)}
                  className={amenities.includes(value) ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
