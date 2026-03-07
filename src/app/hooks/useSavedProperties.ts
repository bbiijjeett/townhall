import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../context/AppContext';

interface UseSavedPropertiesResult {
  savedIds: Set<string>;
  isLoading: boolean;
  isSaved: (propertyId: string) => boolean;
  toggleSave: (propertyId: string) => Promise<void>;
}

export function useSavedProperties(): UseSavedPropertiesResult {
  const { user } = useApp();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }

    setIsLoading(true);
    supabase
      .from('saved_properties')
      .select('property_id')
      .then(({ data }) => {
        setSavedIds(new Set((data ?? []).map((r: { property_id: string }) => r.property_id)));
        setIsLoading(false);
      });
  }, [user?.id]);

  const toggleSave = useCallback(
    async (propertyId: string) => {
      if (!user) return;

      if (savedIds.has(propertyId)) {
        // Optimistic remove
        setSavedIds(prev => {
          const next = new Set(prev);
          next.delete(propertyId);
          return next;
        });
        await supabase
          .from('saved_properties')
          .delete()
          .eq('property_id', propertyId)
          .eq('tenant_id', user.id);
      } else {
        // Optimistic add
        setSavedIds(prev => new Set([...prev, propertyId]));
        await supabase
          .from('saved_properties')
          .insert({ tenant_id: user.id, property_id: propertyId });
      }
    },
    [user, savedIds],
  );

  return {
    savedIds,
    isLoading,
    isSaved: (propertyId: string) => savedIds.has(propertyId),
    toggleSave,
  };
}
