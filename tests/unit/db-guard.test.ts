import { describe, it, expect } from 'vitest';
import { assertLocalDatabase, assertTestDatabase } from '@/lib/db/db-guard';

describe('Database Safety Guard', () => {
  it('allows localhost and 127.0.0.1 without throwing', () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'postgresql://postgres:pass@127.0.0.1:5432/vitarak_fmcg';
      expect(() => assertLocalDatabase('Test Operation')).not.toThrow();

      process.env.DATABASE_URL = 'postgresql://postgres:pass@localhost:5432/vitarak_fmcg';
      expect(() => assertLocalDatabase('Test Operation')).not.toThrow();
    } finally {
      process.env.DATABASE_URL = originalUrl;
    }
  });

  it('strictly rejects cloud or non-local hosts and never prints credentials', () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'postgresql://postgres.testref:supersecret123@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
      expect(() => assertLocalDatabase('Test Operation')).toThrow(/Refusing to execute/);
      expect(() => assertLocalDatabase('Test Operation')).toThrow(/DATABASE SAFETY GUARD/);
      // Ensure password was not leaked in error message
      try {
        assertLocalDatabase('Test Operation');
      } catch (err: any) {
        expect(err.message).not.toContain('supersecret123');
      }
    } finally {
      process.env.DATABASE_URL = originalUrl;
    }
  });

  it('assertTestDatabase allows dedicated test databases containing "_test"', () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:5432/vitarak_fmcg_test';
      expect(() => assertTestDatabase('Automated Test Suite')).not.toThrow();
    } finally {
      process.env.DATABASE_URL = originalUrl;
    }
  });

  it('assertTestDatabase rejects the demo database (vitarak_fmcg) to prevent test data pollution', () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:5432/vitarak_fmcg';
      expect(() => assertTestDatabase('Automated Test Suite')).toThrow(
        /Refusing to run "Automated Test Suite" against demo database/
      );
    } finally {
      process.env.DATABASE_URL = originalUrl;
    }
  });
});

