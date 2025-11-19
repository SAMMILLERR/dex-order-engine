import { FastifyPluginAsync } from 'fastify';
import { OrderRequestSchema, OrderRequest } from '../../types';
import { orderService } from '../../services/order.service';
import { addOrderToQueue } from '../../queue/order.queue';
import { websocketService } from '../../services/websocket.service';
import { logger } from '../../utils/logger';

export const ordersRoute: FastifyPluginAsync = async (server) => {
  logger.info('Registering orders routes...');
  
  /**
   * POST /api/orders/execute - Submit order and get orderId
   */
  server.post('/execute', async (request, reply) => {
    try {
      const orderRequest: OrderRequest = OrderRequestSchema.parse(request.body);

      // Create order in database
      const order = await orderService.createOrder(orderRequest);

      // Add order to execution queue
      await addOrderToQueue({
        orderId: order.id,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amount: order.amount,
        slippage: order.slippage,
      });

      logger.info(`Order ${order.id} submitted via POST`);

      // Return orderId - client can now upgrade to WebSocket on same endpoint path
      return reply.status(201).send({
        orderId: order.id,
        status: 'pending',
        websocketUrl: `/api/orders/execute?orderId=${order.id}`,
        message: 'Order created. Upgrade connection to WebSocket for live updates.',
      });
    } catch (error: any) {
      logger.error('Error creating order:', error);
      return reply.status(400).send({
        error: error.message || 'Failed to create order',
      });
    }
  });

  /**
   * GET /api/orders/execute - WebSocket upgrade on same endpoint
   * This allows HTTP → WebSocket pattern on single endpoint
   */
  server.get('/execute', { websocket: true }, async (connection, request) => {
    const socket = (connection as any).socket ?? connection;
    const orderId = (request.query as any)?.orderId;

    logger.info(`WebSocket upgrade for order ${orderId}`);

    try {
      if (!orderId) {
        socket.send(
          JSON.stringify({
            error: 'orderId query parameter required',
            timestamp: new Date().toISOString(),
          })
        );
        socket.close();
        return;
      }

      // Verify order exists
      const order = await orderService.getOrder(orderId);
      
      if (!order) {
        socket.send(
          JSON.stringify({
            error: 'Order not found',
            timestamp: new Date().toISOString(),
          })
        );
        socket.close();
        return;
      }

      // Register WebSocket connection
      websocketService.registerConnection(orderId, socket);

      // Send current order status
      socket.send(
        JSON.stringify({
          orderId: orderId,
          status: order.status,
          timestamp: new Date().toISOString(),
        })
      );

      logger.info(`WebSocket registered for order ${orderId}`);
    } catch (error: any) {
      logger.error('Error in WebSocket upgrade:', error);
      socket.send(
        JSON.stringify({
          error: error.message || 'WebSocket connection failed',
          timestamp: new Date().toISOString(),
        })
      );
      socket.close();
    }
  });
  
  /**
   * GET /api/orders/:id/stream (Legacy endpoint for backward compatibility)
   * WebSocket endpoint for streaming order status updates
   */
  server.get('/:id/stream', { websocket: true }, async (connection, request) => {
    const socket = (connection as any).socket ?? connection;
    const { id } = (request.params as any);

    logger.info(`WebSocket connection for order ${id} (legacy endpoint)`);

    try {
      // Verify order exists
      const order = await orderService.getOrder(id);
      
      if (!order) {
        socket.send(
          JSON.stringify({
            error: 'Order not found',
            timestamp: new Date().toISOString(),
          })
        );
        socket.close();
        return;
      }

      // Register WebSocket connection
      websocketService.registerConnection(id, socket);

      // Send current order status
      socket.send(
        JSON.stringify({
          orderId: id,
          status: order.status,
          timestamp: new Date().toISOString(),
        })
      );

      logger.info(`WebSocket registered for order ${id}`);
    } catch (error: any) {
      logger.error('Error in WebSocket connection:', error);
      socket.send(
        JSON.stringify({
          error: error.message || 'WebSocket connection failed',
          timestamp: new Date().toISOString(),
        })
      );
      socket.close();
    }
  });

  /**
   * GET /api/orders/:id
   * Get order status by ID
   */
  server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const order = await orderService.getOrder(id);

    if (!order) {
      return reply.status(404).send({
        error: 'Order not found',
      });
    }

    return {
      order: {
        id: order.id,
        status: order.status,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amount: order.amount,
        dex: order.dex,
        txHash: order.txHash,
        executedPrice: order.executedPrice,
        actualAmountOut: order.actualAmountOut,
        error: order.error,
        createdAt: order.createdAt,
        completedAt: order.completedAt,
      },
    };
  });

  /**
   * GET /api/orders
   * Get all orders (optionally filtered by status)
   */
  server.get<{ Querystring: { status?: string; limit?: string } }>(
    '/',
    async (request, reply) => {
      const { status, limit } = request.query;

      const orders = await orderService.getOrders({
        status: status as any,
        limit: limit ? parseInt(limit) : undefined,
      });

      return {
        orders: orders.map((order) => ({
          id: order.id,
          status: order.status,
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          amount: order.amount,
          dex: order.dex,
          txHash: order.txHash,
          createdAt: order.createdAt,
          completedAt: order.completedAt,
        })),
        count: orders.length,
      };
    }
  );
};
