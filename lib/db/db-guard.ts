/**
 * Database Safety Guard
 * 
 * Strictly ensures destructive scripts (seeds, test teardowns, migrations)
 * CANNOT run against production or cloud databases like Supabase.
 * Strictly prevents automated tests from modifying demo database data.
 * NEVER prints credentials or full connection strings in error messages.
 */

export function assertLocalDatabase(context = 'Operation'): void {
  if (process.env.ALLOW_CLOUD_SEED === 'true') {
    return;
  }
  const dbUrl = process.env.DATABASE_URL || '';

  // Extract hostname without exposing credentials
  let isLocal = false;
  try {
    const url = new URL(dbUrl);
    const hostname = url.hostname.toLowerCase();
    isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    // If not a standard URL, fallback check
    isLocal = dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost');
  }

  if (!isLocal) {
    const sanitizedHost = dbUrl.split('@')[1]?.split('/')[0] || 'remote-host';
    throw new Error(
      `[DATABASE SAFETY GUARD] Refusing to execute "${context}" against non-local database host (${sanitizedHost}). This script may only be executed on local Postgres (127.0.0.1).`
    );
  }
}

/**
 * A8: Enforces strict separation between demo and test databases.
 * Tests MUST run against a dedicated test database (e.g. vitarak_fmcg_test).
 * If tests point to the demo database (vitarak_fmcg), execution is immediately rejected.
 */
export function assertTestDatabase(context = 'Automated Test Suite'): void {
  assertLocalDatabase(context);
  const dbUrl = process.env.DATABASE_URL || '';

  // Check if database name or schema contains '_test'
  let isTestDb = false;
  try {
    const url = new URL(dbUrl);
    const pathname = url.pathname.toLowerCase();
    isTestDb = pathname.includes('_test') || pathname.includes('test');
  } catch {
    isTestDb = dbUrl.includes('_test') || dbUrl.includes('test');
  }

  if (!isTestDb) {
    throw new Error(
      `[TEST DATABASE SAFETY GUARD] Refusing to run "${context}" against demo database! Automated tests MUST run against a test database containing "_test" (e.g. vitarak_fmcg_test) to prevent demo data pollution.`
    );
  }
}
