import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db/prisma';

describe('Database Security - Row Level Security (RLS) Enforcement Check', () => {
  it('strictly verifies that EVERY public table has Row Level Security enabled', async () => {
    // Query all public tables and their RLS status
    const tables: Array<{ tablename: string; rls_enabled: boolean }> = await prisma.$queryRawUnsafe(`
      SELECT 
        c.relname as tablename,
        c.relrowsecurity as rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname NOT LIKE '_prisma%'
      ORDER BY c.relname;
    `);

    expect(tables.length).toBeGreaterThan(0);

    const tablesLackingRls = tables.filter((t) => !t.rls_enabled);

    if (tablesLackingRls.length > 0) {
      const names = tablesLackingRls.map((t) => t.tablename).join(', ');
      throw new Error(
        `[SECURITY CI FAILURE] Found public tables lacking Row Level Security (RLS): [${names}]. All public tables MUST have RLS enabled!`
      );
    }

    expect(tablesLackingRls.length).toBe(0);
  });
});
