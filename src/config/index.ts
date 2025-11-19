import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dex_orders',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '10'),
    rateLimit: parseInt(process.env.QUEUE_RATE_LIMIT || '100'),
    maxRetries: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
  },
  mock: {
    enabled: process.env.MOCK_DEX_ENABLED === 'true',
    failureRate: parseFloat(process.env.MOCK_FAILURE_RATE || '0.20'),
    basePriceSOLUSDC: parseFloat(process.env.MOCK_BASE_PRICE_SOL_USDC || '180.50'),
  },
};
