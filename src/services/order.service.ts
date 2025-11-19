import { OrderRequest, Order, OrderStatus } from '../types';
import { prisma } from '../db/prisma';
import { generateOrderId } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * Order Service
 * Handles order business logic and database operations
 */
export class OrderService {
  /**
   * Create a new order
   */
  async createOrder(orderRequest: OrderRequest): Promise<Order> {
    const orderId = generateOrderId();

    const order = await prisma.order.create({
      data: {
        id: orderId,
        status: 'pending',
        tokenIn: orderRequest.tokenIn,
        tokenOut: orderRequest.tokenOut,
        amount: orderRequest.amount,
        slippage: orderRequest.slippage,
      },
    });

    logger.info('Order created:', {
      orderId: order.id,
      tokenIn: order.tokenIn,
      tokenOut: order.tokenOut,
      amount: order.amount,
    });

    return order as Order;
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    return order as Order | null;
  }

  /**
   * Update order status
   */
  async updateStatus(orderId: string, status: OrderStatus, data?: any): Promise<Order> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'confirmed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    if (data) {
      Object.assign(updateData, data);
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    logger.debug(`Order ${orderId} status updated to: ${status}`);

    return order as Order;
  }

  /**
   * Increment attempt counter
   */
  async incrementAttempts(orderId: string): Promise<void> {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        attempts: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Get all orders (with optional filtering)
   */
  async getOrders(filters?: { status?: OrderStatus; limit?: number }): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: filters?.status ? { status: filters.status } : undefined,
      take: filters?.limit || 100,
      orderBy: { createdAt: 'desc' },
    });

    return orders as Order[];
  }
}

export const orderService = new OrderService();
