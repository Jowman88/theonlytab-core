import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { getActiveLikeCount, hashVoter, verifyTurnstile } from '../../../lib/likes';
import { logger } from '../../../lib/logger';
import { enforceRateLimit, getClientIpAddress } from '../../../lib/rateLimit';

export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const { slotId, turnstileToken } = body || {};

    if (!slotId || typeof slotId !== 'string' || !UUID_PATTERN.test(slotId)) {
      return NextResponse.json({ error: 'Invalid slotId parameter.' }, { status: 400 });
    }

    const clientIp = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit({
      bucket: 'like-tab',
      identifier: `${clientIp}:${slotId}`,
      windowMs: 60_000,
      maxRequests: 10,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many likes from this client. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    if (!(await verifyTurnstile(turnstileToken, clientIp))) {
      return NextResponse.json({ error: 'Bot check failed.' }, { status: 403 });
    }

    const client = await getDbPool().connect();

    try {
      const slotRes = await client.query(
        `SELECT report_count FROM slots WHERE id = $1 AND is_frozen = FALSE AND expires_at > NOW()`,
        [slotId]
      );

      if (slotRes.rows.length === 0) {
        return NextResponse.json({ error: 'Active slot not found.' }, { status: 404 });
      }

      if (Number(slotRes.rows[0].report_count || 0) > 0) {
        return NextResponse.json({ error: 'Reported stages cannot be liked.' }, { status: 403 });
      }

      const insertRes = await client.query(
        `INSERT INTO slot_likes (slot_id, voter_hash) VALUES ($1, $2) ON CONFLICT (slot_id, voter_hash) DO NOTHING RETURNING id`,
        [slotId, hashVoter(clientIp)]
      );

      if (insertRes.rows.length === 0) {
        return NextResponse.json({ error: 'You already liked this stage.' }, { status: 409 });
      }

      const activeLikes = await getActiveLikeCount(client, slotId);
      return NextResponse.json({ status: 'liked', active_likes: activeLikes });
    } finally {
      client.release();
    }
  } catch (err: any) {
    logger.error('POST /api/like-tab failed', { route: 'like-tab', error: err });
    return NextResponse.json({ error: 'Unable to register like.' }, { status: 500 });
  }
}
