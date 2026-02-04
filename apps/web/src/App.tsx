import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/auth';
import Layout from './components/Layout';
import HomePage from './pages/Home';
import MarketsPage from './pages/Markets';
import MarketDetailPage from './pages/MarketDetail';
import PortfolioPage from './pages/Portfolio';
import WalletPage from './pages/Wallet';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminMarkets from './pages/admin/Markets';
import AdminCreateMarket from './pages/admin/CreateMarket';
import AdminUsers from './pages/admin/Users';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Main app routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="markets" element={<MarketsPage />} />
        <Route path="markets/:category" element={<MarketsPage />} />
        <Route path="market/:id" element={<MarketDetailPage />} />
        <Route
          path="portfolio"
          element={
            <ProtectedRoute>
              <PortfolioPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="wallet"
          element={
            <ProtectedRoute>
              <WalletPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="markets" element={<AdminMarkets />} />
        <Route path="markets/create" element={<AdminCreateMarket />} />
        <Route path="users" element={<AdminUsers />} />
      </Route>
    </Routes>
  );
}

export default App;
