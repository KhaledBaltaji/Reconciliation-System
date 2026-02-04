import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Home,
  TrendingUp,
  Wallet,
  Briefcase,
  User,
  LogOut,
  Settings,
  Menu,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useMarketStore } from '../stores/market';

export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { categories, fetchCategories } = useMarketStore();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') !== 'light';
    }
    return true;
  });

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <header className="bg-gray-800 dark:bg-gray-800 light:bg-white border-b border-gray-700 dark:border-gray-700 light:border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        {/* Main header */}
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="relative">
              <TrendingUp className="h-8 w-8 text-primary-500" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-success-500 rounded-full animate-pulse"></span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                PredictArabia
              </span>
              <span className="text-[10px] text-gray-500 -mt-1">Prediction Markets</span>
            </div>
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
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 text-yellow-400" />
              ) : (
                <Moon className="h-5 w-5 text-gray-300" />
              )}
            </button>

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
