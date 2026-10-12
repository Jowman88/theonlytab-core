'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_STEAL_PRICE,
  formatDuration,
  formatTimeAgo,
  getIdleLine,
  LINE_ROTATION_MS,
  stripProtocol,
} from '../../lib/idleStage';
import { PROTECTION_WINDOW_SECONDS, TAKEOVER_DURATION_MINUTES } from '../../lib/takeoverConstants';

const POLL_MS = 12000;
const FADE_MS = 400;

interface LastTakeover {
  displayName: string;
  url: string;
  bid: string;
  createdAt: string | null;
}

// All sizes scale with the smaller viewport dimension (vmin) so the page stays
// legible once the stream canvas is scaled to fit the dashboard.
const card = {
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(255,255,255,0.03) 60%)',
  borderRadius: '1.2vmin',
  padding: 'clamp(0.75rem, 2vmin, 1.5rem) clamp(1rem, 2.6vmin, 2rem)',
  textAlign: 'left' as const,
  minWidth: 0,
};
const priceCard = {
  ...card,
  border: '1px solid rgba(110,231,183,0.6)',
  background: 'linear-gradient(135deg, rgba(16,185,129,0.20) 0%, rgba(255,255,255,0.04) 70%)',
};
const label = {
  color: '#a7f3d0',
  fontSize: 'clamp(0.75rem, 1.9vmin, 1.15rem)',
  letterSpacing: '0.18em',
  fontWeight: 700,
};
const cardValue = {
  fontSize: 'clamp(1rem, 2.7vmin, 1.7rem)',
  fontWeight: 700,
  color: '#f5f5f5',
  overflowWrap: 'anywhere' as const,
  marginTop: '0.4vmin',
};

// Subtle, cheap-to-encode liveness cue: only opacity changes on a tiny element.
const PULSE_CSS = `
@keyframes idle-live-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.idle-live-dot { animation: idle-live-pulse 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .idle-live-dot { animation: none; } }
`;

const pad2 = (n: number) => String(n).padStart(2, '0');
const formatClock = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
};

