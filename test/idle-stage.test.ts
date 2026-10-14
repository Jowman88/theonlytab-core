import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDuration, formatTimeAgo, getHeadline, getIdleLine, HEADLINES, IDLE_LINES, stripProtocol } from '../src/lib/idleStage';

test('getIdleLine wraps and interpolates price', () => {
  assert.equal(getIdleLine(0), getIdleLine(IDLE_LINES.length));
  const idx = IDLE_LINES.findIndex((l) => l.includes('${price}'));
  assert.match(getIdleLine(idx, '25.00'), /\$25\.00/);
  assert.equal(getIdleLine(-1).length > 0, true);
});

test('no line mentions 30 minutes and there are ~30 lines', () => {
  assert.ok(IDLE_LINES.length >= 28);
  assert.ok(IDLE_LINES.every((l) => !/30 min/i.test(l)));
});

test('formatTimeAgo', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  assert.equal(formatTimeAgo(null, now), null);
  assert.equal(formatTimeAgo('garbage', now), null);
  assert.equal(formatTimeAgo('2026-01-01T11:59:40Z', now), 'just now');
  assert.equal(formatTimeAgo('2026-01-01T11:30:00Z', now), '30m ago');
  assert.equal(formatTimeAgo('2026-01-01T09:00:00Z', now), '3h ago');
  assert.equal(formatTimeAgo('2025-12-30T12:00:00Z', now), '2d ago');
});

test('stripProtocol and formatDuration', () => {
  assert.equal(stripProtocol('https://example.com/'), 'example.com');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(90), '1h 30m');
  assert.equal(formatDuration(120), '2h');
});

test('getHeadline substitutes price, wraps and handles negatives', () => {
  assert.equal(getHeadline(0), 'Put your site on the big screen');
  assert.equal(getHeadline(HEADLINES.length), getHeadline(0));
  assert.equal(getHeadline(-1), getHeadline(HEADLINES.length - 1));
  assert.equal(getHeadline(3, '9.00'), 'Own the screen for $9.00');
  assert.ok(HEADLINES.every((_, i) => !getHeadline(i, '9.00').includes('${price}')));
});
