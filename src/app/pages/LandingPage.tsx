import { useState, useMemo } from 'react';
import { Search, Plus, ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { computeListingScore } from '../../lib/rankingScore';
import { useApp } from '../context/AppContext';
import { useSavedProperties } from '../hooks/useSavedProperties';
import { PropertyCard } from '../components/PropertyCard';
import { FilterBar, FilterOptions } from '../components/FilterBar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
const heroBg = 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1920&q=80';

export function LandingPage() {
  const navigate = useNavigate();
  const { properties, user } = useApp();
  const { isSaved, toggleSave } = useSavedProperties();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({
    bhk: [],
    rentRange: [0, 100000],
    furnishing: [],
    amenities: [],
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recommended' | 'newest' | 'price_asc' | 'price_desc'>('recommended');


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

      // Furnishing filter
      if (filters.furnishing.length > 0 && (!property.furnishing || !filters.furnishing.includes(property.furnishing))) {
        return false;
      }

      // Amenities filter — property must include ALL selected amenities
      if (filters.amenities.length > 0 && !filters.amenities.every(a => property.amenities.includes(a))) {
        return false;
      }

      // Category filter
      if (selectedCategory === '1BHK' && property.bhk !== '1BHK') return false;
      if (selectedCategory === '2BHK' && property.bhk !== '2BHK') return false;
      if (selectedCategory === 'Under ₹10k' && property.rent >= 10000) return false;
      if (selectedCategory === 'Under ₹15k' && property.rent >= 15000) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'recommended') return computeListingScore(b) - computeListingScore(a);
      if (sortBy === 'newest') return b.createdAt.getTime() - a.createdAt.getTime();
      if (sortBy === 'price_asc') return a.rent - b.rent;
      if (sortBy === 'price_desc') return b.rent - a.rent;
      return 0;
    });
  }, [properties, searchQuery, filters, selectedCategory, sortBy]);

  const categories = [
    { label: '1BHK', value: '1BHK' },
    { label: '2BHK', value: '2BHK' },
    { label: 'Under ₹10k', value: 'Under ₹10k' },
    { label: 'Under ₹15k', value: 'Under ₹15k' },
  ];

  const handleToggleSave = async (propertyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.info('Please sign in to save properties');
      navigate('/login');
      return;
    }
    await toggleSave(propertyId);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gray-900 text-white min-h-[500px] flex flex-col justify-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroBg}
            alt="Modern city skyline"
            className="w-full h-full object-cover object-center"
          />
          {/* Dark gradient overlay for sharp contrast + readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900/60 via-gray-900/50 to-gray-900/70" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4">
            Find Your Perfect <span className="text-indigo-400">Home</span>
          </h1>
          <p className="text-lg text-indigo-200 mb-8 max-w-2xl mx-auto">
            Always know who you're talking to.
          </p>

          {/* Polished Search Bar */}
          <div className="relative max-w-2xl mx-auto transition-transform hover:scale-[1.01] duration-200">
            {/* Glow ring on focus */}
            <div className="absolute -inset-0.5 rounded-full bg-indigo-400/30 blur-md opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
            <div className="relative flex items-center bg-white rounded-full shadow-[0_8px_40px_rgba(0,0,0,0.18)] overflow-hidden">
              <div className="pl-5 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-indigo-400" />
              </div>
              <input
                type="text"
                placeholder="Search by location, landmark, or property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 pl-3 pr-5 py-4 bg-transparent text-gray-900 placeholder-gray-400 text-base border-0 outline-none focus:outline-none focus:ring-0 caret-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="pr-5 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
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
        <FilterBar onFilterChange={setFilters} />

        {/* Results Count + Sort */}
        <div className="mt-6 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-gray-600">
            {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'} found
          </p>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="recommended">Recommended</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
            </select>
          </div>
        </div>

        {/* Property Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onClick={() => navigate('/property/' + property.id)}
              isSaved={isSaved(property.id)}
              onToggleSave={(e) => handleToggleSave(property.id, e)}
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
                setFilters({ bhk: [], rentRange: [0, 100000], furnishing: [], amenities: [] });
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