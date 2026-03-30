import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Camera, LogIn, LogOut, User as UserIcon, LayoutDashboard, UserCircle } from 'lucide-react';

export function Navbar() {
  const { user, login, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-neutral-200 sticky top-0 z-50">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl tracking-tight min-w-0">
          <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 shrink-0" />
          <span>SnapSearch</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/client" className="hidden md:flex items-center gap-2 text-sm font-bold text-neutral-600 hover:text-orange-500 transition-colors">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link to="/profile" className="flex items-center gap-2 text-sm font-medium hover:text-orange-500 transition-colors min-w-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-neutral-100 shrink-0" />
                ) : (
                  <UserCircle className="w-8 h-8 p-1 bg-neutral-100 rounded-full shrink-0" />
                )}
                <span className="hidden sm:inline truncate max-w-32">{user.displayName}</span>
              </Link>
              <button
                onClick={logout}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-full font-medium hover:bg-orange-600 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Login</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
