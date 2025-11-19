import { DexQuote, OrderRequest } from '../types';
import { sleep, formatCurrency } from '../utils/helpers';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Mock Meteora DEX Service
 * Simulates Meteora pool quotes with realistic behavior
 */
export class MockMeteoraService {
  private readonly BASE_PRICE = config.mock.basePriceSOLUSDC;
  private readonly FEE = 0.002; // 0.2% fee (lower than Raydium)
  private readonly MIN_LATENCY = 150;
  private readonly MAX_LATENCY = 250;

  /**
   * Get quote from Meteora pool (mocked)
   */
  async getQuote(order: OrderRequest): Promise<DexQuote> {
    // Simulate network latency
    const latency = this.MIN_LATENCY + Math.random() * (this.MAX_LATENCY - this.MIN_LATENCY);
    await sleep(latency);

    logger.debug(
      `Meteora: Fetching quote for ${order.amount} ${order.tokenIn} → ${order.tokenOut}`
    );

    // Get base price for the pair
    const basePrice = this.getBasePriceForPair(order.tokenIn, order.tokenOut);

    // Add realistic variance (±2.5% - slightly wider than Raydium)
    const variance = 0.97 + Math.random() * 0.05; // 0.97 to 1.02
    const price = basePrice * variance;

    // Calculate amount out after fees
    const amountBeforeFee = order.amount * price;
    const feeAmount = amountBeforeFee * this.FEE;
    const amountOut = amountBeforeFee - feeAmount;

    const quote: DexQuote = {
      dex: 'meteora',
      price: parseFloat(formatCurrency(price, 2)),
      fee: this.FEE,
      amountOut: parseFloat(formatCurrency(amountOut, 2)),
      liquidity: 4000000 + Math.random() * 1500000, // $4-5.5M liquidity (less than Raydium)
      priceImpact: 0.0015 + Math.random() * 0.002, // 0.15-0.35% impact
      timestamp: Date.now(),
    };

    logger.debug(`Meteora quote:`, {
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
      'SOL/USDT': this.BASE_PRICE * 1.001, // Slightly different price
      'ETH/USDC': 2805.0,
      'BTC/USDC': 42100.0,
      'RAY/USDC': 1.87,
    };

    return prices[pair] || this.BASE_PRICE;
  }
}
