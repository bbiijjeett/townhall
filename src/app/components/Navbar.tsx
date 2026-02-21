import { useState, useEffect } from 'react';
import { Home, LogOut, LayoutDashboard, Plus, User as UserIcon, MapPin, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from './ui/button';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';

export function Navbar() {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const [city, setCity] = useState<string | null>(null);
  const [cityLoading, setCityLoading] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    setCityLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } },
          );
          const data = await res.json();
          const addr = data.address ?? {};
          setCity(addr.city ?? addr.town ?? addr.village ?? addr.county ?? null);
        } catch {
          // silently ignore network errors
        } finally {
          setCityLoading(false);
        }
      },
      () => setCityLoading(false), // permission denied — fail silently
      { timeout: 8000 },
    );
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      toast.success('Logged out successfully');
    } catch {
      toast.error('Failed to log out. Please try again.');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center space-x-2"
          >
            <Home className="w-6 h-6 text-indigo-600" />
            <span className="text-xl font-semibold text-gray-900">RoingRent</span>
          </button>

          <div className="flex items-center space-x-4">
            {/* Current city */}
            {(city || cityLoading) && (
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500">
                {cityLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : (
                  <>
                    <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="font-medium text-gray-700">{city}</span>
                  </>
                )}
              </div>
            )}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2 focus:outline-none">
                    <span className="text-sm text-gray-700 hidden sm:inline">
                      {user.name}
                    </span>
                    <Avatar className="w-9 h-9 cursor-pointer ring-2 ring-transparent hover:ring-indigo-500 transition-all">
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                      <AvatarFallback className="bg-indigo-600 text-white text-sm">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>My Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/add-property')}>
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Add Property</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/')}>
                    <Home className="mr-2 h-4 w-4" />
                    <span>Browse Properties</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                onClick={() => navigate('/login')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
