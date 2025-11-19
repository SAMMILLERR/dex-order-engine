import { describe, it, expect, beforeEach } from '@jest/globals';
import { WebSocketService } from '../src/services/websocket.service';
import { WebSocket } from 'ws';
import { OrderStatus } from '../src/types';

describe('WebSocket Service', () => {
  let wsService: WebSocketService;

  beforeEach(() => {
    wsService = new WebSocketService();
  });

  it('should register a WebSocket connection', () => {
    const mockSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
    } as any;

    wsService.registerConnection('test-order-1', mockSocket);
    expect(wsService.getActiveConnectionsCount()).toBe(1);
  });

  it('should broadcast message to specific order', () => {
    const mockSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
    } as any;

    wsService.registerConnection('test-order-2', mockSocket);
    wsService.broadcastToOrder('test-order-2', 'routing' as OrderStatus, {
      message: 'Test message',
    });

    expect(mockSocket.send).toHaveBeenCalled();
    const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sentMessage.orderId).toBe('test-order-2');
    expect(sentMessage.status).toBe('routing');
    expect(sentMessage.data.message).toBe('Test message');
  });

  it('should handle closed socket gracefully', () => {
    const mockSocket = {
      readyState: WebSocket.CLOSED,
      send: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
    } as any;

    wsService.registerConnection('test-order-3', mockSocket);
    
    // Should not throw error when broadcasting to closed socket
    expect(() => {
      wsService.broadcastToOrder('test-order-3', 'pending' as OrderStatus);
    }).not.toThrow();

    // Send should not be called for closed socket
    expect(mockSocket.send).not.toHaveBeenCalled();
  });

  it('should close specific connection', () => {
    const mockSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
    } as any;

    wsService.registerConnection('test-order-4', mockSocket);
    expect(wsService.getActiveConnectionsCount()).toBe(1);

    wsService.closeConnection('test-order-4');
    expect(mockSocket.close).toHaveBeenCalled();
    expect(wsService.getActiveConnectionsCount()).toBe(0);
  });

  it('should close all connections', () => {
    const mockSocket1 = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
    } as any;

    const mockSocket2 = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
    } as any;

    wsService.registerConnection('order-1', mockSocket1);
    wsService.registerConnection('order-2', mockSocket2);
    expect(wsService.getActiveConnectionsCount()).toBe(2);

    wsService.closeAllConnections();
    expect(mockSocket1.close).toHaveBeenCalled();
    expect(mockSocket2.close).toHaveBeenCalled();
    expect(wsService.getActiveConnectionsCount()).toBe(0);
  });

  it('should include error in broadcast message', () => {
    const mockSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
    } as any;

    wsService.registerConnection('error-order', mockSocket);
    wsService.broadcastToOrder(
      'error-order',
      'failed' as OrderStatus,
      undefined,
      'Transaction failed'
    );

    expect(mockSocket.send).toHaveBeenCalled();
    const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sentMessage.status).toBe('failed');
    expect(sentMessage.error).toBe('Transaction failed');
  });

  it('should handle broadcast to non-existent order', () => {
    // Should not throw error
    expect(() => {
      wsService.broadcastToOrder('non-existent', 'pending' as OrderStatus);
    }).not.toThrow();
  });
});
