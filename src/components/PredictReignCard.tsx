'use client';

import React, { useEffect, useRef, useState } from 'react';

interface LeaderboardEntry {
  nickname: string;
  points: number;
  wins: number;
  streak: number;
  oracle: boolean;
}

interface ReignResult {
  reignLabel: string;
  winnerNickname: string | null;
  hasWinner: boolean;
}

interface PredictReignCardProps {
  slotId?: string;
  secondsLeftToPredict?: number;
  totalPredictions?: number;
}

const MAX_MINUTES = 90;
const HOUSE_ID = 'house-default-id';

export default function PredictReignCard({ slotId, secondsLeftToPredict = 0, totalPredictions = 0 }: PredictReignCardProps) {
  const isRealSlot = Boolean(slotId) && slotId !== HOUSE_ID;
  const [guess, setGuess] = useState(30);
  const [nickname, setNickname] = useState('');
  const [myGuess, setMyGuess] = useState<number | null>(null);
  const [total, setTotal] = useState(totalPredictions);
  const [secondsLeft, setSecondsLeft] = useState(secondsLeftToPredict);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReignResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const previousSlotIdRef = useRef<string | undefined>(undefined);
  const deadlineRef = useRef<number>(0);

  useEffect(() => {
    deadlineRef.current = Date.now() + secondsLeftToPredict * 1000;
    setSecondsLeft(secondsLeftToPredict);
  }, [secondsLeftToPredict, slotId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setTotal(totalPredictions);
  }, [totalPredictions]);

  useEffect(() => {
    setMyGuess(null);
    setError('');
    if (!isRealSlot) return;
    let cancelled = false;
    fetch(`/api/predictions?slotId=${encodeURIComponent(String(slotId))}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (typeof data.myGuess === 'number') setMyGuess(data.myGuess);
        if (typeof data.totalPredictions === 'number') setTotal(data.totalPredictions);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [slotId, isRealSlot]);

  useEffect(() => {
    const previous = previousSlotIdRef.current;
    previousSlotIdRef.current = slotId;
    if (!previous || previous === HOUSE_ID || previous === slotId) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const load = async (attempt: number) => {
      try {
        const res = await fetch(`/api/predictions?slotId=${encodeURIComponent(previous)}`);
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (data?.result) {
          setResult(data.result);
          timers.push(setTimeout(() => setResult(null), 10000));
          return;
        }
      } catch {
        // retry below
      }
      if (attempt < 2 && !cancelled) timers.push(setTimeout(() => load(attempt + 1), 2000));
    };
    load(0);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [slotId]);

  useEffect(() => {
    let cancelled = false;
    const loadBoard = () =>
      fetch('/api/prediction-leaderboard')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && Array.isArray(data?.leaderboard)) setLeaderboard(data.leaderboard);
        })
        .catch(() => undefined);
    loadBoard();
    const interval = setInterval(loadBoard, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isOpen = isRealSlot && secondsLeft > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOpen || myGuess !== null || isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, guessMinutes: guess, nickname: nickname.trim() || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setMyGuess(guess);
        if (typeof data.totalPredictions === 'number') setTotal(data.totalPredictions);
      } else if (response.status === 409) {
        const mine = await fetch(`/api/predictions?slotId=${encodeURIComponent(String(slotId))}`).then((r) => r.json()).catch(() => ({}));
        setMyGuess(typeof mine.myGuess === 'number' ? mine.myGuess : guess);
      } else {
        setError(data.error || 'Unable to submit your prediction.');
      }
    } catch {
      setError('Unable to submit your prediction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <div className="min-w-0 w-full shrink-0 rounded-2xl border border-violet-300/20 bg-violet-500/[0.06] px-4 py-3 text-sm ring-1 ring-white/5">
      {result && (
        <div role="status" className="mb-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-100">
          Reign lasted {result.reignLabel}. {result.hasWinner ? `Winner: ${result.winnerNickname || 'Anonymous'}` : 'No winner this round.'}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">Predict the reign</p>
        <p className="text-[11px] text-neutral-400">Free to play · points &amp; badges only</p>
      </div>

      {!isRealSlot ? (
        <p className="mt-2 text-neutral-400">Predictions open when a new reign starts.</p>
      ) : myGuess !== null ? (
        <p className="mt-2 text-white">
          Your guess: <span className="font-bold">{myGuess} min</span>
          <span className="ml-2 text-neutral-400">
            {isOpen ? `${total} players locked in · ${clock} left to predict` : `${total} players locked in`}
          </span>
        </p>
      ) : isOpen ? (
        <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-center gap-3">
          <label className="flex min-w-[10rem] flex-1 items-center gap-2 text-neutral-300">
            <span className="sr-only">Minutes until this stage is taken or expires</span>
            <input
              type="range"
              min={1}
              max={MAX_MINUTES}
              value={guess}
              onChange={(e) => setGuess(Number(e.target.value))}
              className="min-w-0 flex-1 accent-violet-400"
            />
            <input
              type="number"
              min={1}
              max={MAX_MINUTES}
              value={guess}
              onChange={(e) => setGuess(Math.min(MAX_MINUTES, Math.max(1, Math.round(Number(e.target.value) || 1))))}
              aria-label="Predicted minutes"
              className="w-16 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-white"
            />
            <span>min</span>
          </label>
          <input
            type="text"
            maxLength={24}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Nickname (optional)"
            aria-label="Nickname (optional)"
            className="w-40 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-white placeholder:text-neutral-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl border border-violet-300/40 bg-violet-500/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-violet-100 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Locking in…' : 'Submit'}
          </button>
          <p className="w-full text-xs text-neutral-400">
            Closes in {clock} · {total} {total === 1 ? 'prediction' : 'predictions'} so far
          </p>
          {error && <p role="alert" className="w-full text-xs text-rose-300">{error}</p>}
        </form>
      ) : (
        <p className="mt-2 text-neutral-300">Predictions closed, {total} {total === 1 ? 'player' : 'players'} locked in</p>
      )}

      {leaderboard.length > 0 && (
        <ol className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-300">
          {leaderboard.slice(0, 5).map((entry, idx) => (
            <li key={`${entry.nickname}-${idx}`} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
              {idx + 1}. {entry.nickname}
              {entry.oracle && <span className="ml-1 rounded bg-amber-400/20 px-1 font-semibold text-amber-200">Oracle</span>}
              <span className="ml-1 text-neutral-400">{entry.points} pts{entry.streak > 1 ? ` · ${entry.streak} streak` : ''}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
