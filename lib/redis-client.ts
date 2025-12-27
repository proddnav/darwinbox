import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.warn('⚠️  REDIS_URL not set, using in-memory fallback');
      // Return a mock client for development
      return createMockRedis();
    }

    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        connectTimeout: 10000,
      });

      redis.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      redis.on('connect', () => {
        console.log('✓ Connected to Redis');
      });
    } catch (error) {
      console.error('Failed to create Redis client:', error);
      return createMockRedis();
    }
  }

  return redis;
}

// Mock Redis for development when REDIS_URL is not set
function createMockRedis(): Redis {
  const mockData = new Map<string, { value: string; expiresAt?: number }>();
  
  // Cleanup expired keys periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of mockData.entries()) {
      if (data.expiresAt && now > data.expiresAt) {
        mockData.delete(key);
      }
    }
  }, 60000); // Check every minute

  return {
    get: async (key: string) => {
      const data = mockData.get(key);
      if (!data) return null;
      if (data.expiresAt && Date.now() > data.expiresAt) {
        mockData.delete(key);
        return null;
      }
      return data.value;
    },
    set: async (key: string, value: string) => {
      mockData.set(key, { value });
      return 'OK';
    },
    setex: async (key: string, seconds: number, value: string) => {
      const expiresAt = Date.now() + (seconds * 1000);
      mockData.set(key, { value, expiresAt });
      return 'OK';
    },
    del: async (key: string) => {
      mockData.delete(key);
      return 1;
    },
    exists: async (key: string) => {
      const data = mockData.get(key);
      if (!data) return 0;
      if (data.expiresAt && Date.now() > data.expiresAt) {
        mockData.delete(key);
        return 0;
      }
      return 1;
    },
    expire: async () => 1,
    ttl: async () => -1,
    keys: async (pattern: string) => Array.from(mockData.keys()),
    quit: async () => 'OK',
  } as any;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

