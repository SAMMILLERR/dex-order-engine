import { z } from 'zod';

// Order Status enum
export type OrderStatus =
  | 'pending'
  | 'routing'
  | 'building'
  | 'submitted'
  | 'confirmed'
  | 'failed';

// DEX types
export type DexType = 'raydium' | 'meteora';

// Order Request Schema
export const OrderRequestSchema = z.object({
  tokenIn: z.string().min(1, 'tokenIn is required'),
  tokenOut: z.string().min(1, 'tokenOut is required'),
  amount: z.number().positive('amount must be positive'),
  slippage: z.number().min(0).max(1).default(0.01),
});

export type OrderRequest = z.infer<typeof OrderRequestSchema>;

// DEX Quote interface
export interface DexQuote {
  dex: DexType;
  price: number;
  fee: number;
  amountOut: number;
  liquidity: number;
  priceImpact: number;
  timestamp: number;
}

// Execution Result
export interface ExecutionResult {
  txHash: string;
  dex: DexType;
  executedPrice: number;
  actualAmountOut: number;
  blockTime: number;
  explorerUrl: string;
}

// WebSocket Message types
export interface WebSocketMessage {
  orderId: string;
  status: OrderStatus;
  message?: string;
  data?: any;
  timestamp: string;
  error?: string;
}

// Order with all fields
export interface Order {
  id: string;
  status: OrderStatus;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  slippage: number;
  dex?: DexType;
  selectedPrice?: number;
  amountOut?: number;
  txHash?: string;
  executedPrice?: number;
  actualAmountOut?: number;
  error?: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
