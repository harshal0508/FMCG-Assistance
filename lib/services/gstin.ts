/**
 * GSTIN Validation, Checksum Verification, and Privacy Masking Service
 * 
 * Implements:
 * 1. 15-character GSTIN structural format validation
 * 2. Standard Luhn Modulo-36 checksum verification
 * 3. Bilingual English & Hindi error messages
 * 4. PII masking for logs and non-owner interfaces
 */

export const GSTIN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface GstinValidationResult {
  valid: boolean;
  gstin?: string;
  errorEn?: string;
  errorHi?: string;
}

/**
 * Computes the 15th checksum character for the first 14 characters of a GSTIN using Luhn Mod-36.
 */
export function computeGstinChecksum(first14: string): string {
  const clean = first14.toUpperCase();
  let sum = 0;

  for (let i = 0; i < 14; i++) {
    const char = clean[i];
    const val = GSTIN_ALPHABET.indexOf(char);
    if (val === -1) return '';

    // Multiplier alternates: 1 for odd positions (0, 2, 4...), 2 for even positions (1, 3, 5...)
    const factor = (i % 2 === 0) ? 1 : 2;
    const prod = val * factor;
    const q = Math.floor(prod / 36);
    const r = prod % 36;
    sum += q + r;
  }

  const checkVal = (36 - (sum % 36)) % 36;
  return GSTIN_ALPHABET[checkVal];
}

/**
 * Validates format, state code, and Mod-36 checksum of a GSTIN string.
 * Returns bilingual error messages if invalid.
 */
export function validateGstin(rawGstin: string): GstinValidationResult {
  if (!rawGstin || typeof rawGstin !== 'string') {
    return {
      valid: false,
      errorEn: 'GSTIN is required (or request an admin exception).',
      errorHi: 'जीएसटीआईएन (GSTIN) आवश्यक है (या व्यवस्थापक छूट का अनुरोध करें)।',
    };
  }

  const gstin = rawGstin.trim().toUpperCase();

  if (gstin.length !== 15) {
    return {
      valid: false,
      errorEn: `GSTIN must be exactly 15 characters long (currently ${gstin.length}).`,
      errorHi: `जीएसटीआईएन ठीक 15 अक्षरों का होना चाहिए (वर्तमान लंबाई: ${gstin.length})।`,
    };
  }

  // Structural regex check:
  // 2 digits state code (01-38), 5 letters PAN, 4 digits PAN, 1 letter PAN, 1 char entity, 'Z', 1 checksum char
  const formatRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!formatRegex.test(gstin)) {
    return {
      valid: false,
      errorEn: 'Invalid GSTIN format. Example format: 27AAAAA0000A1Z5.',
      errorHi: 'जीएसटीआईएन प्रारूप अमान्य है। उदाहरण प्रारूप: 27AAAAA0000A1Z5.',
    };
  }

  const stateCode = parseInt(gstin.slice(0, 2), 10);
  if (stateCode < 1 || stateCode > 38) {
    return {
      valid: false,
      errorEn: `Invalid State Code "${gstin.slice(0, 2)}" in GSTIN. Must be between 01 and 38.`,
      errorHi: `जीएसटीआईएन में राज्य कोड "${gstin.slice(0, 2)}" अमान्य है (01 से 38 के बीच होना चाहिए)।`,
    };
  }

  // Modulo-36 Checksum verification
  const expectedChecksum = computeGstinChecksum(gstin.slice(0, 14));
  const actualChecksum = gstin[14];

  if (actualChecksum !== expectedChecksum) {
    return {
      valid: false,
      errorEn: 'GSTIN checksum verification failed. Please check for typing mistakes.',
      errorHi: 'जीएसटीआईएन चेकसम सत्यापन विफल रहा। कृपया टाइपिंग की गलती जांचें।',
    };
  }

  return {
    valid: true,
    gstin,
  };
}

/**
 * Strongly masks a GSTIN for logs and non-owner interfaces.
 * Shows ONLY the state code (first 2 characters) and last 2 characters,
 * completely masking the 10-character PAN and entity code.
 * Example: "27ABCDE1234F1Z0" -> "27***********Z0"
 */
export function maskGstin(gstin?: string | null): string {
  if (!gstin) return '';
  const clean = gstin.trim().toUpperCase();
  if (clean.length < 15) return '***MASKED***';
  return `${clean.slice(0, 2)}***********${clean.slice(13)}`;
}

/**
 * Generates a valid test/mock GSTIN for automated unit testing (NEVER uses real GSTINs).
 */
export function generateMockTestGstin(stateCode = 27, randomSuffix = 'TEST1'): string {
  const stateStr = String(stateCode).padStart(2, '0');
  const panLetters = 'ABCDE';
  const panDigits = '1234';
  const panChar = 'F';
  const entityChar = '1';
  const zChar = 'Z';
  const first14 = `${stateStr}${panLetters}${panDigits}${panChar}${entityChar}${zChar}`;
  const checksum = computeGstinChecksum(first14);
  return `${first14}${checksum}`;
}
