import { describe, it, expect } from 'vitest';
import { isDemoUpi, validateProductionUpi, DEMO_UPI_HANDLE } from '@/lib/services/upi-validator';

describe('Demo UPI Handle Guard & Production Validation (Item 3 Compliance)', () => {
  it('correctly identifies demo and invalid UPI handles', () => {
    expect(isDemoUpi('demo@invalid')).toBe(true);
    expect(isDemoUpi('sample.demo@invalid')).toBe(true);
    expect(isDemoUpi('test@axisbank')).toBe(true);
    expect(isDemoUpi('distributor@demo')).toBe(true);
    expect(isDemoUpi('demo123@icici')).toBe(true);

    expect(isDemoUpi('genuinebusiness@icici')).toBe(false);
    expect(isDemoUpi('wholesalepoint@axisbank')).toBe(false);
    expect(isDemoUpi(null)).toBe(false);
  });

  it('allows demo UPI in non-production environments', () => {
    const result = validateProductionUpi('demo@invalid', false);
    expect(result.valid).toBe(true);
  });

  it('strictly rejects demo UPI in production setup', () => {
    const result = validateProductionUpi('demo@invalid', true);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('strictly rejected in production');

    const result2 = validateProductionUpi('retailer.demo@invalid', true);
    expect(result2.valid).toBe(false);
  });

  it('accepts genuine valid bank UPI handles in production', () => {
    const validUpi = validateProductionUpi('legitimatewholesaler@hdfcbank', true);
    expect(validUpi.valid).toBe(true);

    const validAxis = validateProductionUpi('fictional.wholesale@axisbank', true);
    expect(validAxis.valid).toBe(true);
  });

  it('rejects malformed non-VPA formats', () => {
    const malformed = validateProductionUpi('not-a-vpa', true);
    expect(malformed.valid).toBe(false);
    expect(malformed.error).toContain('Invalid UPI VPA format');
  });
});
