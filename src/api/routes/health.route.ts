import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma';
import { redis } from '../../db/redis';
import { getQueueStats } from '../../queue/order.queue';
import { websocketService } from '../../services/websocket.service';

export const healthRoute: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/health
   * Health check endpoint
   */
  server.get('/health', async (request, reply) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'unknown',
        redis: 'unknown',
        queue: 'unknown',
      },
      queue: {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      },
      websocket: {
        activeConnections: websocketService.getActiveConnectionsCount(),
      },
    };

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.services.database = 'connected';
    } catch (error) {
      health.services.database = 'disconnected';
      health.status = 'degraded';
    }

    // Check Redis
    try {
      await redis.ping();
      health.services.redis = 'connected';
    } catch (error) {
      health.services.redis = 'disconnected';
      health.status = 'degraded';
    }

    // Check queue
    try {
      const stats = await getQueueStats();
      health.queue = stats;
      health.services.queue = 'operational';
    } catch (error) {
      health.services.queue = 'error';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    return reply.status(statusCode).send(health);
  });
};
