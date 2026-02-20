import { Home, Plus, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export function BottomNav() {
  const { user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 lg:hidden z-50">
      <div className="flex justify-around items-center h-16">
        <button
          onClick={() => navigate('/')}
          className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 ${
            currentPath === '/' ? 'text-indigo-600' : 'text-gray-500'
          }`}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs">Home</span>
        </button>

        {user && (
          <button
            onClick={() => navigate('/add-property')}
            className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 ${
              currentPath === '/add-property' ? 'text-indigo-600' : 'text-gray-500'
            }`}
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs">Post</span>
          </button>
        )}

        <button
          onClick={() => {
            if (user) {
              navigate('/dashboard');
            } else {
              navigate('/login');
            }
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 ${
            currentPath === '/dashboard' || currentPath === '/owner-dashboard' || currentPath === '/login' ? 'text-indigo-600' : 'text-gray-500'
          }`}
        >
          <User className="w-6 h-6" />
          <span className="text-xs">Profile</span>
        </button>
      </div>
    </div>
  );
}
