import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  formatPaise,
  addPaise,
  subtractPaise,
  calculateLineTotalPaise,
  evaluateBillPayment,
  assertIntegerPaise,
  MoneyError,
} from '@/lib/money';

describe('Money Engine - Strict Integer Paise', () => {
  describe('assertIntegerPaise', () => {
    it('accepts integer paise', () => {
      expect(() => assertIntegerPaise(100)).not.toThrow();
      expect(() => assertIntegerPaise(0)).not.toThrow();
      expect(() => assertIntegerPaise(-50)).not.toThrow();
    });

    it('rejects floating point amounts to prevent fractional paise drift', () => {
      expect(() => assertIntegerPaise(100.5)).toThrow(MoneyError);
      expect(() => assertIntegerPaise(0.01)).toThrow(MoneyError);
      expect(() => assertIntegerPaise(NaN)).toThrow(MoneyError);
      expect(() => assertIntegerPaise(Infinity)).toThrow(MoneyError);
    });
  });

  describe('rupeesToPaise', () => {
    it('accurately converts rupees to paise without floating point issues', () => {
      expect(rupeesToPaise(14.5)).toBe(1450);
      expect(rupeesToPaise('14.50')).toBe(1450);
      expect(rupeesToPaise('₹893.00')).toBe(89300);
      expect(rupeesToPaise('893')).toBe(89300);
      expect(rupeesToPaise(0)).toBe(0);
      expect(rupeesToPaise('0.05')).toBe(5);
    });

    it('throws on invalid input', () => {
      expect(() => rupeesToPaise('abc')).toThrow(MoneyError);
    });
  });

  describe('formatPaise', () => {
    it('formats paise into standard Indian Rupee string', () => {
      expect(formatPaise(89300)).toBe('₹893');
      expect(formatPaise(89350)).toBe('₹893.50');
      expect(formatPaise(89300, { alwaysShowDecimals: true })).toBe('₹893.00');
      expect(formatPaise(145000)).toBe('₹1,450');
      expect(formatPaise(10000000)).toBe('₹1,00,000'); // Indian comma formatting
    });

    it('handles negative amounts and options', () => {
      expect(formatPaise(-5000)).toBe('-₹50');
      expect(formatPaise(5000, { includeSymbol: false })).toBe('50');
    });
  });

  describe('addPaise & subtractPaise', () => {
    it('adds multiple paise values accurately', () => {
      expect(addPaise(1000, 2500, 500)).toBe(4000);
    });

    it('subtracts cleanly', () => {
      expect(subtractPaise(10000, 2500)).toBe(7500);
    });

    it('throws if any argument is float', () => {
      expect(() => addPaise(1000, 25.5)).toThrow(MoneyError);
    });
  });

  describe('calculateLineTotalPaise', () => {
    it('calculates ordered qty * PTR price in paise', () => {
      // 10 bundles of chips at ₹16.50 (1650 paise) each
      expect(calculateLineTotalPaise(10, 1650)).toBe(16500);
    });

    it('throws on negative inputs', () => {
      expect(() => calculateLineTotalPaise(-1, 1000)).toThrow(MoneyError);
      expect(() => calculateLineTotalPaise(5, -100)).toThrow(MoneyError);
    });
  });

  describe('evaluateBillPayment (Rounding & Partial Payments)', () => {
    it('detects short payment (e.g. ₹890 paid on ₹893 bill)', () => {
      const billPaise = 89300; // ₹893.00
      const paidPaise = 89000; // ₹890.00
      const decision = evaluateBillPayment(billPaise, paidPaise);

      expect(decision.isShortPayment).toBe(true);
      expect(decision.dueRemainingPaise).toBe(300); // ₹3.00 remains due
      expect(decision.allocatedPaise).toBe(89000);
      expect(decision.shortAmountPaise).toBe(300);
      expect(decision.ledgerEntryType).toBe('ROUNDING_DUE');
    });

    it('detects exact payment', () => {
      const decision = evaluateBillPayment(50000, 50000);
      expect(decision.isShortPayment).toBe(false);
      expect(decision.isOverPayment).toBe(false);
      expect(decision.dueRemainingPaise).toBe(0);
      expect(decision.allocatedPaise).toBe(50000);
    });

    it('detects overpayment', () => {
      const decision = evaluateBillPayment(89300, 90000);
      expect(decision.isOverPayment).toBe(true);
      expect(decision.overAmountPaise).toBe(700); // ₹7.00 credit
      expect(decision.allocatedPaise).toBe(89300);
    });
  });
});
