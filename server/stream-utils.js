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

export const REACTION_EMOJIS = ['🔥', '👏', '😂', '❤️', '🎉'];
export const REACTION_MIN_INTERVAL_MS = 1000;

export const REACTION_MAX_LENGTH = 10;
export const REACTION_BLOCKLIST = ['🖕', '🍆', '🖕🏻', '🖕🏼', '🖕🏽', '🖕🏾', '🖕🏿'];

const EMOJI_PATTERN = /^(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|(?:\p{Extended_Pictographic}|\p{Emoji_Modifier_Base}|\p{Emoji_Presentation})[\uFE0F\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]*(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})[\uFE0F\u{1F3FB}-\u{1F3FF}]*)*)$/u;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function getReactionRejection(emoji) {
  if (typeof emoji !== 'string' || emoji.length === 0) return 'not-a-string';
  if (emoji.length > REACTION_MAX_LENGTH) return 'too-long';
  if (REACTION_BLOCKLIST.includes(emoji)) return 'blocked';
  if ([...segmenter.segment(emoji)].length !== 1 || !EMOJI_PATTERN.test(emoji)) return 'not-single-emoji';
  return null;
}

export function isValidReaction(emoji) {
  return getReactionRejection(emoji) === null;
}

export function canSendReaction(lastSentAt, now, minIntervalMs = REACTION_MIN_INTERVAL_MS) {
  return !Number.isFinite(lastSentAt) || now - lastSentAt >= minIntervalMs;
}
