import { DexQuote, OrderRequest } from '../types';
import { sleep, formatCurrency } from '../utils/helpers';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Mock Raydium DEX Service
 * Simulates Raydium pool quotes with realistic behavior
 */
export class MockRaydiumService {
  private readonly BASE_PRICE = config.mock.basePriceSOLUSDC;
  private readonly FEE = 0.003; // 0.3% fee
  private readonly MIN_LATENCY = 150;
  private readonly MAX_LATENCY = 250;

  /**
   * Get quote from Raydium pool (mocked)
   */
  async getQuote(order: OrderRequest): Promise<DexQuote> {
    // Simulate network latency
    const latency = this.MIN_LATENCY + Math.random() * (this.MAX_LATENCY - this.MIN_LATENCY);
    await sleep(latency);

    logger.debug(`Raydium: Fetching quote for ${order.amount} ${order.tokenIn} → ${order.tokenOut}`);

    // Get base price for the pair
    const basePrice = this.getBasePriceForPair(order.tokenIn, order.tokenOut);

    // Add realistic variance (±2%)
    const variance = 0.98 + Math.random() * 0.04; // 0.98 to 1.02
    const price = basePrice * variance;

    // Calculate amount out after fees
    const amountBeforeFee = order.amount * price;
    const feeAmount = amountBeforeFee * this.FEE;
    const amountOut = amountBeforeFee - feeAmount;

    const quote: DexQuote = {
      dex: 'raydium',
      price: parseFloat(formatCurrency(price, 2)),
      fee: this.FEE,
      amountOut: parseFloat(formatCurrency(amountOut, 2)),
      liquidity: 5000000 + Math.random() * 2000000, // $5-7M liquidity
      priceImpact: 0.001 + Math.random() * 0.002, // 0.1-0.3% impact
      timestamp: Date.now(),
    };

    logger.debug(`Raydium quote:`, {
      price: quote.price,
      amountOut: quote.amountOut,
      fee: `${(this.FEE * 100).toFixed(2)}%`,
    });

    return quote;
  }

  /**
   * Get base price for token pair
   */
  private getBasePriceForPair(tokenIn: string, tokenOut: string): number {
    const pair = `${tokenIn}/${tokenOut}`.toUpperCase();

    const prices: Record<string, number> = {
      'SOL/USDC': this.BASE_PRICE,
      'SOL/USDT': this.BASE_PRICE * 0.999,
      'ETH/USDC': 2800.0,
      'BTC/USDC': 42000.0,
      'RAY/USDC': 1.85,
    };

    return prices[pair] || this.BASE_PRICE;
  }
}
