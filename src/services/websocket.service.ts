import { WebSocketMessage, OrderStatus } from '../types';
import { logger } from '../utils/logger';
import { WebSocket } from 'ws';

/**
 * WebSocket Service
 * Manages WebSocket connections and broadcasts order status updates
 */
export class WebSocketService {
  private connections: Map<string, WebSocket> = new Map();

  /**
   * Register a WebSocket connection for an order
   */
  registerConnection(orderId: string, socket: WebSocket): void {
    this.connections.set(orderId, socket);
    logger.debug(`WebSocket registered for order: ${orderId}`);

    // Handle socket close
    socket.on('close', () => {
      this.connections.delete(orderId);
      logger.debug(`WebSocket closed for order: ${orderId}`);
    });

    // Handle socket error
    socket.on('error', (error: Error) => {
      logger.error(`WebSocket error for order ${orderId}:`, error);
      this.connections.delete(orderId);
    });
  }

  /**
   * Broadcast status update to a specific order
   */
  broadcastToOrder(orderId: string, status: OrderStatus, data?: any, error?: string): void {
    const socket = this.connections.get(orderId);

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      logger.warn(`No active WebSocket connection for order: ${orderId}`);
      return;
    }

    const message: WebSocketMessage = {
      orderId,
      status,
      timestamp: new Date().toISOString(),
      ...(data && { data }),
      ...(error && { error }),
    };

    try {
      socket.send(JSON.stringify(message));
      logger.debug(`WebSocket message sent to ${orderId}:`, { status, data });
    } catch (err) {
      logger.error(`Failed to send WebSocket message to ${orderId}:`, err);
    }
  }

  /**
   * Close connection for a specific order
   */
  closeConnection(orderId: string): void {
    const socket = this.connections.get(orderId);
    if (socket) {
      socket.close();
      this.connections.delete(orderId);
      logger.debug(`WebSocket connection closed for order: ${orderId}`);
    }
  }

  /**
   * Get count of active connections
   */
  getActiveConnectionsCount(): number {
    return this.connections.size;
  }

  /**
   * Close all connections
   */
  closeAllConnections(): void {
    this.connections.forEach((socket, orderId) => {
      socket.close();
      logger.debug(`Closed WebSocket for order: ${orderId}`);
    });
    this.connections.clear();
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
