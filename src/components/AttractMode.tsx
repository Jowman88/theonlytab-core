'use client';

import React, { useEffect, useState } from 'react';

interface HistoryItem {
  currentBid?: string;
  currentUrl?: string;
  displayName?: string;
}

interface AttractModeProps {
  history: HistoryItem[];
  stealPrice: string;
  onSeize: () => void;
}

const MAX_PROOF_ITEMS = 8;
const PROOF_INTERVAL_MS = 4000;

function formatUrl(url?: string) {
  return (url || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

export default function AttractMode({ history, stealPrice, onSeize }: AttractModeProps) {
  const [index, setIndex] = useState(0);
  const recent = history.slice(0, MAX_PROOF_ITEMS);
  const count = recent.length;

  useEffect(() => {
    if (count < 2) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), PROOF_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [count]);

  const item = count > 0 ? recent[index % count] : null;

  return (
    <div
      role="group"
      aria-label="Stage is open. Be the next to take it."
      className="absolute inset-0 overflow-hidden bg-[#040507]"
    >
      <div aria-hidden="true" className="attract-blob attract-blob-a" />
      <div aria-hidden="true" className="attract-blob attract-blob-b" />
      <div aria-hidden="true" className="attract-blob attract-blob-c" />
      <div aria-hidden="true" className="dashboard-grid absolute inset-0 opacity-25" />
      <div aria-hidden="true" className="attract-vignette absolute inset-0" />

      <div className="relative z-[1] flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center sm:gap-5">
        <div className="attract-ring flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/40 sm:h-16 sm:w-16">
          <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_6px_rgba(52,211,153,0.6)]" />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-emerald-200/80 sm:text-xs">Stage open</p>
        <h2 className="max-w-xl text-2xl font-black text-white sm:text-4xl">Put your site on the big screen</h2>
        <button
          type="button"
          onClick={onSeize}
          className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-6 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-400/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 sm:text-sm"
        >
          Take it for ${stealPrice}
        </button>
        {item && (
          <div aria-live="polite" className="flex h-12 max-w-full items-start justify-center overflow-hidden">
            <p key={index} className="attract-fade max-w-full truncate text-xs text-neutral-300 sm:text-sm">
              <strong className="font-semibold text-white">{item.displayName || 'Anonymous'}</strong> took the stage with {formatUrl(item.currentUrl)} for{' '}
              <strong className="font-semibold text-emerald-200">${item.currentBid}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
