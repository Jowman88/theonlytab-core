import { createHash } from 'node:crypto';

export function clampInt(rawValue, defaultValue, min, max) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
}

export const getStreamFps = (raw) => clampInt(raw, 8, 1, 24);
export const getJpegQuality = (raw) => clampInt(raw, 40, 20, 80);
export const getStreamDimension = (raw, defaultValue) => clampInt(raw, defaultValue, 160, 3840);

export function hashFrame(buffer) {
  return createHash('md5').update(buffer).digest('hex');
}

export function hasFrameChanged(previousHash, nextHash) {
  return previousHash !== nextHash;
}
