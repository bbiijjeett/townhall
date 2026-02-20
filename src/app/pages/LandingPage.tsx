import { useState, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { PropertyCard } from '../components/PropertyCard';
import { FilterBar, FilterOptions } from '../components/FilterBar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import heroBg from '../../assets/hero_land.avif';

export function LandingPage() {
  const navigate = useNavigate();
  const { properties, user } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({
    bhk: [],
    rentRange: [0, 25000],
    locations: [],
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const availableLocations = useMemo(() => {
    return Array.from(new Set(properties.map(p => p.location)));
  }, [properties]);

  const filteredProperties = useMemo(() => {
    return properties.filter(property => {
      // Status filter
      if (property.status !== 'active') return false;

      // Search filter
      if (searchQuery && !property.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !property.location.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // BHK filter
      if (filters.bhk.length > 0 && !filters.bhk.includes(property.bhk)) {
        return false;
      }

      // Rent range filter
      if (property.rent < filters.rentRange[0] || property.rent > filters.rentRange[1]) {
        return false;
      }

      // Location filter
      if (filters.locations.length > 0 && !filters.locations.includes(property.location)) {
        return false;
      }

      // Category filter
      if (selectedCategory === '1BHK' && property.bhk !== '1BHK') return false;
      if (selectedCategory === '2BHK' && property.bhk !== '2BHK') return false;
      if (selectedCategory === 'Under ₹10k' && property.rent >= 10000) return false;
      if (selectedCategory === 'Under ₹15k' && property.rent >= 15000) return false;

      return true;
    });
  }, [properties, searchQuery, filters, selectedCategory]);

  const categories = [
    { label: '1BHK', value: '1BHK' },
    { label: '2BHK', value: '2BHK' },
    { label: 'Under ₹10k', value: 'Under ₹10k' },
    { label: 'Under ₹15k', value: 'Under ₹15k' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gray-900 text-white min-h-[500px] flex flex-col justify-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src={heroBg} 
            alt="Hero Background" 
            className="w-full h-full object-cover"
          />
          {/* Overlay to ensure text readability */}
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4">
            Find Your Perfect <span className="text-indigo-400">Home</span>
          </h1>
          <p className="text-lg text-indigo-200 mb-8 max-w-2xl mx-auto">
            Discover verified rental properties in your town. No broker fees. Direct owner contact.
          </p>

          {/* Modern Search Bar */}
          <div className="relative max-w-2xl mx-auto transform transition-all hover:scale-[1.01] duration-200">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by location, landmark, or property..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-4 bg-white text-gray-900 placeholder-gray-500 rounded-full shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
            />
          </div>

          {/* Modern Category Pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {categories.map((category) => {
              const isActive = selectedCategory === category.value;
              return (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(
                    isActive ? null : category.value
                  )}
                  className={`
                    px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 border
                    ${isActive 
                      ? 'bg-white text-indigo-900 border-white shadow-lg scale-105' 
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm'
                    }
                  `}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <FilterBar
          onFilterChange={setFilters}
          availableLocations={availableLocations}
        />

        {/* Results Count */}
        <div className="mt-6 mb-4">
          <p className="text-gray-600">
            {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'} found
          </p>
        </div>

        {/* Property Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onClick={() => navigate('/property/' + property.id)}
            />
          ))}
        </div>

        {filteredProperties.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No properties found matching your criteria.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery('');
                setFilters({ bhk: [], rentRange: [0, 25000], locations: [] });
                setSelectedCategory(null);
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Floating Post Property Button */}
      {user && (
        <Button
          onClick={() => navigate('/add-property')}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full w-14 h-14 shadow-lg lg:w-auto lg:h-auto lg:rounded-lg lg:px-6 lg:py-3 z-40"
        >
          <Plus className="w-6 h-6 lg:mr-2" />
          <span className="hidden lg:inline">Post Property</span>
        </Button>
      )}
    </div>
  );
}