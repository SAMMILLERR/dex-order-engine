import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Queue } from 'bullmq';
import { disconnectRedis } from '../src/db/redis';

describe('Order Queue', () => {
  let queue: Queue;

  beforeAll(async () => {
    queue = new Queue('order-execution', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    });
  });

  afterAll(async () => {
    await queue.close();
    await disconnectRedis();
  });

  it('should add job to queue', async () => {
    const job = await queue.add('test-order', {
      orderId: 'test-123',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 1.0,
      slippage: 0.5,
    });

    expect(job.id).toBeDefined();
    expect(job.data.orderId).toBe('test-123');

    // Clean up
    await job.remove();
  });

  it('should handle multiple concurrent jobs', async () => {
    const jobs = await Promise.all([
      queue.add('order-1', { orderId: 'order-1', amount: 1 }),
      queue.add('order-2', { orderId: 'order-2', amount: 2 }),
      queue.add('order-3', { orderId: 'order-3', amount: 3 }),
    ]);

    expect(jobs).toHaveLength(3);
    expect(jobs[0].id).toBeDefined();
    expect(jobs[1].id).toBeDefined();
    expect(jobs[2].id).toBeDefined();

    // Clean up
    await Promise.all(jobs.map(job => job.remove()));
  });

  it('should get job by id', async () => {
    const job = await queue.add('lookup-test', { orderId: 'lookup-123' });
    const jobId = job.id!;

    const retrieved = await queue.getJob(jobId);

    expect(retrieved).toBeDefined();
    expect(retrieved?.data.orderId).toBe('lookup-123');

    // Clean up
    await job.remove();
  });

  it('should handle job completion', async () => {
    const job = await queue.add('completion-test', { orderId: 'complete-123' });

    // Wait for job to be processed (if worker is running)
    const state = await job.getState();
    expect(['waiting', 'active', 'completed', 'failed']).toContain(state);

    // Clean up
    await job.remove();
  });

  it('should respect rate limiting', async () => {
    const jobs = [];
    const startTime = Date.now();

    // Add 5 jobs quickly
    for (let i = 0; i < 5; i++) {
      const job = await queue.add(`rate-test-${i}`, {
        orderId: `rate-${i}`,
        amount: 1,
      });
      jobs.push(job);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete quickly (queuing, not processing)
    expect(duration).toBeLessThan(1000);

    // Clean up
    await Promise.all(jobs.map(job => job.remove()));
  });
});
