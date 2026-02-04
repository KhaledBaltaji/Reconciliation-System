import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
  Home,
  TrendingUp,
  Wallet,
  Briefcase,
  User,
  LogOut,
  Settings,
  Menu,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useMarketStore } from '../stores/market';

export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { categories, fetchCategories } = useMarketStore();

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        {/* Main header */}
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary-500" />
            <span className="text-xl font-bold">PredictMarket</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <Link
              to="/markets"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition"
            >
              <TrendingUp className="h-4 w-4" />
              Markets
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  to="/portfolio"
                  className="flex items-center gap-2 text-gray-300 hover:text-white transition"
                >
                  <Briefcase className="h-4 w-4" />
                  Portfolio
                </Link>
                <Link
                  to="/wallet"
                  className="flex items-center gap-2 text-gray-300 hover:text-white transition"
                >
                  <Wallet className="h-4 w-4" />
                  Wallet
                </Link>
              </>
            )}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {/* Balance display */}
                <div className="hidden sm:block bg-gray-700 rounded-lg px-3 py-1.5">
                  <span className="text-sm text-gray-400">Balance:</span>
                  <span className="ml-2 font-mono font-semibold text-success-500">
                    ${user?.wallet?.balanceUsd?.toLocaleString() || '0.00'}
                  </span>
                </div>

                {/* User menu */}
                <div className="relative group">
                  <button className="flex items-center gap-2 text-gray-300 hover:text-white">
                    <User className="h-5 w-5" />
                    <span className="hidden sm:inline">{user?.fullName}</span>
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="py-2">
                      <div className="px-4 py-2 border-b border-gray-700">
                        <p className="text-sm font-medium">{user?.fullName}</p>
                        <p className="text-xs text-gray-500">{user?.phoneNumber}</p>
                      </div>
                      {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                        >
                          <Settings className="h-4 w-4" />
                          Admin Panel
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-ghost text-sm">
                  Login
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Category navigation */}
        <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide">
          <Link
            to="/markets"
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg whitespace-nowrap transition"
          >
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/markets/${category.slug}`}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg whitespace-nowrap transition"
            >
              {category.name}
              {category._count.markets > 0 && (
                <span className="ml-1 text-xs text-gray-500">
                  ({category._count.markets})
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
