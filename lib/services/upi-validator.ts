/**
 * UPI Handle Validator & Safety Guard (Item 3 Compliance)
 * 
 * Enforces:
 * 1. Demo UPI handles (e.g. demo@invalid, *.demo@invalid) are clearly identified as non-routable simulation handles.
 * 2. Production setup / onboarding strictly rejects demo handles, preventing test credentials from reaching production.
 * 3. Helper to detect whether a UPI ID is a demo handle so UI can render a mandatory safety warning banner.
 */

export const DEMO_UPI_HANDLE = 'demo@invalid';

/**
 * Checks if a given UPI ID is an invalid demo/test handle.
 */
export function isDemoUpi(upiId?: string | null): boolean {
  if (!upiId) return false;
  const lower = upiId.toLowerCase().trim();
  return (
    lower === 'demo@invalid' ||
    lower.endsWith('@invalid') ||
    lower.includes('demo') ||
    lower.includes('test') ||
    lower.includes('example')
  );
}

/**
 * Validates a UPI ID for production use.
 * In production environment, strictly rejects any demo or invalid UPI handles.
 */
export function validateProductionUpi(
  upiId: string,
  isProduction = process.env.NODE_ENV === 'production'
): { valid: boolean; error?: string } {
  if (!upiId || typeof upiId !== 'string') {
    return { valid: false, error: 'UPI ID is required.' };
  }

  const trimmed = upiId.trim();

  if (isDemoUpi(trimmed)) {
    if (isProduction) {
      return {
        valid: false,
        error: 'Demo or invalid UPI handles (such as demo@invalid) are strictly rejected in production.',
      };
    }
    return { valid: true };
  }

  // Standard VPA format check: username@handle
  const vpaRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  if (!vpaRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid UPI VPA format. Must be username@bankhandle (e.g. merchant@icici).',
    };
  }

  return { valid: true };
}
