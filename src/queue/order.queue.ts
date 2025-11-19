import { Queue } from 'bullmq';
import { redis } from '../db/redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface OrderJobData {
  orderId: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  slippage: number;
}

/**
 * Order execution queue
 */
export const orderQueue = new Queue<OrderJobData>('order-execution', {
  connection: redis,
  defaultJobOptions: {
    attempts: config.queue.maxRetries,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  },
});

/**
 * Add order to execution queue
 */
export const addOrderToQueue = async (orderData: OrderJobData): Promise<void> => {
  await orderQueue.add('execute-order', orderData, {
    jobId: orderData.orderId, // Use orderId as jobId to prevent duplicates
  });

  logger.info(`Order ${orderData.orderId} added to queue`);
};

/**
 * Get queue stats
 */
export const getQueueStats = async () => {
  const [waiting, active, completed, failed] = await Promise.all([
    orderQueue.getWaitingCount(),
    orderQueue.getActiveCount(),
    orderQueue.getCompletedCount(),
    orderQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
};
