import { NextResponse } from 'next/server';
import { getHallOfFame } from '../../../lib/hallOfFame';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getHallOfFame();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to load hall of fame' }, { status: 500 });
  }
}
