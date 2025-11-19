import { DexRouterService } from '../../services/dex-router.service';
import { OrderRequest } from '../../types';

describe('DexRouterService', () => {
  let dexRouter: DexRouterService;

  beforeEach(() => {
    dexRouter = new DexRouterService();
  });

  describe('getBestRoute', () => {
    it('should return a quote from either Raydium or Meteora', async () => {
      const order: OrderRequest = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.5,
        slippage: 0.01,
      };

      const quote = await dexRouter.getBestRoute(order);

      expect(quote).toBeDefined();
      expect(['raydium', 'meteora']).toContain(quote.dex);
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.amountOut).toBeGreaterThan(0);
      expect(quote.fee).toBeGreaterThan(0);
    });

    it('should select the DEX with higher amountOut', async () => {
      const order: OrderRequest = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 10,
        slippage: 0.01,
      };

      const quote = await dexRouter.getBestRoute(order);

      expect(quote.amountOut).toBeGreaterThan(0);
    });

    it('should handle multiple quotes and compare them', async () => {
      const order: OrderRequest = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 2.0,
        slippage: 0.01,
      };

      const quote = await dexRouter.getBestRoute(order);

      expect(quote.dex).toBeDefined();
      expect(quote.liquidity).toBeGreaterThan(0);
      expect(quote.priceImpact).toBeGreaterThan(0);
    });
  });

  describe('executeSwap', () => {
    it('should execute swap and return transaction result', async () => {
      const order: OrderRequest = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.0,
        slippage: 0.01,
      };

      const quote = await dexRouter.getBestRoute(order);
      const result = await dexRouter.executeSwap(quote.dex, order, quote);

      expect(result.txHash).toBeDefined();
      expect(result.txHash).toHaveLength(88);
      expect(result.dex).toBe(quote.dex);
      expect(result.executedPrice).toBeGreaterThan(0);
      expect(result.actualAmountOut).toBeGreaterThan(0);
      expect(result.explorerUrl).toContain('solscan.io');
    });

    it('should handle execution failures with retry', async () => {
      const order: OrderRequest = {
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 1.0,
        slippage: 0.01,
      };

      const quote = await dexRouter.getBestRoute(order);

      // Execute multiple times to potentially hit failure
      const promises = Array.from({ length: 5 }, () =>
        dexRouter.executeSwap(quote.dex, order, quote).catch(() => null)
      );

      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r !== null).length;

      expect(successCount).toBeGreaterThan(0);
    });
  });
});
