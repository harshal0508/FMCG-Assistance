import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, revokeServerSession } from '@/lib/services/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    try {
      await revokeServerSession(rawToken);
    } catch {
      // ignore
    }
  }

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  // Clear session cookie completely
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
