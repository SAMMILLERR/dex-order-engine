/**
 * Sleep utility for adding delays
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Generate unique order ID
 */
export const generateOrderId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'ord_';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/**
 * Generate mock Solana transaction hash (88 characters)
 */
export const generateMockTxHash = (): string => {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let hash = '';
  for (let i = 0; i < 88; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return hash;
};

/**
 * Calculate exponential backoff delay
 */
export const getBackoffDelay = (attempt: number): number => {
  return Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
};

/**
 * Format currency
 */
export const formatCurrency = (amount: number, decimals: number = 2): string => {
  return amount.toFixed(decimals);
};

/**
 * Calculate percentage difference
 */
export const calculatePercentageDiff = (value1: number, value2: number): string => {
  const diff = ((value2 - value1) / value1) * 100;
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`;
};
