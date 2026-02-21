import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export interface Property {
  id: string;
  title: string;
  rent: number;
  deposit: number;
  bhk: string;
  location: string;
  description: string;
  images: string[];
  amenities: string[];
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  status: 'pending' | 'active' | 'expired';
  paymentStatus: 'pending' | 'paid';
  createdAt: Date;
  expiresAt: Date;
  // Additional fields
  area?: number; // in sq ft
  floor?: number;
  totalFloors?: number;
  availableFrom?: Date;
  furnishing?: 'Fully Furnished' | 'Semi Furnished' | 'Unfurnished';
  preferredTenants?: 'Family' | 'Bachelor' | 'Any';
  isPetFriendly?: boolean;
  latitude?: number;
  longitude?: number;
  /** Number of detail-page views; drives the Engagement weight in the ranking score. */
  viewCount?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
}

function mapSupabaseUser(supabaseUser: SupabaseUser): User {
  const meta = supabaseUser.user_metadata ?? {};
  return {
    id: supabaseUser.id,
    name: meta.name ?? meta.full_name ?? supabaseUser.email ?? '',
    email: supabaseUser.email ?? '',
    phone: meta.phone ?? '',
    avatarUrl: meta.avatar_url ?? meta.picture ?? undefined,
  };
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  properties: Property[];
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  addProperty: (property: Omit<Property, 'id' | 'ownerId' | 'status' | 'paymentStatus' | 'createdAt' | 'expiresAt'>) => Promise<string>;
  updatePropertyPayment: (propertyId: string) => Promise<void>;
  deleteProperty: (propertyId: string) => Promise<void>;
  getUserProperties: () => Property[];
  fetchProperties: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);

  // Fetch properties from Supabase
  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedProperties: Property[] = data.map(p => ({
          id: p.id,
          title: p.title,
          rent: p.rent,
          deposit: p.deposit,
          bhk: p.bhk,
          location: p.location,
          description: p.description,
          images: p.images || [],
          amenities: p.amenities || [],
          area: p.area,
          floor: p.floor,
          totalFloors: p.total_floors,
          availableFrom: p.available_from ? new Date(p.available_from) : undefined,
          furnishing: p.furnishing,
          preferredTenants: p.preferred_tenants,
          isPetFriendly: p.is_pet_friendly,
          latitude: p.latitude,
          longitude: p.longitude,
          viewCount: p.view_count ?? 0,
          ownerId: p.owner_id,
          ownerName: p.owner_name,
          ownerPhone: p.owner_phone,
          status: p.status,
          paymentStatus: p.payment_status,
          createdAt: new Date(p.created_at),
          expiresAt: new Date(p.expires_at),
        }));
        setProperties(mappedProperties);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
      setLoading(false);
    });

    // Fetch properties on mount
    fetchProperties();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard',
      },
    });
    if (error) throw new Error(error.message);
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    setUser(null);
  };

  const addProperty = async (property: Omit<Property, 'id' | 'ownerId' | 'status' | 'paymentStatus' | 'createdAt' | 'expiresAt'>) => {
    if (!user) throw new Error('User must be logged in to add property');
    
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('properties')
      .insert([{
        title: property.title,
        rent: property.rent,
        deposit: property.deposit,
        bhk: property.bhk,
        location: property.location,
        description: property.description,
        images: property.images,
        amenities: property.amenities,
        area: property.area,
        floor: property.floor,
        total_floors: property.totalFloors,
        available_from: property.availableFrom?.toISOString(),
        furnishing: property.furnishing,
        preferred_tenants: property.preferredTenants,
        is_pet_friendly: property.isPetFriendly,
        latitude: property.latitude,
        longitude: property.longitude,
        owner_id: user.id,
        owner_name: property.ownerName || user.name,
        owner_phone: property.ownerPhone,
        status: 'pending',
        payment_status: 'pending',
        expires_at: expiresAt.toISOString(),
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Failed to create property');

    // Refresh properties list
    await fetchProperties();
    
    return data.id;
  };

  const updatePropertyPayment = async (propertyId: string) => {
    const { error } = await supabase
      .from('properties')
      .update({
        payment_status: 'paid',
        status: 'active',
      })
      .eq('id', propertyId);

    if (error) throw new Error(error.message);

    // Refresh properties list
    await fetchProperties();
  };

  const deleteProperty = async (propertyId: string) => {
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId);

    if (error) throw new Error(error.message);

    // Refresh properties list
    await fetchProperties();
  };

  const getUserProperties = () => {
    if (!user) return [];
    return properties.filter(p => p.ownerId === user.id);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        properties,
        signInWithGoogle,
        logout,
        addProperty,
        updatePropertyPayment,
        deleteProperty,
        getUserProperties,
        fetchProperties,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
