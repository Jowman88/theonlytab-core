import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { hashVoter, verifyTurnstile } from '../../../lib/likes';
import { logger } from '../../../lib/logger';
import {
  getTotalPredictions,
  isMissingTableError,
  parseGuessMinutes,
  PREDICTION_WINDOW_MINUTES,
  sanitizeNickname,
} from '../../../lib/predictions';
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
    const { slotId, guessMinutes, nickname, turnstileToken } = body || {};

    if (!slotId || typeof slotId !== 'string' || !UUID_PATTERN.test(slotId)) {
      return NextResponse.json({ error: 'Invalid slotId parameter.' }, { status: 400 });
    }
    const guess = parseGuessMinutes(guessMinutes);
    if (guess === null) {
      return NextResponse.json({ error: 'guessMinutes must be a whole number from 1 to 90.' }, { status: 400 });
    }

    const clientIp = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit({
      bucket: 'predict',
      identifier: `${clientIp}:${slotId}`,
      windowMs: 60_000,
      maxRequests: 10,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many predictions from this client. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    if (!(await verifyTurnstile(turnstileToken, clientIp))) {
      return NextResponse.json({ error: 'Bot check failed.' }, { status: 403 });
    }

    const client = await getDbPool().connect();
    try {
      const slotRes = await client.query(
        `SELECT report_count,
                (created_at + INTERVAL '${PREDICTION_WINDOW_MINUTES} minutes' > NOW()) AS window_open
         FROM slots WHERE id = $1 AND is_frozen = FALSE AND expires_at > NOW()`,
        [slotId]
      );
      if (slotRes.rows.length === 0) {
        return NextResponse.json({ error: 'Active slot not found.' }, { status: 404 });
      }
      if (Number(slotRes.rows[0].report_count || 0) > 0) {
        return NextResponse.json({ error: 'Reported stages cannot be predicted.' }, { status: 403 });
      }
      if (!slotRes.rows[0].window_open) {
        return NextResponse.json({ error: 'Predictions are closed for this reign.' }, { status: 403 });
      }

      const insertRes = await client.query(
        `INSERT INTO slot_predictions (slot_id, voter_hash, guess_minutes, nickname)
         VALUES ($1, $2, $3, $4) ON CONFLICT (slot_id, voter_hash) DO NOTHING RETURNING id`,
        [slotId, hashVoter(clientIp), guess, sanitizeNickname(nickname)]
      );
      if (insertRes.rows.length === 0) {
        return NextResponse.json({ error: 'You already predicted this reign.' }, { status: 409 });
      }

      return NextResponse.json({ status: 'predicted', totalPredictions: await getTotalPredictions(client, slotId) });
    } finally {
      client.release();
    }
  } catch (err: any) {
    if (isMissingTableError(err)) {
      return NextResponse.json({ error: 'Predictions are not available yet.' }, { status: 503 });
    }
    logger.error('POST /api/predict failed', { route: 'predict', error: err });
    return NextResponse.json({ error: 'Unable to register prediction.' }, { status: 500 });
  }
}
