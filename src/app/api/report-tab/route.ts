import { NextResponse } from 'next/server';
import { dbPool } from '../../../lib/db';

const reportTimestamps = new Map<string, number[]>();
const REPORT_WINDOW_MS = 60 * 1000;
const REPORT_LIMIT_PER_WINDOW = 3;

export async function POST(request: Request) {
  try {
    const { slotId } = await request.json();

    if (!slotId || typeof slotId !== 'string') {
      return NextResponse.json({ error: 'Missing slotId parameter.' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(slotId)) {
      return NextResponse.json({ error: 'Invalid slotId parameter.' }, { status: 400 });
    }

    const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const clientIp = forwardedFor.split(',')[0].trim();
    const cacheKey = `${clientIp}:${slotId}`;
    const now = Date.now();

    const recentReports = (reportTimestamps.get(cacheKey) || []).filter((timestamp) => now - timestamp < REPORT_WINDOW_MS);
    if (recentReports.length >= REPORT_LIMIT_PER_WINDOW) {
      return NextResponse.json({ error: 'Too many reports from this client. Please wait a moment and try again.' }, { status: 429 });
    }

    reportTimestamps.set(cacheKey, [...recentReports, now]);

    const client = await dbPool.connect();

    try {
      const updateRes = await client.query(
        `UPDATE slots SET report_count = report_count + 1 WHERE id = $1 RETURNING report_count`,
        [slotId]
      );

      if (updateRes.rows.length === 0) {
        return NextResponse.json({ error: 'Active slot not found.' }, { status: 404 });
      }

      const currentCount = Number(updateRes.rows[0].report_count);

      if (currentCount >= 5) {
        await client.query(
          `UPDATE slots SET is_frozen = true, expires_at = NOW() WHERE id = $1`,
          [slotId]
        );
        return NextResponse.json({ status: 'slot_slashed_and_blacklisted', current_count: currentCount });
      }

      return NextResponse.json({ status: 'reported', current_count: currentCount });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Report Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
