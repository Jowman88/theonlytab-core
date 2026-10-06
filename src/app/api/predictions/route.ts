import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { hashVoter } from '../../../lib/likes';
import { logger } from '../../../lib/logger';
import {
  formatReignLength,
  getTotalPredictions,
  isMissingTableError,
  PREDICTION_WINDOW_MINUTES,
  secondsLeftToPredict,
} from '../../../lib/predictions';
import { getClientIpAddress } from '../../../lib/rateLimit';

export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const slotId = new URL(request.url).searchParams.get('slotId');
  if (!slotId || !UUID_PATTERN.test(slotId)) {
    return NextResponse.json({ error: 'Invalid slotId parameter.' }, { status: 400 });
  }

  try {
    const client = await getDbPool().connect();
    try {
      const slotRes = await client.query(
        `SELECT created_at, report_count, (is_frozen = FALSE AND expires_at > NOW()) AS active FROM slots WHERE id = $1`,
        [slotId]
      );
      const slot = slotRes.rows[0];
      if (!slot) return NextResponse.json({ error: 'Slot not found.' }, { status: 404 });

      const secondsLeft = slot.active && Number(slot.report_count || 0) === 0 ? secondsLeftToPredict(slot.created_at) : 0;
      const totalPredictions = await getTotalPredictions(client, slotId);

      let myGuess: number | null = null;
      let result: { actualMinutes: number; reignLabel: string; winnerNickname: string | null; hasWinner: boolean } | null = null;
      try {
        const mine = await client.query(
          `SELECT guess_minutes FROM slot_predictions WHERE slot_id = $1 AND voter_hash = $2`,
          [slotId, hashVoter(getClientIpAddress(request))]
        );
        if (mine.rows[0]) myGuess = Number(mine.rows[0].guess_minutes);

        // Others' guesses are only ever exposed implicitly via the winner, and only after settlement.
        if (!slot.active) {
          const res = await client.query(
            `SELECT r.actual_minutes, p.nickname, r.winner_prediction_id
             FROM prediction_results r LEFT JOIN slot_predictions p ON p.id = r.winner_prediction_id
             WHERE r.slot_id = $1`,
            [slotId]
          );
          if (res.rows[0]) {
            const actualMinutes = Number(res.rows[0].actual_minutes);
            result = {
              actualMinutes,
              reignLabel: formatReignLength(actualMinutes),
              winnerNickname: res.rows[0].nickname ?? null,
              hasWinner: Boolean(res.rows[0].winner_prediction_id),
            };
          }
        }
      } catch (error) {
        if (!isMissingTableError(error)) throw error;
      }

      return NextResponse.json({
        open: secondsLeft > 0,
        windowMinutes: PREDICTION_WINDOW_MINUTES,
        secondsLeftToPredict: secondsLeft,
        totalPredictions,
        ...(myGuess !== null ? { myGuess } : {}),
        ...(result ? { result } : {}),
      });
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('GET /api/predictions failed', { route: 'predictions', error: err });
    return NextResponse.json({ error: 'Unable to load predictions.' }, { status: 500 });
  }
}
