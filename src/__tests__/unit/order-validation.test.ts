import { OrderRequestSchema } from '../../types';

describe('Order Validation', () => {
  describe('OrderRequestSchema', () => {
    it('should validate a correct order request', () => {
      const validOrder = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.5,
        slippage: 0.01,
      };

      const result = OrderRequestSchema.safeParse(validOrder);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tokenIn).toBe('SOL');
        expect(result.data.tokenOut).toBe('USDC');
        expect(result.data.amount).toBe(1.5);
        expect(result.data.slippage).toBe(0.01);
      }
    });

    it('should reject order with missing tokenIn', () => {
      const invalidOrder = {
        tokenOut: 'USDC',
        amount: 1.5,
      };

      const result = OrderRequestSchema.safeParse(invalidOrder);

      expect(result.success).toBe(false);
    });

    it('should reject order with negative amount', () => {
      const invalidOrder = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: -1,
        slippage: 0.01,
      };

      const result = OrderRequestSchema.safeParse(invalidOrder);

      expect(result.success).toBe(false);
    });

    it('should reject order with slippage > 1', () => {
      const invalidOrder = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.0,
        slippage: 1.5,
      };

      const result = OrderRequestSchema.safeParse(invalidOrder);

      expect(result.success).toBe(false);
    });

    it('should use default slippage if not provided', () => {
      const order = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.0,
      };

      const result = OrderRequestSchema.safeParse(order);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slippage).toBe(0.01);
      }
    });
  });
});
