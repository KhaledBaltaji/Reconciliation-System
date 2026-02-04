import Redis from 'ioredis';
import { config } from '../config/index.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

// Helper functions for common operations
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const data = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, data);
    } else {
      await redis.set(key, data);
    }
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  async invalidatePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },
};

// Key patterns
export const CACHE_KEYS = {
  orderBook: (marketId: string, outcomeId: string) => `orderbook:${marketId}:${outcomeId}`,
  marketPrice: (outcomeId: string) => `price:${outcomeId}`,
  userSession: (token: string) => `session:${token}`,
  otpAttempts: (phone: string) => `otp:attempts:${phone}`,
};
