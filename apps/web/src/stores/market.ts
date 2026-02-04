import { create } from 'zustand';
import { api } from '../services/api';

interface Outcome {
  id: string;
  name: string;
  currentPrice: number;
  totalVolume: number;
}

interface Market {
  id: string;
  title: string;
  description?: string;
  marketType: 'BINARY' | 'MULTIPLE_CHOICE';
  status: string;
  expiresAt: string;
  totalVolume: number;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  outcomes: Outcome[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  iconUrl?: string;
  _count: {
    markets: number;
  };
}

interface OrderBookEntry {
  price: number;
  quantity: number;
}

interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

interface MarketState {
  markets: Market[];
  featuredMarkets: Market[];
  categories: Category[];
  currentMarket: Market | null;
  orderBooks: Record<string, OrderBook>;
  isLoading: boolean;

  fetchMarkets: (params?: { category?: string; search?: string }) => Promise<void>;
  fetchFeaturedMarkets: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchMarket: (id: string) => Promise<void>;
  fetchOrderBook: (marketId: string, outcomeId?: string) => Promise<void>;
  updatePrice: (outcomeId: string, price: number) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  markets: [],
  featuredMarkets: [],
  categories: [],
  currentMarket: null,
  orderBooks: {},
  isLoading: false,

  fetchMarkets: async (params) => {
    set({ isLoading: true });
    try {
      const response = await api.get('/markets', { params });
      set({ markets: response.data.data.markets, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchFeaturedMarkets: async () => {
    try {
      const response = await api.get('/markets/featured');
      set({ featuredMarkets: response.data.data });
    } catch (error) {
      console.error('Failed to fetch featured markets:', error);
    }
  },

  fetchCategories: async () => {
    try {
      const response = await api.get('/markets/categories');
      set({ categories: response.data.data });
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  },

  fetchMarket: async (id) => {
    set({ isLoading: true });
    try {
      const response = await api.get(`/markets/${id}`);
      set({ currentMarket: response.data.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchOrderBook: async (marketId, outcomeId) => {
    try {
      const response = await api.get(`/markets/${marketId}/orderbook`, {
        params: { outcomeId },
      });
      set({ orderBooks: response.data.data });
    } catch (error) {
      console.error('Failed to fetch order book:', error);
    }
  },

  updatePrice: (outcomeId, price) => {
    const { currentMarket } = get();
    if (currentMarket) {
      const updatedOutcomes = currentMarket.outcomes.map((o) =>
        o.id === outcomeId ? { ...o, currentPrice: price } : o
      );
      set({ currentMarket: { ...currentMarket, outcomes: updatedOutcomes } });
    }
  },
}));
