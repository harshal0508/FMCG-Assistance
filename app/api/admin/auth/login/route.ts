import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, isEmailInAdminAllowlist, ADMIN_SESSION_COOKIE_NAME } from '@/lib/services/admin-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';
    const rateCheck = await checkRateLimit(`admin_login_${ip}`, 5, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait 1 minute.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, googleSub, totpCode } = body;

    if (!email || !googleSub) {
      return NextResponse.json({ error: 'Email and Google authentication are required.' }, { status: 400 });
    }

    if (!isEmailInAdminAllowlist(email)) {
      return NextResponse.json(
        { error: 'Access denied: Google account is not on the administrator allowlist.' },
        { status: 403 }
      );
    }

    const admin = await authenticateAdmin(email, googleSub, totpCode || '');

    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    });

    // Set secure admin session cookie
    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, JSON.stringify({ adminId: admin.id, email: admin.email }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/admin',
      maxAge: 8 * 3600, // 8 hours
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Admin authentication failed' }, { status: 401 });
  }
}
