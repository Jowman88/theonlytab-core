import { createHash, timingSafeEqual } from 'node:crypto';

export function isValidAdminSecret(expectedSecret: string | undefined, providedSecret: string | null): boolean {
  if (!expectedSecret || !providedSecret) return false;

  const expectedHash = createHash('sha256').update(expectedSecret).digest();
  const providedHash = createHash('sha256').update(providedSecret).digest();
  return timingSafeEqual(expectedHash, providedHash);
}
