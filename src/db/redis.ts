import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

// Support both REDIS_URL (Render, Railway) and individual config (local)
export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    })
  : new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
    });

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

export const disconnectRedis = async () => {
  await redis.quit();
  logger.info('Redis disconnected');
};
