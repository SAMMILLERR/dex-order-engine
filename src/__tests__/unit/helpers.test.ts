import {
  generateOrderId,
  generateMockTxHash,
  getBackoffDelay,
  calculatePercentageDiff,
} from '../../utils/helpers';

describe('Helper Functions', () => {
  describe('generateOrderId', () => {
    it('should generate unique order IDs', () => {
      const id1 = generateOrderId();
      const id2 = generateOrderId();

      expect(id1).toMatch(/^ord_[a-zA-Z0-9]{12}$/);
      expect(id2).toMatch(/^ord_[a-zA-Z0-9]{12}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateMockTxHash', () => {
    it('should generate 88-character transaction hash', () => {
      const txHash = generateMockTxHash();

      expect(txHash).toHaveLength(88);
      expect(txHash).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/); // Base58 characters
    });

    it('should generate unique hashes', () => {
      const hash1 = generateMockTxHash();
      const hash2 = generateMockTxHash();

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getBackoffDelay', () => {
    it('should calculate exponential backoff', () => {
      expect(getBackoffDelay(0)).toBe(1000);
      expect(getBackoffDelay(1)).toBe(2000);
      expect(getBackoffDelay(2)).toBe(4000);
      expect(getBackoffDelay(3)).toBe(8000);
    });

    it('should cap at 10 seconds', () => {
      expect(getBackoffDelay(10)).toBe(10000);
      expect(getBackoffDelay(20)).toBe(10000);
    });
  });

  describe('calculatePercentageDiff', () => {
    it('should calculate positive percentage difference', () => {
      const diff = calculatePercentageDiff(100, 110);
      expect(diff).toBe('+10.00%');
    });

    it('should calculate negative percentage difference', () => {
      const diff = calculatePercentageDiff(100, 90);
      expect(diff).toBe('-10.00%');
    });

    it('should handle zero difference', () => {
      const diff = calculatePercentageDiff(100, 100);
      expect(diff).toBe('+0.00%');
    });
  });
});
