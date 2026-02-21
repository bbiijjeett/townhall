import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

// Fix Leaflet default marker icons with bundlers
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationPickerProps {
  searchQuery: string; // address string to auto-geocode
  latitude?: number;
  longitude?: number;
  onChange: (lat: number, lng: number) => void;
}

export function LocationPicker({ searchQuery, latitude, longitude, onChange }: LocationPickerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [hasPin, setHasPin] = useState(!!latitude && !!longitude);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const defaultLat = latitude || 20.5937;
    const defaultLng = longitude || 78.9629;
    const defaultZoom = latitude ? 15 : 5;

    const map = L.map(containerRef.current).setView([defaultLat, defaultLng], defaultZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    if (latitude && longitude) {
      const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      }
      setHasPin(true);
      onChange(lat, lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update marker when lat/lng props change externally
  useEffect(() => {
    if (!mapRef.current || !latitude || !longitude) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
    } else {
      const marker = L.marker([latitude, longitude], { draggable: true }).addTo(mapRef.current);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    }
    mapRef.current.setView([latitude, longitude], 15);
    setHasPin(true);
  }, [latitude, longitude]);

  const geocodeAddress = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please fill in at least city name to locate on map');
      return;
    }
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (!data.length) {
        toast.error('Location not found. Try a more specific address.');
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      onChange(lat, lng);
      toast.success('Location found! You can drag the pin to fine-tune.');
    } catch {
      toast.error('Failed to find location. Please try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={geocodeAddress}
          disabled={isGeocoding}
          className="flex-1 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
        >
          {isGeocoding ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Search className="w-4 h-4 mr-2" />
          )}
          {isGeocoding ? 'Locating...' : 'Find on Map'}
        </Button>
        {hasPin && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (markerRef.current && mapRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
              }
              setHasPin(false);
              onChange(0, 0);
            }}
            className="text-red-500 hover:text-red-700"
          >
            Clear Pin
          </Button>
        )}
      </div>

      <div
        ref={containerRef}
        className="w-full h-64 rounded-lg border border-gray-200 overflow-hidden z-0"
        style={{ position: 'relative' }}
      />

      <p className="text-xs text-gray-500 flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        {hasPin
          ? `Pin set${latitude ? ` — ${latitude.toFixed(5)}, ${longitude?.toFixed(5)}` : ''}. Drag to adjust.`
          : 'Click "Find on Map" to auto-locate, or click on the map to drop a pin manually.'}
      </p>
    </div>
  );
}
