import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

export interface FilterOptions {
  bhk: string[];
  rentRange: [number, number];
  locations: string[];
}

interface FilterBarProps {
  onFilterChange: (filters: FilterOptions) => void;
  availableLocations: string[];
}

export function FilterBar({ onFilterChange, availableLocations }: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [bhk, setBhk] = useState<string[]>([]);
  const [rentRange, setRentRange] = useState<[number, number]>([0, 25000]);
  const [locations, setLocations] = useState<string[]>([]);

  const handleBhkToggle = (value: string) => {
    const newBhk = bhk.includes(value)
      ? bhk.filter(b => b !== value)
      : [...bhk, value];
    setBhk(newBhk);
    onFilterChange({ bhk: newBhk, rentRange, locations });
  };

  const handleLocationToggle = (location: string) => {
    const newLocations = locations.includes(location)
      ? locations.filter(l => l !== location)
      : [...locations, location];
    setLocations(newLocations);
    onFilterChange({ bhk, rentRange, locations: newLocations });
  };

  const handleRentRangeChange = (value: number[]) => {
    const newRange: [number, number] = [value[0], value[1]];
    setRentRange(newRange);
    onFilterChange({ bhk, rentRange: newRange, locations });
  };

  const clearFilters = () => {
    setBhk([]);
    setRentRange([0, 25000]);
    setLocations([]);
    onFilterChange({ bhk: [], rentRange: [0, 25000], locations: [] });
  };

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
        
        {(bhk.length > 0 || locations.length > 0 || rentRange[0] > 0 || rentRange[1] < 25000) && (
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
            <h3 className="font-semibold text-gray-900 mb-3">Location</h3>
            <div className="space-y-2">
              {availableLocations.map((location) => (
                <div key={location} className="flex items-center space-x-2">
                  <Checkbox
                    id={location}
                    checked={locations.includes(location)}
                    onCheckedChange={() => handleLocationToggle(location)}
                  />
                  <Label
                    htmlFor={location}
                    className="text-sm text-gray-700 cursor-pointer"
                  >
                    {location}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
