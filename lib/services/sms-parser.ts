/**
 * Bank SMS & App Notification Parser for Wholesale FMCG (B2, Item 11 & Part 1.5 Compliance)
 * 
 * Accurately extracts Amount, UTR (12-digit reference), and Payer identity
 * from pasted messages.
 * 
 * STRICT RULES:
 * 1. Accepts ONLY clear credit messages (money received).
 * 2. Strictly rejects debit patterns (money paid, sent, withdrawn, debited).
 * 3. Rejects ambiguous messages without clear credit indicators.
 * 4. Requires owner confirmation before any payment is recorded.
 * 
 * Exact Invented Bank & UPI Message Formats:
 * 1. HDFC Bank (Invented):
 *    "Your a/c XX8921 is credited by Rs. 2,450.00 on 24-Nov-26 by UPI/632948291034/Ramesh Kirana Store via HDFC Bank."
 * 2. State Bank of India / SBI (Invented):
 *    "Dear Customer, your A/C XX1234 credited by INR 1,250.00 on 24-Nov-26 by UPI ref 738192049182 from Gupta Kirana. Bal: Rs 45,210.00."
 * 3. ICICI Bank (Invented):
 *    "ICICI Bank Acct XX5678 credited with Rs 5,400.00 on 24-Nov-26. UPI: 849201948291 / Payer: Mahadev General Store. Avail Bal: Rs 89,100."
 * 4. Axis Bank / PNB (Invented):
 *    "A/c *4321 credited by Rs. 890.00 on 24-Nov-26. Info: UPI/P2A/920194829103/Khandelwal Mart/AXIS. Total Bal: Rs 12,400."
 * 5. UPI Notification / PhonePe / Paytm / GPay (Invented):
 *    "Received Rs. 500.00 from Dinesh Kumar on PhonePe. UPI Ref: 102938475619."
 */

export interface ParsedPaymentSms {
  success: boolean;
  amountPaise: number;
  amountRupees: number;
  bankUtr: string;
  payerName: string;
  rawText: string;
  error?: string;
}

// Patterns that identify money going OUT (debit)
const DEBIT_REGEX = /\b(?:debited|debit(?:\s+of)?|sent|paid|transferred|spent|withdrawn|withdrawal|purchase|deducted)\b/i;

// Patterns that identify money coming IN (credit)
const CREDIT_REGEX = /\b(?:credited|credit(?:\s+of)?|received|deposited|deposit(?:\s+of)?|payment\s+received|inward|cr\b)/i;

export function parseBankSmsNotification(text: string): ParsedPaymentSms {
  if (!text || typeof text !== 'string') {
    return {
      success: false,
      amountPaise: 0,
      amountRupees: 0,
      bankUtr: '',
      payerName: '',
      rawText: text || '',
      error: 'Empty or invalid message text',
    };
  }

  const clean = text.trim();

  // 1. Strict Debit Guard: Reject outgoing transfers immediately
  if (DEBIT_REGEX.test(clean)) {
    return {
      success: false,
      amountPaise: 0,
      amountRupees: 0,
      bankUtr: '',
      payerName: '',
      rawText: clean,
      error: 'Debit notification rejected. Only incoming credit / money received notifications are accepted (पैसे भेजने या कटने वाले संदेश अस्वीकृत हैं).',
    };
  }

  // 2. Strict Credit Guard: Must contain an explicit credit keyword
  if (!CREDIT_REGEX.test(clean)) {
    return {
      success: false,
      amountPaise: 0,
      amountRupees: 0,
      bankUtr: '',
      payerName: '',
      rawText: clean,
      error: 'Ambiguous banking notification. No clear credit or money received indicator detected (पैसे प्राप्त होने की स्पष्ट पुष्टि नहीं मिली).',
    };
  }

  // 3. Amount Extraction
  // Matches "credited by Rs 15,400.00", "Rs. 890", "INR 3,500.00", "Received Rs 1200"
  let amountRupees = 0;
  const amountRegex = /(?:credited\s*(?:by|with)?|received|credit\s*of)\s*(?:Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)|(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i;
  const amountMatch = clean.match(amountRegex);

  if (amountMatch) {
    const rawNumStr = (amountMatch[1] || amountMatch[2] || '').replace(/,/g, '');
    const num = parseFloat(rawNumStr);
    if (!isNaN(num) && num > 0) {
      amountRupees = num;
    }
  }

  // 4. UTR (12-Digit Banking Reference Number)
  let bankUtr = '';
  // Pattern 1: Explicit labels like "UPI/P2A/632948291048", "Ref no 632948291048", "UTR: 632948291048", "UTR 632948291048"
  const labeledUtrMatch = clean.match(/(?:UTR[:\s]*|Ref\s*(?:no\.?)?[:\s]*|UPI\/(?:P2A\/)?|UPI\/)(\d{12})\b/i);
  if (labeledUtrMatch) {
    bankUtr = labeledUtrMatch[1];
  } else {
    // Pattern 2: Any standalone 12-digit integer
    const any12DigitMatch = clean.match(/\b(\d{12})\b/);
    if (any12DigitMatch) {
      bankUtr = any12DigitMatch[1];
    }
  }

  // 5. Payer Name Extraction
  let payerName = '';
  // Pattern 1: "UPI/P2A/123456789012/NAME/Bank" -> extracts NAME
  const upiSegmentMatch = clean.match(/UPI\/(?:P2A\/)?\d{12}\/([^/]+)/i);
  if (upiSegmentMatch && upiSegmentMatch[1]) {
    payerName = upiSegmentMatch[1].trim();
  }

  // Pattern 2: "Payer: RAMESH GUPTA" or "from RAMESH GUPTA"
  if (!payerName) {
    const payerLabelMatch = clean.match(/(?:Payer[:\s]+|from\s+)([A-Za-z\s]{3,35}?)(?:\s+via\b|\s+UPI\b|\s+on\b|\.|\,|$)/i);
    if (payerLabelMatch && payerLabelMatch[1]) {
      const candidate = payerLabelMatch[1].trim();
      // Filter out common false matches
      if (!/^(A\/c|Account|Bank|INR|Rs|UPI)$/i.test(candidate)) {
        payerName = candidate;
      }
    }
  }

  // Fallback cleanup
  if (payerName) {
    payerName = payerName.replace(/[\/,\.]/g, '').trim();
  }

  const amountPaise = Math.round(amountRupees * 100);

  if (amountPaise <= 0) {
    return {
      success: false,
      amountPaise: 0,
      amountRupees: 0,
      bankUtr,
      payerName,
      rawText: clean,
      error: 'Could not extract valid credit amount from text',
    };
  }

  if (!bankUtr) {
    return {
      success: false,
      amountPaise,
      amountRupees,
      bankUtr: '',
      payerName,
      rawText: clean,
      error: 'Could not extract 12-digit bank UTR reference',
    };
  }

  return {
    success: true,
    amountPaise,
    amountRupees,
    bankUtr,
    payerName: payerName || 'Direct UPI Transfer',
    rawText: clean,
  };
}
