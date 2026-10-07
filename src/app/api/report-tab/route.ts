import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { logger } from '../../../lib/logger';
import { enforceRateLimit, getClientIpAddress } from '../../../lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { slotId } = await request.json();

    if (!slotId || typeof slotId !== 'string') {
      return NextResponse.json({ error: 'Missing slotId parameter.' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(slotId)) {
      return NextResponse.json({ error: 'Invalid slotId parameter.' }, { status: 400 });
    }

    const clientIp = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit({
      bucket: 'report-tab',
      identifier: `${clientIp}:${slotId}`,
      windowMs: 60_000,
      maxRequests: 3,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many reports from this client. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    const client = await getDbPool().connect();

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
  } catch (err: unknown) {
    logger.error('Report Error:', { error: err });
    return NextResponse.json({ error: (err as Error)?.message }, { status: 500 });
  }
}
