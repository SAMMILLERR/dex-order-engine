import { createServer } from './api/server';
import { connectDatabase, disconnectDatabase } from './db/prisma';
import { disconnectRedis } from './db/redis';
import { startOrderWorker } from './queue/order.worker';
import { websocketService } from './services/websocket.service';
import { config } from './config';
import { logger } from './utils/logger';

/**
 * Start the application
 */
async function start() {
  try {
    // Connect to database
    await connectDatabase();

    // Create Fastify server
    const server = createServer();

    // Start order worker
    const worker = startOrderWorker();

    // Start server
    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`Server started on http://${config.server.host}:${config.server.port}`);
    logger.info('WebSocket endpoint: ws://localhost:3000/api/orders/execute');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      // Close server
      await server.close();

      // Close WebSocket connections
      websocketService.closeAllConnections();

      // Close worker
      await worker.close();

      // Disconnect from database and Redis
      await disconnectDatabase();
      await disconnectRedis();

      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start application:', error);
    console.error('Full error details:', error);
    process.exit(1);
  }
}

// Start the application
start();
