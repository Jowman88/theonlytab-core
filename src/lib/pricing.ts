export const DEFAULT_BASE_PRICE = 19;
export const DEFAULT_STEAL_FLAT_INCREASE = 10;
export const DEFAULT_STEAL_MULTIPLIER = 1.25;

export const PRIME_BLOCK_WINDOWS = [
  { startHour: 9, endHour: 11 },
  { startHour: 18, endHour: 20 },
] as const;

export function getBasePrice(now = new Date()): number {
  const hour = now.getHours();
  const isPrimeBlock = PRIME_BLOCK_WINDOWS.some(({ startHour, endHour }) => {
    return hour >= startHour && hour < endHour;
  });

  return isPrimeBlock ? 149 : DEFAULT_BASE_PRICE;
}

export function calculateStealPrice(currentBid: number | string = 0, now = new Date()): number {
  const numericBid = Number(currentBid || 0);
  const basePrice = getBasePrice(now);

  const stealPrice = Math.max(
    numericBid * DEFAULT_STEAL_MULTIPLIER,
    numericBid + DEFAULT_STEAL_FLAT_INCREASE,
    basePrice
  );

  return Number(stealPrice.toFixed(2));
}

export function getPrimeBlockStatus(now = new Date()): { active: boolean; basePrice: number } {
  const basePrice = getBasePrice(now);
  const hour = now.getHours();
  const active = PRIME_BLOCK_WINDOWS.some(({ startHour, endHour }) => hour >= startHour && hour < endHour);

  return { active, basePrice };
}
