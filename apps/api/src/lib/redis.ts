import Redis from 'ioredis';
import { config } from '../config/index.js';

// Check if Redis is configured
const redisEnabled = config.redisUrl && config.redisUrl.length > 0;

let redis: Redis | null = null;

if (redisEnabled) {
  redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('⚠️ Redis unavailable, running without cache');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 1000);
    },
  });

  redis.on('error', () => {
    // Silently ignore - we handle this gracefully
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected');
  });
} else {
  console.log('ℹ️ Redis not configured, running without cache');
}

// Helper functions that work without Redis
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!redis) return;
    try {
      const data = JSON.stringify(value);
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, data);
      } else {
        await redis.set(key, data);
      }
    } catch {
      // Ignore cache errors
    }
  },

  async del(key: string): Promise<void> {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch {
      // Ignore cache errors
    }
  },

  async incr(key: string): Promise<number> {
    if (!redis) return 1; // Always allow when Redis is down
    try {
      return await redis.incr(key);
    } catch {
      return 1;
    }
  },

  async expire(key: string, seconds: number): Promise<void> {
    if (!redis) return;
    try {
      await redis.expire(key, seconds);
    } catch {
      // Ignore
    }
  },

  async invalidatePattern(pattern: string): Promise<void> {
    if (!redis) return;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {
      // Ignore cache errors
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

export { redis };
