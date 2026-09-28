import { NextResponse } from 'next/server';
import { logger } from './logger';

export const LOCKED_CHECKOUT_ERROR_MESSAGE = 'FEED LOCKED: Protected for the first 12 minutes.';

export function buildLockedCheckoutResponse({
  clientIpBucket,
  activeSlotId,
  targetUrl,
}: {
  clientIpBucket: string;
  activeSlotId: string;
  targetUrl: string;
}) {
  logger.warn('Checkout session rejected during slot lock window', {
    route: 'create-checkout-session',
    clientIpBucket,
    activeSlotId,
    targetUrl,
  });
  return NextResponse.json({ error: LOCKED_CHECKOUT_ERROR_MESSAGE }, { status: 400 });
}
