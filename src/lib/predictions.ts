import { getDbPool } from './db';
import { logger } from './logger';
import { TAKEOVER_DURATION_MINUTES } from './paidTakeover';

export const PREDICTION_WINDOW_MINUTES = 10;
export const PREDICTION_WIN_POINTS = 10;
export const PREDICTION_CLOSE_POINTS = 3;
export const PREDICTION_CLOSE_MINUTES = 2;
export const ORACLE_MIN_WINS = 3;

interface Queryable {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
}

export interface PredictionEntry {
  id: string;
  voterHash: string;
  guessMinutes: number;
  nickname: string | null;
  createdAt: Date | string;
}

export function isMissingTableError(error: any): boolean {
  return error?.code === '42P01';
}

export function parseGuessMinutes(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= 1 && value <= TAKEOVER_DURATION_MINUTES ? value : null;
}

/** Trim, strip URLs/markup and a basic profanity list, cap at 24 chars. Returns null if empty. */
export function sanitizeNickname(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|app|xyz|ru|cn|info|gg|ly|me)\b\S*/gi, ' ')
    .replace(/fuck\w*|shit\w*|cunt\w*|nigg\w*|fagg?\w*|bitch\w*|asshole\w*|whore\w*|slut\w*|rape\w*|nazi\w*/gi, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
    .trim();
  return cleaned || null;
}

/** Closest guess wins; ties go to the earliest submitted guess. */
export function pickWinner(entries: PredictionEntry[], actualMinutes: number): PredictionEntry | null {
  let best: PredictionEntry | null = null;
  for (const entry of entries) {
    if (!best) {
      best = entry;
      continue;
    }
    const diff = Math.abs(entry.guessMinutes - actualMinutes);
    const bestDiff = Math.abs(best.guessMinutes - actualMinutes);
    if (diff < bestDiff) {
      best = entry;
    } else if (diff === bestDiff) {
      const a = new Date(entry.createdAt).getTime();
      const b = new Date(best.createdAt).getTime();
      if (a < b || (a === b && entry.id < best.id)) best = entry;
    }
  }
  return best;
}

export function formatReignLength(actualMinutes: number): string {
  const totalSeconds = Math.max(0, Math.round(actualMinutes * 60));
  return `${Math.floor(totalSeconds / 60)}m ${String(totalSeconds % 60).padStart(2, '0')}s`;
}

export async function getTotalPredictions(client: Queryable, slotId: string): Promise<number> {
  try {
    const res = await client.query(`SELECT COUNT(*) AS count FROM slot_predictions WHERE slot_id = $1`, [slotId]);
    return Number.parseInt(String(res.rows?.[0]?.count ?? '0'), 10) || 0;
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

export function secondsLeftToPredict(createdAt: Date | string | number): number {
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(PREDICTION_WINDOW_MINUTES * 60 - elapsed));
}

async function settleWithClient(client: Queryable, slotId: string, endedAt: Date): Promise<boolean> {
  const slotRes = await client.query(
    `SELECT created_at, expires_at, report_count FROM slots WHERE id = $1`,
    [slotId]
  );
  const slot = slotRes.rows[0];
  if (!slot || Number(slot.report_count || 0) > 0) return false;

  const end = Math.min(endedAt.getTime(), new Date(slot.expires_at).getTime());
  const actualMinutes = Math.round(((end - new Date(slot.created_at).getTime()) / 60000) * 100) / 100;
  if (!Number.isFinite(actualMinutes) || actualMinutes < PREDICTION_WINDOW_MINUTES) return false;

  const insertRes = await client.query(
    `INSERT INTO prediction_results (slot_id, actual_minutes) VALUES ($1, $2) ON CONFLICT (slot_id) DO NOTHING RETURNING slot_id`,
    [slotId, actualMinutes]
  );
  if (insertRes.rows.length === 0) return false;

  const predRes = await client.query(
    `SELECT id, voter_hash, guess_minutes, nickname, created_at FROM slot_predictions WHERE slot_id = $1`,
    [slotId]
  );
  const entries: PredictionEntry[] = predRes.rows.map((r) => ({
    id: String(r.id),
    voterHash: String(r.voter_hash),
    guessMinutes: Number(r.guess_minutes),
    nickname: r.nickname ?? null,
    createdAt: r.created_at,
  }));
  const winner = pickWinner(entries, actualMinutes);
  if (!winner) return true;

  await client.query(`UPDATE prediction_results SET winner_prediction_id = $2 WHERE slot_id = $1`, [slotId, winner.id]);

  for (const entry of entries) {
    const isWinner = entry.id === winner.id;
    const isClose = !isWinner && Math.abs(entry.guessMinutes - actualMinutes) <= PREDICTION_CLOSE_MINUTES;
    const points = isWinner ? PREDICTION_WIN_POINTS : isClose ? PREDICTION_CLOSE_POINTS : 0;
    await client.query(
      `INSERT INTO prediction_scores (voter_hash, nickname, points, wins, streak, updated_at)
       VALUES ($1, $2, $3, $4, $4, NOW())
       ON CONFLICT (voter_hash) DO UPDATE SET
         points = prediction_scores.points + EXCLUDED.points,
         wins = prediction_scores.wins + EXCLUDED.wins,
         streak = CASE WHEN $4 = 1 THEN prediction_scores.streak + 1 ELSE 0 END,
         nickname = COALESCE(EXCLUDED.nickname, prediction_scores.nickname),
         updated_at = NOW()`,
      [entry.voterHash, entry.nickname, points, isWinner ? 1 : 0]
    );
  }
  return true;
}

/**
 * Settle the prediction round for a finished reign exactly once.
 * Idempotent: prediction_results.slot_id is the guard, and points are only awarded
 * when that insert succeeds, all inside one transaction. Never throws.
 */
export async function settlePredictions(slotId: string, endedAt: Date | string = new Date()): Promise<boolean> {
  let client;
  try {
    client = await getDbPool().connect();
  } catch (error) {
    logger.error('Prediction settlement could not connect', { route: 'predictions', slotId, error });
    return false;
  }
  try {
    await client.query('BEGIN');
    const settled = await settleWithClient(client, slotId, new Date(endedAt));
    await client.query('COMMIT');
    return settled;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    if (!isMissingTableError(error)) {
      logger.error('Prediction settlement failed', { route: 'predictions', slotId, error });
    }
    return false;
  } finally {
    client.release();
  }
}
