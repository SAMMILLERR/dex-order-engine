import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ordersRoute } from './routes/orders.route';

/**
 * Create Fastify server instance
 */
export const createServer = () => {
  const server = Fastify({
    logger: logger as any,
    requestIdLogLabel: 'reqId',
  });

  // Register plugins
  server.register(cors, {
    origin: true, // Allow all origins in development
  });

  server.register(websocket);

  // Serve static files from public directory
  server.register(fastifyStatic, {
    root: path.join(process.cwd(), 'public'),
    prefix: '/',
  });

  // Register routes
  server.register(ordersRoute, { prefix: '/api/orders' });
  logger.info('Orders route registered at /api/orders');

  // Simple health check route (inline to avoid missing module)
  server.get('/api/health', async (request, reply) => {
    return { status: 'ok' };
  });
  // Global error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error('Unhandled error:', error);

    reply.status(error.statusCode || 500).send({
      error: {
        message: error.message || 'Internal Server Error',
        statusCode: error.statusCode || 500,
      },
    });
  });

  return server;
};
