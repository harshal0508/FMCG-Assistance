/**
 * Security & Privacy Logging Service (Part 2.13 Compliance)
 * - Masks phone numbers in all logs (e.g. +91 98290XXXXX)
 * - Provides retention cleanup for Outbox message bodies
 */

import { prisma } from '@/lib/db/prisma';

export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return 'N/A';
  const clean = phone.trim();
  let digits = clean.replace(/\D/g, '');
  const hasCountryCode = clean.startsWith('+91') || digits.length > 10;
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  if (digits.length < 5) return 'XXXXXX';
  const first5 = digits.slice(0, 5);
  const prefix = hasCountryCode ? '+91 ' : '';
  return `${prefix}${first5}XXXXX`;
}

export function logSecure(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, any>) {
  const sanitizedMeta: Record<string, any> = {};
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (/phone|mobile|tel/i.test(key) && typeof value === 'string') {
        sanitizedMeta[key] = maskPhoneNumber(value);
      } else {
        sanitizedMeta[key] = value;
      }
    }
  }

  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(sanitizedMeta).length > 0 ? ` ${JSON.stringify(sanitizedMeta)}` : '';
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;

  if (level === 'error') {
    console.error(logLine);
  } else if (level === 'warn') {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }
}

/**
 * Truncate/archive message bodies older than the retention threshold (default 30 days)
 * to prevent unnecessary storage of full customer communication history.
 */
export async function cleanupExpiredOutboxBodies(tenantId: string, retentionDays = 30): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.outboxMessage.updateMany({
    where: {
      tenant_id: tenantId,
      created_at: { lt: cutoffDate },
      body: { not: '[ARCHIVED_BODY]' },
    },
    data: {
      body: '[ARCHIVED_BODY]',
    },
  });
  return result.count;
}
