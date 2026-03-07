import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useSavedProperties } from '../hooks/useSavedProperties';
import { PropertyCard } from '../components/PropertyCard';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';

export function SavedPropertiesPage() {
  const navigate  = useNavigate();
  const { user, properties } = useApp();
  const { savedIds, isLoading, toggleSave } = useSavedProperties();

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="p-8 text-center max-w-sm w-full">
          <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to see saved properties</h2>
          <p className="text-gray-600 mb-6 text-sm">Save your favourite listings and access them any time.</p>
          <Button onClick={() => navigate('/login')} className="bg-indigo-600 hover:bg-indigo-700 w-full">
            Login
          </Button>
        </Card>
      </div>
    );
  }

  const savedProperties = properties.filter(p => savedIds.has(p.id));

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Heart className="w-6 h-6 text-red-500 fill-red-500" />
          <h1 className="text-2xl font-bold text-gray-900">Saved Properties</h1>
          {!isLoading && savedProperties.length > 0 && (
            <span className="text-sm text-gray-500">({savedProperties.length})</span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : savedProperties.length === 0 ? (
          <Card className="p-12 text-center">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No saved properties yet</h3>
            <p className="text-gray-600 mb-6 text-sm">
              Tap the heart icon on any listing to save it here for easy access.
            </p>
            <Button onClick={() => navigate('/')} className="bg-indigo-600 hover:bg-indigo-700">
              Browse Properties
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedProperties.map(property => (
              <PropertyCard
                key={property.id}
                property={property}
                isSaved
                onToggleSave={async (e) => {
                  e.stopPropagation();
                  await toggleSave(property.id);
                }}
                onClick={() => navigate('/property/' + property.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
