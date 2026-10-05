import { NextResponse } from 'next/server';
import { logger } from '../../../../lib/logger';
import { getDbPool } from '../../../../lib/db';
import { ACTIVE_SLOT_ORDER_BY_SQL } from '../../../../lib/paidTakeover';
import { isValidAdminSecret } from '../../../../lib/adminAuth';
import { settlePredictions } from '../../../../lib/predictions';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const timestamp = new Date().toISOString();
  const hasConfiguredSecret = Boolean(process.env.ADMIN_SECRET);
  const isAuthorized = isValidAdminSecret(
    process.env.ADMIN_SECRET,
    request.headers.get('X-Admin-Secret')
  );
  const authStatus = !hasConfiguredSecret ? 'not_configured' : isAuthorized ? 'valid' : 'invalid';

  if (!isAuthorized) {
    logger.warn('Admin stage revert request rejected', {
      route: 'admin/revert-to-house',
      timestamp,
      authStatus,
      slotId: null,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = await getDbPool().connect();
    let slotId: string | null = null;

    try {
      const result = await client.query(
        `UPDATE slots
         SET is_frozen = TRUE, expires_at = NOW()
         WHERE id = (
           SELECT id
           FROM slots
           WHERE is_frozen = FALSE AND expires_at > NOW()
           ORDER BY ${ACTIVE_SLOT_ORDER_BY_SQL}
           LIMIT 1
         )
         RETURNING id`
      );
      slotId = result.rows[0]?.id ?? null;
    } finally {
      client.release();
    }

    if (slotId) await settlePredictions(slotId, new Date());

    logger.info('Admin stage revert completed', {
      route: 'admin/revert-to-house',
      timestamp,
      authStatus,
      slotId,
    });

    return NextResponse.json({ status: slotId ? 'reverted' : 'no_active_slot', slotId, timestamp });
  } catch (error) {
    logger.error('Admin stage revert failed', {
      route: 'admin/revert-to-house',
      timestamp,
      authStatus,
      slotId: null,
      error,
    });
    return NextResponse.json({ error: 'Unable to revert the active stage right now.' }, { status: 500 });
  }
}
