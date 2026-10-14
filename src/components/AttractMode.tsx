'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildProofItems, getHeadline, getPresenceDots, HEADLINE_ROTATION_MS, type ProofHallOfFame, type ProofHistoryItem } from '../lib/idleStage';

interface AttractModeProps {
  history: ProofHistoryItem[];
  stealPrice: string;
  reactionPulse?: number;
  viewerCount?: number | null;
  onSeize: () => void;
}

const PROOF_INTERVAL_MS = 4500;
const HEADLINE_FADE_MS = 450;
const HOF_CACHE_MS = 5 * 60 * 1000;

let hofCache: { data: ProofHallOfFame; fetchedAt: number } | null = null;

export default function AttractMode({ history, stealPrice, reactionPulse = 0, viewerCount = null, onSeize }: AttractModeProps) {
  const [index, setIndex] = useState(0);
  const [hallOfFame, setHallOfFame] = useState<ProofHallOfFame | null>(hofCache?.data ?? null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hofCache && Date.now() - hofCache.fetchedAt < HOF_CACHE_MS) return undefined;
    const controller = new AbortController();
    fetch('/api/hall-of-fame', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) {
          hofCache = { data, fetchedAt: Date.now() };
          setHallOfFame(data);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const proofItems = useMemo(() => buildProofItems(history, hallOfFame), [history, hallOfFame]);
  const count = proofItems.length;

  useEffect(() => {
    if (count < 2) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), PROOF_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [count]);

  const dots = getPresenceDots(viewerCount);

  const moveSpotlight = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = spotlightRef.current;
    if (!el) return;
    const rect = event.currentTarget.getBoundingClientRect();
    el.style.transform = `translate3d(${event.clientX - rect.left - 128}px, ${event.clientY - rect.top - 128}px, 0)`;
    el.style.opacity = '1';
  };
  const hideSpotlight = () => {
    if (spotlightRef.current) spotlightRef.current.style.opacity = '0';
  };

  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [headlineVisible, setHeadlineVisible] = useState(true);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    let swap: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      setHeadlineVisible(false);
      swap = setTimeout(() => {
        setHeadlineIndex((current) => current + 1);
        setHeadlineVisible(true);
      }, HEADLINE_FADE_MS);
    };
    const start = () => {
      if (interval === undefined) interval = setInterval(tick, HEADLINE_ROTATION_MS);
    };
    const stop = () => {
      if (interval !== undefined) clearInterval(interval);
      if (swap !== undefined) clearTimeout(swap);
      interval = undefined;
      swap = undefined;
      setHeadlineVisible(true);
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (interval !== undefined) clearInterval(interval);
      if (swap !== undefined) clearTimeout(swap);
    };
  }, []);

  const item = count > 0 ? proofItems[index % count] : null;

  return (
    <div
      role="group"
      aria-label="Stage is open. Be the next to take it."
      className="absolute inset-0 overflow-hidden bg-[#040507]"
      onPointerMove={moveSpotlight}
      onPointerLeave={hideSpotlight}
    >
      <div aria-hidden="true" className="attract-blob attract-blob-a" />
      <div aria-hidden="true" className="attract-blob attract-blob-b" />
      <div aria-hidden="true" className="attract-blob attract-blob-c" />
      <div aria-hidden="true" className="dashboard-grid absolute inset-0 opacity-25" />
      <div aria-hidden="true" ref={spotlightRef} className="attract-spotlight pointer-events-none absolute left-0 top-0 h-64 w-64 opacity-0" />
      {dots > 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {Array.from({ length: dots }, (_, i) => (
            <span
              key={i}
              className="attract-presence-dot absolute h-1.5 w-1.5 rounded-full bg-emerald-300"
              style={{ left: `${(i * 37 + 11) % 88 + 5}%`, top: `${(i * 53 + 7) % 78 + 10}%`, animationDelay: `${(i * 0.7) % 4}s` }}
            />
          ))}
        </div>
      )}
      {reactionPulse > 0 && (
        <div aria-hidden="true" key={reactionPulse} className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="attract-flare absolute inset-0" />
          <div className="attract-ripple absolute h-24 w-24 rounded-full border border-emerald-300/60" />
        </div>
      )}
      <div aria-hidden="true" className="attract-vignette absolute inset-0" />

      <div className="relative z-[1] flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center sm:gap-4 sm:px-6">
        <div className="attract-ring hidden h-14 w-14 items-center justify-center rounded-full border border-emerald-300/40 sm:flex sm:h-16 sm:w-16">
          <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_6px_rgba(52,211,153,0.6)]" />
        </div>
        <p className="hidden text-[10px] font-semibold uppercase tracking-[0.4em] text-emerald-200/80 sm:block sm:text-xs">Stage open</p>
        <div className="flex min-h-[3.5rem] max-w-xl items-center justify-center sm:min-h-[6.5rem]">
          <h2 className={`attract-headline text-lg font-black leading-tight text-white min-[400px]:text-xl sm:text-4xl${headlineVisible ? '' : ' attract-headline-out'}`}>
            {getHeadline(headlineIndex, stealPrice)}
          </h2>
        </div>
        <button
          type="button"
          onClick={onSeize}
          className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-400/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 sm:px-6 sm:py-2.5 sm:text-sm sm:tracking-[0.2em]"
        >
          Take it for ${stealPrice}
        </button>
        {item && (
          <div aria-live="polite" className="flex h-11 w-full max-w-sm items-start justify-center overflow-hidden sm:h-16">
            <div
              key={item.key}
              className="attract-fade flex max-w-full min-w-0 flex-col items-center rounded-xl border border-white/10 bg-black/40 px-3 py-1 sm:px-4 sm:py-2"
            >
              <span className="text-[9px] font-semibold uppercase tracking-[0.25em] text-emerald-200/80 sm:text-[10px]">{item.label}</span>
              <p className="max-w-full truncate text-[11px] text-neutral-300 sm:text-sm">
                <strong className="font-semibold text-white">{item.headline}</strong>{' '}
                <strong className="font-semibold text-emerald-200">{item.detail}</strong>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
