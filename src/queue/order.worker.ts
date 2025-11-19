import { Worker, Job } from 'bullmq';
import { redis } from '../db/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { OrderJobData } from './order.queue';
import { orderService } from '../services/order.service';
import { DexRouterService } from '../services/dex-router.service';
import { websocketService } from '../services/websocket.service';

const dexRouter = new DexRouterService();

/**
 * Process order execution job
 */
async function processOrder(job: Job<OrderJobData>) {
  const { orderId, tokenIn, tokenOut, amount, slippage } = job.data;

  logger.info(`Processing order ${orderId} (Attempt ${job.attemptsMade + 1})`);

  try {
    // Step 1: Pending status (already set when order was created)
    websocketService.broadcastToOrder(orderId, 'pending', {
      message: 'Order received and queued',
    });

    // Step 2: Routing - Compare DEX quotes
    await orderService.updateStatus(orderId, 'routing');
    websocketService.broadcastToOrder(orderId, 'routing', {
      message: 'Comparing DEX prices...',
    });

    const bestQuote = await dexRouter.getBestRoute({
      tokenIn,
      tokenOut,
      amount,
      slippage,
    });

    await orderService.updateStatus(orderId, 'routing', {
      dex: bestQuote.dex,
      selectedPrice: bestQuote.price,
      amountOut: bestQuote.amountOut,
    });

    websocketService.broadcastToOrder(orderId, 'routing', {
      message: `Best route selected: ${bestQuote.dex}`,
      selectedDex: bestQuote.dex,
      price: bestQuote.price,
      estimatedAmountOut: bestQuote.amountOut,
    });

    // Step 3: Building transaction
    await orderService.updateStatus(orderId, 'building');
    websocketService.broadcastToOrder(orderId, 'building', {
      message: `Creating transaction on ${bestQuote.dex}...`,
    });

    // Step 4: Submitted - Execute swap
    await orderService.updateStatus(orderId, 'submitted');
    websocketService.broadcastToOrder(orderId, 'submitted', {
      message: 'Transaction sent to network...',
    });

    const executionResult = await dexRouter.executeSwap(
      bestQuote.dex,
      { tokenIn, tokenOut, amount, slippage },
      bestQuote
    );

    // Step 5: Confirmed - Transaction successful
    await orderService.updateStatus(orderId, 'confirmed', {
      txHash: executionResult.txHash,
      executedPrice: executionResult.executedPrice,
      actualAmountOut: executionResult.actualAmountOut,
    });

    websocketService.broadcastToOrder(orderId, 'confirmed', {
      message: 'Transaction confirmed!',
      txHash: executionResult.txHash,
      dex: executionResult.dex,
      executedPrice: executionResult.executedPrice,
      actualAmountOut: executionResult.actualAmountOut,
      explorerUrl: executionResult.explorerUrl,
      duration: `${((Date.now() - job.timestamp) / 1000).toFixed(2)}s`,
    });

    // Close WebSocket connection after successful execution
    setTimeout(() => {
      websocketService.closeConnection(orderId);
    }, 1000);

    logger.info(`Order ${orderId} completed successfully`);
  } catch (error: any) {
    logger.error(`Order ${orderId} failed:`, error);

    // Increment attempt counter
    await orderService.incrementAttempts(orderId);

    const willRetry = job.attemptsMade + 1 < config.queue.maxRetries;

    if (!willRetry) {
      // Final failure
      await orderService.updateStatus(orderId, 'failed', {
        error: error.message,
      });

      websocketService.broadcastToOrder(orderId, 'failed', undefined, error.message);

      // Close WebSocket connection after failure
      setTimeout(() => {
        websocketService.closeConnection(orderId);
      }, 1000);
    } else {
      // Notify about retry
      websocketService.broadcastToOrder(orderId, 'failed', {
        message: `Execution failed, retrying... (Attempt ${job.attemptsMade + 1}/${config.queue.maxRetries})`,
        error: error.message,
        willRetry: true,
      });
    }

    throw error; // Re-throw to trigger BullMQ retry
  }
}

/**
 * Create and start order worker
 */
export const startOrderWorker = () => {
  const worker = new Worker<OrderJobData>('order-execution', processOrder, {
    connection: redis,
    concurrency: config.queue.concurrency,
    limiter: {
      max: config.queue.rateLimit,
      duration: 60000, // Per minute
    },
  });

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    logger.error('Worker error:', err);
  });

  logger.info('Order worker started', {
    concurrency: config.queue.concurrency,
    rateLimit: `${config.queue.rateLimit}/min`,
  });

  return worker;
};
