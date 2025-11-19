import { MockRaydiumService } from '../../services/raydium.service';
import { MockMeteoraService } from '../../services/meteora.service';
import { OrderRequest } from '../../types';

describe('Mock DEX Services', () => {
  describe('MockRaydiumService', () => {
    let raydium: MockRaydiumService;

    beforeEach(() => {
      raydium = new MockRaydiumService();
    });

    it('should return valid quote', async () => {
      const order: OrderRequest = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.0,
        slippage: 0.01,
      };

      const quote = await raydium.getQuote(order);

      expect(quote.dex).toBe('raydium');
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.fee).toBe(0.003);
      expect(quote.amountOut).toBeGreaterThan(0);
    });

    it('should simulate network latency', async () => {
      const order: OrderRequest = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.0,
        slippage: 0.01,
      };

      const start = Date.now();
      await raydium.getQuote(order);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(150);
      expect(duration).toBeLessThanOrEqual(300);
    });
  });

  describe('MockMeteoraService', () => {
    let meteora: MockMeteoraService;

    beforeEach(() => {
      meteora = new MockMeteoraService();
    });

    it('should return valid quote with lower fee', async () => {
      const order: OrderRequest = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.0,
        slippage: 0.01,
      };

      const quote = await meteora.getQuote(order);

      expect(quote.dex).toBe('meteora');
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.fee).toBe(0.002);
      expect(quote.amountOut).toBeGreaterThan(0);
    });

    it('should have different price variance than Raydium', async () => {
      const raydium = new MockRaydiumService();
      const meteora = new MockMeteoraService();

      const order: OrderRequest = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.0,
        slippage: 0.01,
      };

      const raydiumQuote = await raydium.getQuote(order);
      const meteoraQuote = await meteora.getQuote(order);

      // Prices should be different due to variance
      expect(raydiumQuote.price).not.toBe(meteoraQuote.price);
    });
  });

  describe('Fee Comparison', () => {
    it('should show Meteora has lower fees than Raydium', async () => {
      const raydium = new MockRaydiumService();
      const meteora = new MockMeteoraService();

      const order: OrderRequest = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.0,
        slippage: 0.01,
      };

      const [raydiumQuote, meteoraQuote] = await Promise.all([
        raydium.getQuote(order),
        meteora.getQuote(order),
      ]);

      expect(meteoraQuote.fee).toBeLessThan(raydiumQuote.fee);
    });
  });
});
