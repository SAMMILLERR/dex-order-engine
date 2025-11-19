import { DexQuote, DexType, ExecutionResult, OrderRequest } from '../types';
import { MockRaydiumService } from './raydium.service';
import { MockMeteoraService } from './meteora.service';
import { generateMockTxHash, sleep, formatCurrency, calculatePercentageDiff } from '../utils/helpers';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * DEX Router Service
 * Compares quotes from multiple DEXs and routes to the best price
 */
export class DexRouterService {
  private raydium: MockRaydiumService;
  private meteora: MockMeteoraService;

  constructor() {
    this.raydium = new MockRaydiumService();
    this.meteora = new MockMeteoraService();
  }

  /**
   * Get best route by comparing quotes from all DEXs
   */
  async getBestRoute(order: OrderRequest): Promise<DexQuote> {
    logger.info('Starting DEX routing...', {
      tokenIn: order.tokenIn,
      tokenOut: order.tokenOut,
      amount: order.amount,
    });

    // Fetch quotes from both DEXs in parallel
    const [raydiumResult, meteoraResult] = await Promise.allSettled([
      this.raydium.getQuote(order),
      this.meteora.getQuote(order),
    ]);

    const quotes: DexQuote[] = [];

    // Handle Raydium result
    if (raydiumResult.status === 'fulfilled') {
      quotes.push(raydiumResult.value);
    } else {
      logger.warn('Raydium quote failed:', raydiumResult.reason);
    }

    // Handle Meteora result
    if (meteoraResult.status === 'fulfilled') {
      quotes.push(meteoraResult.value);
    } else {
      logger.warn('Meteora quote failed:', meteoraResult.reason);
    }

    // If all DEXs failed, throw error
    if (quotes.length === 0) {
      throw new Error('All DEX quotes failed');
    }

    // Select best quote (highest amountOut)
    const bestQuote = quotes.reduce((best, current) =>
      current.amountOut > best.amountOut ? current : best
    );

    // Log routing decision
    this.logRoutingDecision(quotes, bestQuote);

    return bestQuote;
  }

  /**
   * Execute swap on selected DEX (mocked)
   */
  async executeSwap(dex: DexType, order: OrderRequest, quote: DexQuote): Promise<ExecutionResult> {
    logger.info(`Executing swap on ${dex}...`, {
      amount: order.amount,
      expectedOut: quote.amountOut,
    });

    // Simulate transaction building time
    await sleep(300);

    // Simulate transaction execution (2-3 seconds)
    const executionTime = 2000 + Math.random() * 1000;
    await sleep(executionTime);

    // Simulate various failure scenarios
    const failureChance = Math.random();
    if (failureChance < config.mock.failureRate) {
      const errors = [
        'Slippage tolerance exceeded - Price moved beyond acceptable range',
        'Insufficient liquidity in the pool',
        'Transaction simulation failed - Please try with lower amount',
        'Network congestion - Transaction timed out',
        'Pool reserves depleted - Try again in a moment'
      ];
      const randomError = errors[Math.floor(Math.random() * errors.length)];
      throw new Error(randomError);
    }

    // Simulate slight price variance on execution (±0.1%)
    const executionVariance = 0.999 + Math.random() * 0.002;
    const executedPrice = quote.price * executionVariance;
    const actualAmountOut = order.amount * executedPrice * (1 - quote.fee);

    const txHash = generateMockTxHash();

    const result: ExecutionResult = {
      txHash,
      dex,
      executedPrice: parseFloat(formatCurrency(executedPrice, 2)),
      actualAmountOut: parseFloat(formatCurrency(actualAmountOut, 2)),
      blockTime: Date.now(),
      explorerUrl: `https://solscan.io/tx/${txHash}?cluster=devnet`,
    };

    logger.info('Swap executed successfully', {
      txHash,
      dex,
      executedPrice: result.executedPrice,
      actualAmountOut: result.actualAmountOut,
    });

    return result;
  }

  /**
   * Log routing decision for transparency
   */
  private logRoutingDecision(quotes: DexQuote[], bestQuote: DexQuote): void {
    const raydiumQuote = quotes.find((q) => q.dex === 'raydium');
    const meteoraQuote = quotes.find((q) => q.dex === 'meteora');

    const logData: any = {
      selected: bestQuote.dex,
      selectedAmountOut: bestQuote.amountOut,
    };

    if (raydiumQuote) {
      logData.raydium = {
        price: raydiumQuote.price,
        fee: `${(raydiumQuote.fee * 100).toFixed(2)}%`,
        amountOut: raydiumQuote.amountOut,
        liquidity: `$${(raydiumQuote.liquidity / 1000000).toFixed(2)}M`,
      };
    }

    if (meteoraQuote) {
      logData.meteora = {
        price: meteoraQuote.price,
        fee: `${(meteoraQuote.fee * 100).toFixed(2)}%`,
        amountOut: meteoraQuote.amountOut,
        liquidity: `$${(meteoraQuote.liquidity / 1000000).toFixed(2)}M`,
      };
    }

    // Calculate improvement
    if (raydiumQuote && meteoraQuote) {
      const improvement = calculatePercentageDiff(
        raydiumQuote.dex === bestQuote.dex ? meteoraQuote.amountOut : raydiumQuote.amountOut,
        bestQuote.amountOut
      );
      logData.improvement = improvement;
    }

    logger.info('DEX Routing Decision:', logData);
  }
}
