import axios from 'axios';
import { useAuthStore } from '../stores/auth';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const { refreshToken, setAuth, logout } = useAuthStore.getState();

      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;

          // Update auth state
          const { user } = useAuthStore.getState();
          if (user) {
            setAuth({ user, accessToken: newAccessToken, refreshToken: newRefreshToken });
          }

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch {
          logout();
        }
      } else {
        logout();
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  sendOtp: (phoneNumber: string) => api.post('/auth/phone/send-otp', { phoneNumber }),
  verifyOtp: (phoneNumber: string, code: string) =>
    api.post('/auth/phone/verify-otp', { phoneNumber, code }),
  register: (data: { phoneNumber: string; fullName: string; otpCode: string }) =>
    api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
};

// Markets API
export const marketsApi = {
  list: (params?: { category?: string; search?: string; page?: number }) =>
    api.get('/markets', { params }),
  getFeatured: () => api.get('/markets/featured'),
  getCategories: () => api.get('/markets/categories'),
  get: (id: string) => api.get(`/markets/${id}`),
  getOrderBook: (id: string, outcomeId?: string) =>
    api.get(`/markets/${id}/orderbook`, { params: { outcomeId } }),
  getTrades: (id: string, limit = 50) =>
    api.get(`/markets/${id}/trades`, { params: { limit } }),
  getChart: (id: string, outcomeId: string, params?: { interval?: string }) =>
    api.get(`/markets/${id}/chart/${outcomeId}`, { params }),
};

// Orders API (AMM-based)
export const ordersApi = {
  // Buy shares with amount
  buy: (data: { marketId: string; outcomeId: string; amount: number }) =>
    api.post('/orders/buy', data),

  // Sell shares
  sell: (data: { marketId: string; outcomeId: string; shares: number }) =>
    api.post('/orders/sell', data),

  // Get quote before trade
  getQuote: (params: {
    marketId: string;
    outcomeId: string;
    side: 'BUY' | 'SELL';
    amount?: number;
    shares?: number;
  }) => api.get('/orders/quote', { params }),

  // Legacy: place order (redirects to buy/sell)
  place: (data: {
    marketId: string;
    outcomeId: string;
    side: 'BUY' | 'SELL';
    price?: number;
    quantity?: number;
    amount?: number;
  }) => api.post('/orders', data),

  list: (params?: { marketId?: string; status?: string }) =>
    api.get('/orders', { params }),
  cancel: (id: string) => api.delete(`/orders/${id}`),
  getPositions: () => api.get('/orders/positions'),
};

// Wallet API
export const walletApi = {
  get: () => api.get('/wallet'),
  getTransactions: (params?: { page?: number; type?: string }) =>
    api.get('/wallet/transactions', { params }),
  getDepositMethods: () => api.get('/wallet/deposit-methods'),
  deposit: (data: { amount: number; methodId: string }) =>
    api.post('/wallet/deposit', data),
  withdraw: (data: { amount: number; methodId: string; destination: string }) =>
    api.post('/wallet/withdraw', data),
};

// Admin API
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  createMarket: (data: any) => api.post('/admin/markets', data),
  updateMarket: (id: string, data: any) => api.put(`/admin/markets/${id}`, data),
  openMarket: (id: string) => api.post(`/admin/markets/${id}/open`),
  resolveMarket: (id: string, winningOutcomeId: string) =>
    api.post(`/admin/markets/${id}/resolve`, { winningOutcomeId }),
  getUsers: (params?: { page?: number; search?: string }) =>
    api.get('/admin/users', { params }),
  createCategory: (data: { name: string; slug: string }) =>
    api.post('/admin/categories', data),
};
