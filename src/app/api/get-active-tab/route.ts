import { NextResponse } from 'next/server';
import { getDbPool } from '../../../lib/db';
import { getActiveLikeCount } from '../../../lib/likes';
import { logger } from '../../../lib/logger';
import { ACTIVE_SLOT_ORDER_BY_SQL } from '../../../lib/paidTakeover';
import { calculateStealPrice, getBasePrice, getCrowdPercent, PricingSettings } from '../../../lib/pricing';
import { getServerPricingSettings } from '../../../lib/pricingConfig';

export const dynamic = 'force-dynamic';

const HOUSE_DEFAULT_URL = 'https://theonlytab.io/house-default';

export async function GET() {
  const client = await getDbPool().connect();
  let pricingSettings: PricingSettings | undefined;

  try {
    pricingSettings = await getServerPricingSettings();

    await client.query(`UPDATE slots SET is_frozen = TRUE WHERE is_frozen = FALSE AND expires_at <= NOW()`);

    const activeRes = await client.query(
      `SELECT id, current_url as "currentUrl", display_name as "displayName", current_bid, expires_at as "expiresAt", created_at as "createdAt"
       FROM slots
       WHERE is_frozen = FALSE AND expires_at > NOW()
       ORDER BY ${ACTIVE_SLOT_ORDER_BY_SQL}
       LIMIT 2`
    );

    if (activeRes.rows && activeRes.rows.length > 0) {
      const row = activeRes.rows[0];
      if (activeRes.rows.length > 1) {
        logger.warn('Multiple active slots detected during active-tab lookup', {
          route: 'get-active-tab',
          activeCount: activeRes.rows.length,
          activeSlotId: row.id,
        });
      }
      const currentPaid = Number.parseFloat(row.current_bid || '0');
      const activeLikes = await getActiveLikeCount(client, String(row.id));
      const nextStealPrice = calculateStealPrice(currentPaid, new Date(), pricingSettings, activeLikes);

      const secondsOnStage = Math.floor((Date.now() - new Date(row.createdAt).getTime()) / 1000);
      const secondsLeftInLock = Math.max(0, (12 * 60) - secondsOnStage);

      return NextResponse.json({
        data: {
          ...row,
          current_bid: currentPaid.toFixed(2),
          stealPrice: nextStealPrice.toFixed(2),
          active_likes: activeLikes,
          crowdPercent: currentPaid > 0 ? getCrowdPercent(activeLikes) : 0,
          secondsOnStage,
          secondsLeftInLock,
          isLocked: secondsLeftInLock > 0,
        }
      });
    }

    return NextResponse.json({
      data: {
        id: 'house-default-id',
        currentUrl: HOUSE_DEFAULT_URL,
        displayName: 'The Only Tab HQ',
        current_bid: '0.00',
        stealPrice: getBasePrice(new Date(), pricingSettings).toFixed(2),
        secondsOnStage: 0,
        secondsLeftInLock: 0,
        isLocked: false,
        active_likes: 0,
        crowdPercent: 0,
      }
    });
  } catch (err: any) {
    const fallbackStealPrice = pricingSettings
      ? getBasePrice(new Date(), pricingSettings).toFixed(2)
      : getBasePrice(new Date()).toFixed(2);

    logger.error('GET /api/get-active-tab failed', {
      route: 'get-active-tab',
      error: err,
    });
    return NextResponse.json(
      {
        error: err?.message || 'Unable to load active tab',
        data: {
          id: 'house-default-id',
          currentUrl: HOUSE_DEFAULT_URL,
          displayName: 'The Only Tab HQ',
          current_bid: '0.00',
          stealPrice: fallbackStealPrice,
          secondsOnStage: 0,
          secondsLeftInLock: 0,
          isLocked: false,
        },
      },
      { status: 200 }
    );
  } finally {
    client.release();
  }
}
