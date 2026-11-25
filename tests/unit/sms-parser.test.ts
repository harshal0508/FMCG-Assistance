import { describe, it, expect } from 'vitest';
import { parseBankSmsNotification } from '@/lib/services/sms-parser';

describe('Bank SMS & App Notification Parser (B2 & Part 1.5 Compliance)', () => {
  it('parses standard HDFC Bank UPI credit SMS', () => {
    const sms =
      'Dear Customer, your A/c 4812 is credited by Rs 15,400.00 on 24-Nov-26 by UPI/P2A/632948291048/RAMESH KUMAR GUPTA/HDFC Bank. Available Bal Rs 1,48,200.00';
    const result = parseBankSmsNotification(sms);

    expect(result.success).toBe(true);
    expect(result.amountPaise).toBe(1540000);
    expect(result.amountRupees).toBe(15400);
    expect(result.bankUtr).toBe('632948291048');
    expect(result.payerName).toBe('RAMESH KUMAR GUPTA');
  });

  it('parses SBI UPI credit SMS format', () => {
    const sms =
      'Dear SBI User, your A/c ending 1234 credited by Rs. 890.00 on 24Nov26 by UPI Ref no 632948291049. Payer: Mahadev Traders.';
    const result = parseBankSmsNotification(sms);

    expect(result.success).toBe(true);
    expect(result.amountPaise).toBe(89000);
    expect(result.amountRupees).toBe(890);
    expect(result.bankUtr).toBe('632948291049');
    expect(result.payerName).toBe('Mahadev Traders');
  });

  it('parses PhonePe Merchant soundbox / push notification', () => {
    const sms =
      'Received Rs. 3,500 from Virendra Kumar via UPI (UTR: 632948291051) on 24-Nov-2026.';
    const result = parseBankSmsNotification(sms);

    expect(result.success).toBe(true);
    expect(result.amountPaise).toBe(350000);
    expect(result.amountRupees).toBe(3500);
    expect(result.bankUtr).toBe('632948291051');
    expect(result.payerName).toBe('Virendra Kumar');
  });

  it('strictly rejects debit messages (e.g., your account has been debited)', () => {
    const debitSms1 =
      'Your A/c ending 4812 has been debited by Rs 5,000.00 on 24-Nov-26 towards UPI/632948291099/Merchant. Bal: Rs 42,000.';
    const result1 = parseBankSmsNotification(debitSms1);

    expect(result1.success).toBe(false);
    expect(result1.error).toContain('Debit notification rejected');
    expect(result1.amountPaise).toBe(0);
  });

  it('strictly rejects money sent or paid out notifications', () => {
    const debitSms2 =
      'Paid Rs 1,200 to Supermart via UPI Ref 632948291098. Check balance in your app.';
    const result2 = parseBankSmsNotification(debitSms2);

    expect(result2.success).toBe(false);
    expect(result2.error).toContain('Debit notification rejected');

    const debitSms3 =
      'Rs 450 sent to 9829000000 via Google Pay. Ref: 632948291097.';
    const result3 = parseBankSmsNotification(debitSms3);

    expect(result3.success).toBe(false);
    expect(result3.error).toContain('Debit notification rejected');
  });

  it('rejects ambiguous messages without clear credit indicator', () => {
    const ambiguous =
      'Your balance for A/c XX1234 is INR 25,000 as of 24-Nov. Ref 632948291096.';
    const result = parseBankSmsNotification(ambiguous);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Ambiguous banking notification');
  });

  it('handles invalid or empty SMS text gracefully with descriptive error', () => {
    const result = parseBankSmsNotification('Hello, this is a test text without banking data');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
