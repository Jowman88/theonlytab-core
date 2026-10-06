import { NextResponse } from 'next/server';
import { logger } from './logger';

export function buildProtectedCheckoutResponse({
  clientIpBucket,
  activeSlotId,
  targetUrl,
  secondsLeft,
}: {
  clientIpBucket: string;
  activeSlotId: string;
  targetUrl: string;
  secondsLeft: number;
}) {
  logger.warn('Checkout session rejected during stage protection window', {
    route: 'create-checkout-session',
    clientIpBucket,
    activeSlotId,
    targetUrl,
    secondsLeft,
  });
  return NextResponse.json(
    { error: `Stage is protected for ${secondsLeft} more seconds.` },
    { status: 400 }
  );
}
