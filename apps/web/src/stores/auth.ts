import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface User {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  kycStatus: string;
  wallet?: {
    balanceUsd: number;
    lockedBalance: number;
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setAuth: (data: { user: User; accessToken: string; refreshToken: string }) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: true,
      isAuthenticated: false,

      setAuth: ({ user, accessToken, refreshToken }) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      checkAuth: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isLoading: false });
          return;
        }

        try {
          const response = await api.get('/auth/me');
          set({
            user: response.data.data,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          // Try to refresh token
          const { refreshToken } = get();
          if (refreshToken) {
            try {
              const refreshResponse = await api.post('/auth/refresh', { refreshToken });
              set({
                accessToken: refreshResponse.data.data.accessToken,
                refreshToken: refreshResponse.data.data.refreshToken,
              });
              // Retry getting user
              const userResponse = await api.get('/auth/me');
              set({
                user: userResponse.data.data,
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            } catch {
              // Refresh failed
            }
          }
          // Clear auth state
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      updateUser: (userData) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...userData } });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
