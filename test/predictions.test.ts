import assert from 'node:assert/strict';
import test from 'node:test';
import { formatReignLength, parseGuessMinutes, pickWinner, sanitizeNickname } from '../src/lib/predictions';

const entry = (id: string, guessMinutes: number, createdAt: string) => ({
  id,
  voterHash: id,
  guessMinutes,
  nickname: null,
  createdAt,
});

test('parseGuessMinutes accepts only integers 1..90', () => {
  assert.equal(parseGuessMinutes(1), 1);
  assert.equal(parseGuessMinutes(90), 90);
  assert.equal(parseGuessMinutes(0), null);
  assert.equal(parseGuessMinutes(91), null);
  assert.equal(parseGuessMinutes(4.5), null);
  assert.equal(parseGuessMinutes('5'), null);
});

test('sanitizeNickname trims, strips urls/profanity and caps length', () => {
  assert.equal(sanitizeNickname('  Bob  '), 'Bob');
  assert.equal(sanitizeNickname('visit https://spam.com now'), 'visit now');
  assert.equal(sanitizeNickname('fuck'), null);
  assert.equal(sanitizeNickname('x'.repeat(40))?.length, 24);
  assert.equal(sanitizeNickname(42), null);
});

test('pickWinner chooses closest guess and breaks ties by earliest', () => {
  const entries = [
    entry('a', 10, '2026-01-01T00:00:03Z'),
    entry('b', 14, '2026-01-01T00:00:02Z'),
    entry('c', 14, '2026-01-01T00:00:01Z'),
  ];
  assert.equal(pickWinner(entries, 12)?.id, 'c');
  assert.equal(pickWinner(entries, 11)?.id, 'a');
  assert.equal(pickWinner([], 5), null);
});

test('formatReignLength renders minutes and seconds', () => {
  assert.equal(formatReignLength(7.2), '7m 12s');
});
