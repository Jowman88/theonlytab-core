import assert from 'node:assert/strict';
import test from 'node:test';
import { getJpegQuality, getStreamDimension, getStreamFps, hasFrameChanged, hashFrame } from '../server/stream-utils.js';

test('getStreamFps defaults to 8 and clamps to 1..24', () => {
  assert.equal(getStreamFps(undefined), 8);
  assert.equal(getStreamFps('abc'), 8);
  assert.equal(getStreamFps('0'), 1);
  assert.equal(getStreamFps('100'), 24);
  assert.equal(getStreamFps('12'), 12);
});

test('getJpegQuality defaults to 40 and clamps to 20..80', () => {
  assert.equal(getJpegQuality(undefined), 40);
  assert.equal(getJpegQuality('5'), 20);
  assert.equal(getJpegQuality('99'), 80);
  assert.equal(getJpegQuality('55'), 55);
});

test('getStreamDimension uses default and clamps', () => {
  assert.equal(getStreamDimension(undefined, 1280), 1280);
  assert.equal(getStreamDimension('1', 1280), 160);
  assert.equal(getStreamDimension('960', 1280), 960);
});

test('frame change detection', () => {
  const a = hashFrame(Buffer.from('frame-a'));
  assert.equal(hasFrameChanged(null, a), true);
  assert.equal(hasFrameChanged(a, hashFrame(Buffer.from('frame-a'))), false);
  assert.equal(hasFrameChanged(a, hashFrame(Buffer.from('frame-b'))), true);
});

test('reaction validation and rate limiting', async () => {
  const { canSendReaction, isValidReaction } = await import('../server/stream-utils.js');
  assert.equal(isValidReaction('🔥'), true);
  assert.equal(isValidReaction('🍆'), false);
  assert.equal(isValidReaction('🖕'), false);
  assert.equal(isValidReaction('🤯'), true);
  assert.equal(isValidReaction('👨‍👩‍👧'), true);
  assert.equal(isValidReaction('👍🏽'), true);
  assert.equal(isValidReaction('🇳🇱'), true);
  assert.equal(isValidReaction('1️⃣'), true);
  assert.equal(isValidReaction('hi'), false);
  assert.equal(isValidReaction('a'), false);
  assert.equal(isValidReaction('🔥🔥'), false);
  assert.equal(isValidReaction('https://x.io'), false);
  assert.equal(isValidReaction(''), false);
  assert.equal(isValidReaction({}), false);
  assert.equal(canSendReaction(null, 1000), true);
  assert.equal(canSendReaction(1000, 1500), false);
  assert.equal(canSendReaction(1000, 2000), true);
});
