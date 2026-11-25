/**
 * Money Engine (Strict Integer Paise)
 * 
 * In FMCG wholesale distribution, money NEVER passes through floating point math.
 * Every paisa (1 INR = 100 paise) is an integer.
 * Floating point errors in wholesale bills lead to distributor loss and shop distrust.
 */

export class MoneyError extends Error {
  constructor(message: string) {
    super(`[MoneyError] ${message}`);
    this.name = 'MoneyError';
  }
}

/**
 * Validates that an amount is a safe, finite integer in paise.
 */
export function assertIntegerPaise(paise: number, fieldName = 'Amount'): void {
  if (typeof paise !== 'number' || !Number.isFinite(paise)) {
    throw new MoneyError(`${fieldName} must be a finite number. Received: ${paise}`);
  }
  if (!Number.isInteger(paise)) {
    throw new MoneyError(`${fieldName} must be an integer in paise (no floats). Received: ${paise}`);
  }
}

/**
 * Converts Rupees (e.g. 14.50 or "14.50") safely to integer paise (1450).
 */
export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    const trimmed = rupees.trim().replace(/^₹/, '');
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new MoneyError(`Invalid rupees string: "${rupees}"`);
    }
    rupees = parsed;
  }
  if (!Number.isFinite(rupees)) {
    throw new MoneyError(`Invalid rupees number: ${rupees}`);
  }
  // Round to nearest integer after multiplying by 100 to eliminate IEEE-754 precision issues
  return Math.round(rupees * 100);
}

/**
 * Converts integer paise to standard Rupee string formatted for Indian locale.
 * Example: 89350 paise -> "₹893.50", 89000 paise -> "₹890" or "₹890.00"
 */
export function formatPaise(
  paise: number,
  options: {
    includeSymbol?: boolean;
    alwaysShowDecimals?: boolean;
    locale?: string;
  } = {}
): string {
  assertIntegerPaise(paise, 'paise');

  const {
    includeSymbol = true,
    alwaysShowDecimals = false,
    locale = 'en-IN',
  } = options;

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;

  let formattedNumber: string;
  if (remainingPaise === 0 && !alwaysShowDecimals) {
    formattedNumber = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(rupees);
  } else {
    const decimalPart = remainingPaise.toString().padStart(2, '0');
    const formattedRupees = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(rupees);
    formattedNumber = `${formattedRupees}.${decimalPart}`;
  }

  const prefix = isNegative ? '-' : '';
  const symbol = includeSymbol ? '₹' : '';
  return `${prefix}${symbol}${formattedNumber}`;
}

/**
 * Safely adds multiple paise amounts.
 */
export function addPaise(...amounts: number[]): number {
  let total = 0;
  for (let i = 0; i < amounts.length; i++) {
    assertIntegerPaise(amounts[i], `Amount at index ${i}`);
    total += amounts[i];
  }
  return total;
}

/**
 * Safely subtracts subtrahend from minuend (minuend - subtrahend).
 */
export function subtractPaise(minuend: number, subtrahend: number): number {
  assertIntegerPaise(minuend, 'minuend');
  assertIntegerPaise(subtrahend, 'subtrahend');
  return minuend - subtrahend;
}

/**
 * Calculates line total given quantity (in base unit), unit PTR (in paise), and conversion factor.
 * E.g., Ordering 2 bundles where 1 bundle = 12 packets, and PTR is ₹15 per packet (1500 paise):
 * Line total = 2 * 12 * 1500 = 36000 paise (₹360.00)
 */
export function calculateLineTotalPaise(
  quantityOrdered: number,
  unitPricePaise: number
): number {
  assertIntegerPaise(quantityOrdered, 'quantityOrdered');
  assertIntegerPaise(unitPricePaise, 'unitPricePaise');
  if (quantityOrdered < 0) {
    throw new MoneyError(`Quantity cannot be negative: ${quantityOrdered}`);
  }
  if (unitPricePaise < 0) {
    throw new MoneyError(`Unit price cannot be negative: ${unitPricePaise}`);
  }
  return quantityOrdered * unitPricePaise;
}

export interface RoundingDecision {
  billTotalPaise: number;
  receivedPaise: number;
  allocatedPaise: number;
  dueRemainingPaise: number;
  isShortPayment: boolean;
  shortAmountPaise: number;
  isOverPayment: boolean;
  overAmountPaise: number;
  ledgerEntryType: 'PAYMENT' | 'ROUNDING_DUE';
}

/**
 * Computes exact rounding and ledger impact when a shop makes a payment against a bill.
 * Example: Shop pays ₹890 (89000 paise) against an ₹893 bill (89300 paise).
 * Result:
 *   allocated = 89000 paise
 *   dueRemaining = 300 paise (₹3.00)
 *   isShortPayment = true
 *   shortAmount = 300 paise
 */
export function evaluateBillPayment(
  billTotalPaise: number,
  receivedPaise: number
): RoundingDecision {
  assertIntegerPaise(billTotalPaise, 'billTotalPaise');
  assertIntegerPaise(receivedPaise, 'receivedPaise');

  if (billTotalPaise < 0) {
    throw new MoneyError(`Bill total cannot be negative: ${billTotalPaise}`);
  }
  if (receivedPaise < 0) {
    throw new MoneyError(`Received amount cannot be negative: ${receivedPaise}`);
  }

  const diff = billTotalPaise - receivedPaise;

  if (diff > 0) {
    // Short payment (e.g. paid 890 on 893)
    return {
      billTotalPaise,
      receivedPaise,
      allocatedPaise: receivedPaise,
      dueRemainingPaise: diff,
      isShortPayment: true,
      shortAmountPaise: diff,
      isOverPayment: false,
      overAmountPaise: 0,
      ledgerEntryType: 'ROUNDING_DUE',
    };
  } else if (diff < 0) {
    // Overpayment (e.g. paid 900 on 893)
    const excess = Math.abs(diff);
    return {
      billTotalPaise,
      receivedPaise,
      allocatedPaise: billTotalPaise,
      dueRemainingPaise: 0,
      isShortPayment: false,
      shortAmountPaise: 0,
      isOverPayment: true,
      overAmountPaise: excess,
      ledgerEntryType: 'PAYMENT',
    };
  } else {
    // Exact payment
    return {
      billTotalPaise,
      receivedPaise,
      allocatedPaise: billTotalPaise,
      dueRemainingPaise: 0,
      isShortPayment: false,
      shortAmountPaise: 0,
      isOverPayment: false,
      overAmountPaise: 0,
      ledgerEntryType: 'PAYMENT',
    };
  }
}
