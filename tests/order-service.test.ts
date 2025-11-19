import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { orderService } from '../src/services/order.service';
import { connectDatabase, disconnectDatabase } from '../src/db/prisma';
import { OrderRequest } from '../src/types';

describe('Order Service', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it('should create a new order', async () => {
    const orderRequest: OrderRequest = {
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 1.0,
      slippage: 0.5,
    };

    const order = await orderService.createOrder(orderRequest);

    expect(order.id).toBeDefined();
    expect(order.status).toBe('pending');
    expect(order.tokenIn).toBe(orderRequest.tokenIn);
    expect(order.tokenOut).toBe(orderRequest.tokenOut);
    expect(order.amount).toBe(orderRequest.amount);
    expect(order.slippage).toBe(orderRequest.slippage);
  });

  it('should retrieve order by id', async () => {
    const orderRequest: OrderRequest = {
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 2.0,
      slippage: 1.0,
    };

    const created = await orderService.createOrder(orderRequest);
    const retrieved = await orderService.getOrder(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.amount).toBe(2.0);
  });

  it('should update order status', async () => {
    const orderRequest: OrderRequest = {
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 1.5,
      slippage: 0.5,
    };

    const order = await orderService.createOrder(orderRequest);
    
    const updated = await orderService.updateStatus(order.id, 'routing');
    
    expect(updated.status).toBe('routing');
    expect(updated.id).toBe(order.id);
  });

  it('should mark order as confirmed with details', async () => {
    const orderRequest: OrderRequest = {
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 1.0,
      slippage: 0.5,
    };

    const order = await orderService.createOrder(orderRequest);
    
    const updated = await orderService.updateStatus(order.id, 'confirmed', {
      dex: 'raydium',
      txHash: 'test-tx-hash-123',
      executedPrice: 180.5,
      actualAmountOut: 180.5,
    });

    expect(updated.status).toBe('confirmed');
    expect(updated.dex).toBe('raydium');
    expect(updated.txHash).toBe('test-tx-hash-123');
    expect(updated.executedPrice).toBe(180.5);
    expect(updated.completedAt).toBeDefined();
  });

  it('should mark order as failed with error', async () => {
    const orderRequest: OrderRequest = {
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 1.0,
      slippage: 0.5,
    };

    const order = await orderService.createOrder(orderRequest);
    
    const updated = await orderService.updateStatus(order.id, 'failed', {
      error: 'Slippage exceeded',
    });

    expect(updated.status).toBe('failed');
    expect(updated.error).toBe('Slippage exceeded');
    expect(updated.completedAt).toBeDefined();
  });

  it('should increment retry attempts', async () => {
    const orderRequest: OrderRequest = {
      tokenIn: 'So11111111111111111111111111111111111111112',
      tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: 1.0,
      slippage: 0.5,
    };

    const order = await orderService.createOrder(orderRequest);
    
    await orderService.incrementAttempts(order.id);
    let updated = await orderService.getOrder(order.id);
    expect(updated?.attempts).toBe(1);
    
    await orderService.incrementAttempts(order.id);
    updated = await orderService.getOrder(order.id);
    expect(updated?.attempts).toBe(2);
  });

  it('should return null for non-existent order', async () => {
    const order = await orderService.getOrder('non-existent-id');
    expect(order).toBeNull();
  });
});
