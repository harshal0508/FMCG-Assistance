import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { SESSION_COOKIE_NAME, validateServerSession } from '@/lib/services/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const session = await validateServerSession(sessionToken);
    if (!session || !session.isUnlocked) {
      return NextResponse.json({ error: 'Unauthorized: Session locked' }, { status: 401 });
    }

    const tenantId = session.tenantId;

    const festivals = await prisma.festivalSuggestion.findMany({
      where: { tenant_id: tenantId },
      orderBy: { start_date: 'asc' },
    });

    return NextResponse.json({ success: true, festivals });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch festivals' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const session = await validateServerSession(sessionToken);
    if (!session || !session.isUnlocked) {
      return NextResponse.json({ error: 'Unauthorized: Session locked' }, { status: 401 });
    }

    const tenantId = session.tenantId;
    const body = await req.json();

    const {
      id,
      festival_name,
      festival_name_hi,
      start_date,
      end_date,
      notes,
      items = [],
    } = body;

    if (!festival_name || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'festival_name, start_date, and end_date are required' },
        { status: 400 }
      );
    }

    const start = new Date(start_date);
    const end = new Date(end_date);

    if (start > end) {
      return NextResponse.json(
        { error: 'start_date cannot be later than end_date' },
        { status: 400 }
      );
    }

    const itemsJson = typeof items === 'string' ? items : JSON.stringify(items);

    if (id) {
      const updated = await prisma.festivalSuggestion.update({
        where: { id },
        data: {
          festival_name,
          festival_name_hi,
          start_date: start,
          end_date: end,
          notes,
          items_json: itemsJson,
        },
      });
      return NextResponse.json({ success: true, festival: updated });
    }

    const created = await prisma.festivalSuggestion.create({
      data: {
        tenant_id: tenantId,
        festival_name,
        festival_name_hi,
        start_date: start,
        end_date: end,
        notes,
        items_json: itemsJson,
      },
    });

    return NextResponse.json({ success: true, festival: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save festival suggestion' }, { status: 500 });
  }
}