export default function HouseDefaultPage() {
  const [price, setPrice] = useState(DEFAULT_STEAL_PRICE);
  const [last, setLast] = useState<LastTakeover | null>(null);
  const [reign, setReign] = useState<{ name: string; minutes: number } | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [tab, ticker, hof] = await Promise.allSettled([
        fetch('/api/get-active-tab', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())),
        fetch('/api/get-ticker-history', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())),
        fetch('/api/hall-of-fame').then((r) => (r.ok ? r.json() : Promise.reject())),
      ]);
      if (cancelled) return;
      if (tab.status === 'fulfilled') {
        const sp = Number.parseFloat(tab.value?.data?.stealPrice);
        if (Number.isFinite(sp) && sp > 0) setPrice(sp.toFixed(2));
      }
      if (ticker.status === 'fulfilled') {
        const item = ticker.value?.history?.[0];
        if (item && typeof item.currentUrl === 'string') {
          const bid = Number.parseFloat(item.currentBid);
          setLast({
            displayName: String(item.displayName || 'Anonymous'),
            url: stripProtocol(item.currentUrl),
            bid: Number.isFinite(bid) ? bid.toFixed(2) : '',
            createdAt: item.createdAt || item.created_at || null,
          });
        }
      }
      if (hof.status === 'fulfilled' && hof.value?.longestReign) {
        const r = hof.value.longestReign;
        if (Number.isFinite(Number(r.durationMinutes))) {
          setReign({ name: String(r.displayName || 'Anonymous'), minutes: Number(r.durationMinutes) });
        }
      }
      setNow(Date.now());
    };
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // 1s tick drives the idle clock and keeps "time ago" fresh.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let swap: number | undefined;
    const id = window.setInterval(() => {
      setVisible(false);
      swap = window.setTimeout(() => {
        setLineIndex((i) => i + 1);
        setVisible(true);
      }, FADE_MS);
    }, LINE_ROTATION_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(swap);
    };
  }, []);

  const ago = last ? formatTimeAgo(last.createdAt, now) : null;

  // Real idle time: the last takeover's start plus the fixed takeover duration.
  // Hidden when unknown (no history) or not yet elapsed, so it never shows a fake number.
  // Approximate if a stage was ended early by reports or an admin revert.
  const lastStart = last?.createdAt ? new Date(last.createdAt).getTime() : NaN;
  const idleSeconds = Number.isFinite(lastStart)
    ? (now - (lastStart + TAKEOVER_DURATION_MINUTES * 60 * 1000)) / 1000
    : NaN;
  const showIdleClock = Number.isFinite(idleSeconds) && idleSeconds > 0;

  const steps = [
    ['1', 'PICK A URL', 'Drop your link, your stream, your brand'],
    ['2', 'PAY', `Lock in your price ($${price}), beat the clock`],
    ['3', "YOU'RE LIVE", `${TAKEOVER_DURATION_MINUTES} minutes on the biggest stage, protected for the first ${PROTECTION_WINDOW_SECONDS}s`],
  ];

  return (
    <main
      style={{
        minHeight: '100vh',
        boxSizing: 'border-box',
        padding: '2.5vmin',
        display: 'grid',
        placeItems: 'center',
        background: '#060608',
        color: '#e5e5e5',
        fontFamily: 'monospace',
        textAlign: 'center',
      }}
    >
      <style>{PULSE_CSS}</style>
      <section
        style={{
          width: '100%',
          maxWidth: 'min(96vw, 90rem)',
          display: 'grid',
          gap: 'clamp(1rem, 3.4vmin, 2.6rem)',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '1.4vmin',
              marginBottom: '1.2vmin',
              padding: '0.6vmin 1.8vmin',
              border: '1px solid rgba(110,231,183,0.6)',
              boxShadow: '0 0 1.6vmin rgba(110,231,183,0.25)',
              borderRadius: '999px',
              background: 'rgba(16,185,129,0.08)',
              color: '#6ee7b7',
              fontSize: 'clamp(0.75rem, 1.9vmin, 1.15rem)',
              fontWeight: 800,
              letterSpacing: '0.22em',
            }}
          >
            <span
              className="idle-live-dot"
              style={{
                width: '1.3vmin',
                height: '1.3vmin',
                minWidth: '0.55rem',
                minHeight: '0.55rem',
                borderRadius: '999px',
                background: '#f43f5e',
                display: 'inline-block',
              }}
            />
            LIVE · STAGE OPEN
          </div>
          <div style={{ fontSize: 'clamp(2rem, 8vmin, 5.5rem)', fontWeight: 900, letterSpacing: '0.2em', color: '#ffffff' }}>
            THE ONLY TAB
          </div>
          <div style={{ marginTop: '1vmin', color: '#f3f4f6', fontWeight: 700, fontSize: 'clamp(1.05rem, 3.2vmin, 2.1rem)' }}>
            Your URL. Live. Right now. Steal the feed for {TAKEOVER_DURATION_MINUTES} minutes.
          </div>
          {showIdleClock && (
            <div
              style={{
                marginTop: '1.2vmin',
                color: '#fcd34d',
                fontSize: 'clamp(1rem, 2.8vmin, 1.8rem)',
                letterSpacing: '0.16em',
                fontWeight: 700,
              }}
            >
              STAGE EMPTY FOR <span style={{ color: '#fbbf24', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{formatClock(idleSeconds)}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))', gap: 'clamp(0.6rem, 1.8vmin, 1.5rem)' }}>
          <div style={priceCard}>
            <div style={label}>NEXT STEAL PRICE</div>
            <div style={{ color: '#6ee7b7', fontSize: 'clamp(1.75rem, 6vmin, 4rem)', fontWeight: 800, lineHeight: 1.1 }}>
              ${price}
            </div>
          </div>
          <div style={card}>
            <div style={label}>LATEST TAKEOVER</div>
            <div style={cardValue}>
              {last ? `${last.displayName} · ${last.url}${last.bid ? ` · $${last.bid}` : ''}${ago ? ` · ${ago}` : ''}` : 'Nobody yet'}
            </div>
          </div>
          {reign && (
            <div style={card}>
              <div style={label}>LONGEST REIGN</div>
              <div style={cardValue}>
                {reign.name} · {formatDuration(reign.minutes)}
              </div>
            </div>
          )}
        </div>

        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
            gap: 'clamp(0.6rem, 1.8vmin, 1.5rem)',
          }}
        >
          {steps.map(([n, title, sub]) => (
            <li key={n} style={card}>
              <div style={{ color: '#6ee7b7', fontWeight: 800, letterSpacing: '0.12em', fontSize: 'clamp(1rem, 2.7vmin, 1.7rem)' }}>
                {n}. {title}
              </div>
              <div style={{ color: '#d1d5db', fontSize: 'clamp(0.85rem, 2.1vmin, 1.3rem)', marginTop: '0.6vmin' }}>{sub}</div>
            </li>
          ))}
        </ol>

        <div
          aria-live="off"
          style={{
            minHeight: '4rem',
            display: 'grid',
            placeItems: 'center',
            fontSize: 'clamp(1.1rem, 3.5vmin, 2.2rem)',
            fontStyle: 'italic',
            color: '#ffffff',
            opacity: visible ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
          }}
        >
          “{getIdleLine(lineIndex, price)}”
        </div>

        <div style={{ color: '#6ee7b7', fontSize: 'clamp(0.9rem, 2.3vmin, 1.4rem)', letterSpacing: '0.18em', fontWeight: 800 }}>
          ▼ CLAIM YOUR MOMENT · HIT STEAL STAGE ▼
        </div>
      </section>
    </main>
  );
}
