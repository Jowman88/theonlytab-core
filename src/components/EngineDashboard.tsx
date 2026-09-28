'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { io } from 'socket.io-client';

interface SlotData {
  id: string;
  currentUrl?: string;
  displayName?: string;
  current_bid?: string;
  stealPrice?: string;
  secondsOnStage?: number;
  secondsLeftInLock?: number;
}

interface HistoryItem {
  currentBid?: string;
  currentUrl?: string;
  displayName?: string;
}

type SocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
type FieldName = 'targetUrl' | 'displayName' | 'overlayLabel' | 'startPath';
type Notice = { type: 'success' | 'error'; message: string } | null;

const FIELD_LABELS: Record<FieldName, string> = {
  targetUrl: 'Target Website URL',
  displayName: 'Display Name',
  overlayLabel: 'Overlay Label',
  startPath: 'Start Path / Hash',
};

const initialTouchedState: Record<FieldName, boolean> = {
  targetUrl: false,
  displayName: false,
  overlayLabel: false,
  startPath: false,
};

const stripProtocol = (value?: string) => value?.replace(/^https?:\/\//, '') || '';

const isValidTargetUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    return Boolean(new URL(normalized).hostname);
  } catch {
    return false;
  }
};

export default function EngineDashboard({ streamServerUrl }: { streamServerUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [slot, setSlot] = useState<SlotData | null>(null);
  const [lockTimer, setLockTimer] = useState<number>(0);
  const [stageTimer, setStageTimer] = useState<number>(0);
  const [hasFrames, setHasFrames] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEmbedOpen, setIsEmbedOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [overlayLabel, setOverlayLabel] = useState('');
  const [startPath, setStartPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [legalAgreed, setLegalAgreed] = useState(false);
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('connecting');
  const [formError, setFormError] = useState('');
  const [touchedFields, setTouchedFields] = useState<Record<FieldName, boolean>>(initialTouchedState);
  const [statusNotice, setStatusNotice] = useState<Notice>(null);
  const [copyFeedback, setCopyFeedback] = useState('Copy code');

  const normalizedTargetUrl = targetUrl.trim().startsWith('http') ? targetUrl.trim() : `https://${targetUrl.trim()}`;
  const validatedFields = {
    targetUrl: isValidTargetUrl(targetUrl),
    displayName: displayName.trim().length === 0 || displayName.trim().length >= 2,
    overlayLabel: overlayLabel.length <= 15,
    startPath: !startPath.trim() || /^[/?#]/.test(startPath.trim()),
  };
  const historyTickerItems = useMemo(() => (historyList.length > 0 ? [...historyList, ...historyList] : []), [historyList]);
  const isLocked = lockTimer > 0;
  const stealPrice = slot?.stealPrice || '19.00';
  const canStartCheckout = validatedFields.targetUrl && legalAgreed && !isLocked && !isSubmitting;
  const embedCode = '<iframe src="https://theonlytab.io" width="100%" height="140" style="border:none;background:transparent;" scrolling="no"></iframe>';

  useEffect(() => {
    const socket = io(streamServerUrl || 'https://theonlytab-server.onrender.com', {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],
      secure: true,
      rejectUnauthorized: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    setSocketStatus('connecting');

    socket.on('connect', () => {
      setSocketStatus('connected');
      console.log('Connected to stream server');
    });

    socket.io.on('reconnect_attempt', () => {
      setSocketStatus('reconnecting');
    });

    socket.io.on('reconnect', () => {
      setSocketStatus('connected');
    });

    socket.on('v-frame', (frameData: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasFrames(true);
      };
      img.onerror = () => {
        console.error('Failed to decode incoming stream frame');
      };
      img.src = `data:image/jpeg;base64,${frameData}`;
    });

    socket.on('connect_error', (error) => {
      setSocketStatus('reconnecting');
      console.error('Connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      const isClientDisconnect = reason === 'io client disconnect';
      setSocketStatus(isClientDisconnect ? 'disconnected' : 'reconnecting');
      setHasFrames(false);
      console.log('Disconnected from stream server');
    });

    return () => {
      socket.disconnect();
    };
  }, [streamServerUrl]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment') === 'success' || urlParams.get('showEmbed') === 'true') {
        setIsEmbedOpen(true);
      }
    }

    const fetchState = async () => {
      try {
        const res = await fetch('/api/get-active-tab');
        if (res.ok) {
          const payload = await res.json();
          if (payload?.data) {
            setSlot(payload.data);
            setLockTimer(Number(payload.data.secondsLeftInLock) || 0);
            setStageTimer(Number.parseFloat(payload.data.current_bid || '0') <= 0 ? 0 : Number(payload.data.secondsOnStage) || 0);
          }
        }
        const historyResponse = await fetch('/api/get-ticker-history');
        if (historyResponse.ok) {
          const historyPayload = await historyResponse.json();
          setHistoryList(historyPayload.history || []);
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setLockTimer((prev) => Math.max(0, prev - 1));
      setStageTimer((prev) => {
        const currentBid = Number.parseFloat(slot?.current_bid || '0');
        if (Number.isNaN(currentBid)) {
          return 0;
        }
        return currentBid > 0 ? prev + 1 : 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [slot]);

  useEffect(() => {
    if (!statusNotice) return undefined;

    const timeout = window.setTimeout(() => setStatusNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [statusNotice]);

  const formatClock = (seconds: number) => {
    if (!seconds || seconds <= 0) return '00:00';
    return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const setFieldTouched = (field: FieldName) => {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  };

  const resetFormFeedback = () => {
    setFormError('');
    setStatusNotice(null);
  };

  const validateFormBeforeCheckout = () => {
    const nextTouchedState = Object.keys(initialTouchedState).reduce((acc, key) => {
      acc[key as FieldName] = true;
      return acc;
    }, {} as Record<FieldName, boolean>);
    setTouchedFields(nextTouchedState);

    if (!validatedFields.targetUrl) {
      setFormError('Enter a valid website URL to launch checkout.');
      return false;
    }

    if (!validatedFields.startPath) {
      setFormError('Start path must begin with /, ?, or # when provided.');
      return false;
    }

    if (!validatedFields.displayName) {
      setFormError('Display name must be at least 2 characters or left blank.');
      return false;
    }

    if (!legalAgreed) {
      setFormError('You must accept the takeover rules before continuing.');
      return false;
    }

    if (isLocked) {
      setFormError('The feed is currently locked. Wait for the lock timer to expire before trying again.');
      return false;
    }

    setFormError('');
    return true;
  };

  const handleAcquireTabSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFormBeforeCheckout()) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmCheckout = async () => {
    setIsSubmitting(true);
    setFormError('');

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName || 'Anonymous Takeover',
          targetUrl: normalizedTargetUrl,
          overlayLabel,
          startPath,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Checkout could not be opened. Please review the details and try again.');
        setStatusNotice({ type: 'error', message: data.error || 'Checkout could not be opened.' });
        setIsSubmitting(false);
        setIsConfirmOpen(false);
        return;
      }

      if (data.url) {
        setStatusNotice({ type: 'success', message: 'Checkout initiated. Redirecting you to secure payment…' });
        setIsConfirmOpen(false);
        window.setTimeout(() => {
          window.location.href = data.url;
        }, 250);
        return;
      }

      setFormError('Checkout session returned no redirect URL. Please try again.');
      setStatusNotice({ type: 'error', message: 'Checkout session returned no redirect URL.' });
      setIsSubmitting(false);
    } catch {
      setFormError('Unable to reach checkout right now. Please try again in a moment.');
      setStatusNotice({ type: 'error', message: 'Unable to reach checkout right now.' });
      setIsSubmitting(false);
    }
  };

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopyFeedback('Copied!');
      window.setTimeout(() => setCopyFeedback('Copy code'), 1800);
    } catch {
      setCopyFeedback('Select text to copy');
      window.setTimeout(() => setCopyFeedback('Copy code'), 1800);
    }
  };

  const getFieldIndicator = (field: FieldName) => {
    if (!touchedFields[field]) return null;
    return validatedFields[field] ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-rose-400" aria-hidden="true" />
    );
  };

  const getFieldClassName = (field: FieldName) => {
    const isTouched = touchedFields[field];
    const isValid = validatedFields[field];

    if (!isTouched) {
      return 'border-white/10 bg-black/40 hover:border-white/20 focus:border-emerald-400/70 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12),0_0_30px_rgba(16,185,129,0.18)]';
    }

    return isValid
      ? 'border-emerald-400/60 bg-emerald-500/5 focus:border-emerald-300 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12),0_0_30px_rgba(16,185,129,0.18)]'
      : 'border-rose-400/60 bg-rose-500/5 focus:border-rose-300 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.12),0_0_30px_rgba(244,63,94,0.18)]';
  };

  const connectionStatusMeta = {
    connecting: {
      accent: 'bg-sky-400',
      badge: 'text-sky-200 border-sky-400/30 bg-sky-500/10',
      label: 'Connecting',
      Icon: Wifi,
    },
    connected: {
      accent: 'bg-emerald-400',
      badge: 'text-emerald-200 border-emerald-400/30 bg-emerald-500/10',
      label: 'Connected',
      Icon: Wifi,
    },
    reconnecting: {
      accent: 'bg-amber-400',
      badge: 'text-amber-200 border-amber-400/30 bg-amber-500/10',
      label: 'Reconnecting',
      Icon: Wifi,
    },
    disconnected: {
      accent: 'bg-rose-400',
      badge: 'text-rose-200 border-rose-400/30 bg-rose-500/10',
      label: 'Disconnected',
      Icon: WifiOff,
    },
  }[socketStatus];

  const ConnectionIcon = connectionStatusMeta.Icon;

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_30%),radial-gradient(circle_at_right,_rgba(251,191,36,0.08),_transparent_28%),linear-gradient(180deg,_#08090d_0%,_#050507_100%)] px-3 py-3 text-neutral-100 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="dashboard-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

      {statusNotice && (
        <div
          className={`dashboard-fade-in absolute right-3 top-3 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl sm:right-4 sm:top-4 ${
            statusNotice.type === 'success'
              ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-50 shadow-emerald-950/40'
              : 'border-rose-400/30 bg-rose-500/12 text-rose-50 shadow-rose-950/40'
          }`}
          role="status"
          aria-live="polite"
        >
          {statusNotice.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{statusNotice.message}</span>
        </div>
      )}

      {isFormOpen && (
        <button
          type="button"
          className="dashboard-fade-in absolute inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
          aria-label="Close config drawer"
          onClick={() => setIsFormOpen(false)}
        />
      )}

      <div className="relative z-10 flex h-full flex-col gap-4 lg:gap-5">
        <header className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,_rgba(18,22,29,0.95),_rgba(9,11,16,0.92))] px-4 py-4 shadow-[0_25px_80px_rgba(0,0,0,0.35)] ring-1 ring-white/5 sm:px-5 sm:py-5 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-300/85">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Live takeover control room
                </span>
                <span className="text-white/40">THE ONLY TAB</span>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Own the stage with better visibility and faster feedback.</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300 sm:text-base">
                  Monitor the live stream, confirm your takeover details, and launch a secure checkout without losing sight of the board.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div
                className={`inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-sm font-semibold ${connectionStatusMeta.badge}`}
                aria-label={`Stream connection status: ${connectionStatusMeta.label}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${connectionStatusMeta.accent} ${socketStatus !== 'disconnected' ? 'animate-pulse' : ''}`} />
                <ConnectionIcon className="h-4 w-4" />
                {connectionStatusMeta.label}
              </div>

              <button
                type="button"
                onClick={() => setIsFormOpen((current) => !current)}
                className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-[linear-gradient(135deg,_rgba(52,211,153,0.95),_rgba(6,182,212,0.88))] px-5 py-3 text-sm font-black uppercase tracking-[0.22em] text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080c] sm:px-6 sm:py-3.5 sm:text-base"
              >
                <Zap className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                STEAL STAGE
              </button>
            </div>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 gap-4 lg:gap-5">
          {isFormOpen && (
            <aside className="dashboard-slide-up fixed inset-x-3 bottom-3 top-24 z-40 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,_rgba(13,16,22,0.98),_rgba(7,9,13,0.98))] shadow-[0_30px_120px_rgba(0,0,0,0.55)] ring-1 ring-white/5 lg:static lg:inset-auto lg:z-10 lg:w-[25rem] lg:shrink-0">
              <form onSubmit={handleAcquireTabSubmit} className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">Config drawer</p>
                    <h2 className="mt-1 text-lg font-bold text-white">Prepare your takeover</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    Close
                  </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 p-4 text-sm leading-6 text-amber-100/90">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                      <div>
                        <p className="font-semibold text-amber-100">Double-check your destination before checkout.</p>
                        <p className="mt-1 text-amber-100/70">We will use these exact settings when your session opens, so review the URL, label, and start path carefully.</p>
                      </div>
                    </div>
                  </div>

                  {formError && (
                    <div className="dashboard-fade-in rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100" role="alert">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                        <span>{formError}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="target-url-input" className="text-sm font-semibold text-neutral-100">
                          {FIELD_LABELS.targetUrl} <span className="text-rose-300">*</span>
                        </label>
                        {getFieldIndicator('targetUrl')}
                      </div>
                      <p id="target-url-help" className="text-xs leading-5 text-neutral-400">
                        Paste the destination you want to control. If you omit the protocol, we will safely prefix it with https://.
                      </p>
                      <input
                        id="target-url-input"
                        type="text"
                        required
                        placeholder="example.com/live-demo"
                        value={targetUrl}
                        onBlur={() => setFieldTouched('targetUrl')}
                        onChange={(e) => {
                          resetFormFeedback();
                          setTargetUrl(e.target.value);
                        }}
                        aria-describedby="target-url-help"
                        aria-invalid={touchedFields.targetUrl && !validatedFields.targetUrl}
                        className={`w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none transition duration-200 placeholder:text-neutral-500 ${getFieldClassName('targetUrl')}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="display-name-input" className="text-sm font-semibold text-neutral-100">{FIELD_LABELS.displayName}</label>
                        {getFieldIndicator('displayName')}
                      </div>
                      <p id="display-name-help" className="text-xs leading-5 text-neutral-400">
                        Optional public name shown while your tab is on stage. Leave blank to appear as Anonymous Takeover.
                      </p>
                      <input
                        id="display-name-input"
                        type="text"
                        placeholder="Midnight Launch Team"
                        value={displayName}
                        onBlur={() => setFieldTouched('displayName')}
                        onChange={(e) => {
                          resetFormFeedback();
                          setDisplayName(e.target.value);
                        }}
                        aria-describedby="display-name-help"
                        aria-invalid={touchedFields.displayName && !validatedFields.displayName}
                        className={`w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none transition duration-200 placeholder:text-neutral-500 ${getFieldClassName('displayName')}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="overlay-label-input" className="text-sm font-semibold text-neutral-100">{FIELD_LABELS.overlayLabel}</label>
                        <div className="flex items-center gap-3 text-xs text-neutral-400">
                          <span>{overlayLabel.length}/15 chars</span>
                          {getFieldIndicator('overlayLabel')}
                        </div>
                      </div>
                      <p id="overlay-label-help" className="text-xs leading-5 text-neutral-400">
                        Short label shown on the stream overlay. Keep it punchy so it stays readable on mobile.
                      </p>
                      <input
                        id="overlay-label-input"
                        type="text"
                        maxLength={15}
                        placeholder="NOW STREAMING"
                        value={overlayLabel}
                        onBlur={() => setFieldTouched('overlayLabel')}
                        onChange={(e) => {
                          resetFormFeedback();
                          setOverlayLabel(e.target.value);
                        }}
                        aria-describedby="overlay-label-help"
                        aria-invalid={touchedFields.overlayLabel && !validatedFields.overlayLabel}
                        className={`w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none transition duration-200 placeholder:text-neutral-500 ${getFieldClassName('overlayLabel')}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label htmlFor="start-path-input" className="text-sm font-semibold text-neutral-100">{FIELD_LABELS.startPath}</label>
                        {getFieldIndicator('startPath')}
                      </div>
                      <p id="start-path-help" className="text-xs leading-5 text-neutral-400">
                        Optional deep-link hint. Start with <span className="font-semibold text-neutral-200">/</span>, <span className="font-semibold text-neutral-200">?</span>, or <span className="font-semibold text-neutral-200">#</span> to jump to a specific route, query, or anchor.
                      </p>
                      <input
                        id="start-path-input"
                        type="text"
                        placeholder="/pricing#plans"
                        value={startPath}
                        onBlur={() => setFieldTouched('startPath')}
                        onChange={(e) => {
                          resetFormFeedback();
                          setStartPath(e.target.value);
                        }}
                        aria-describedby="start-path-help"
                        aria-invalid={touchedFields.startPath && !validatedFields.startPath}
                        className={`w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none transition duration-200 placeholder:text-neutral-500 ${getFieldClassName('startPath')}`}
                      />
                    </div>
                  </div>

                  <label
                    htmlFor="legal-agreement-checkbox"
                    className="group flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <span className="relative mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-emerald-300/40 bg-black/30 shadow-[0_0_18px_rgba(16,185,129,0.08)]">
                      <input
                        id="legal-agreement-checkbox"
                        type="checkbox"
                        required
                        checked={legalAgreed}
                        onChange={(e) => {
                          resetFormFeedback();
                          setLegalAgreed(e.target.checked);
                        }}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                      <span className={`h-2.5 w-2.5 rounded-sm bg-emerald-300 transition ${legalAgreed ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} />
                    </span>
                    <span className="space-y-1">
                      <span className="block text-sm font-semibold text-white">Accept the non-refundable takeover rules</span>
                      <span className="block text-xs leading-5 text-neutral-400">
                        This confirms you understand the takeover fee is final once checkout starts and that the selected destination must comply with your platform rules.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="border-t border-white/10 px-5 py-5 sm:px-6">
                  <button
                    type="submit"
                    disabled={isSubmitting || isLocked}
                    className={`group flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090b10] sm:text-base ${
                      isLocked
                        ? 'cursor-not-allowed border border-rose-400/20 bg-rose-500/10 text-rose-200'
                        : 'border border-emerald-300/25 bg-[linear-gradient(135deg,_rgba(52,211,153,0.96),_rgba(251,191,36,0.92))] text-slate-950 shadow-[0_0_35px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 hover:shadow-[0_0_45px_rgba(16,185,129,0.45)]'
                    }`}
                  >
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ExternalLink className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />}
                    {isSubmitting ? 'OPENING CHECKOUT…' : isLocked ? `FEED LOCKED · ${formatClock(lockTimer)}` : `STEAL FOR \$${stealPrice}`}
                  </button>
                  <p className="mt-3 text-center text-xs leading-5 text-neutral-400">
                    Press <span className="font-semibold text-neutral-200">Enter</span> to review checkout details, then confirm when ready.
                  </p>
                </div>
              </form>
            </aside>
          )}

          <section className="flex min-h-0 flex-1 flex-col gap-4 lg:gap-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.25)] ring-1 ring-white/5 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">Now on stage</p>
                <p className="mt-3 text-base font-bold leading-7 text-white sm:text-lg">{stripProtocol(slot?.currentUrl) || 'SYSTEM_IDLE'}</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.25)] ring-1 ring-white/5 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">Current stake</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <span className="text-2xl font-black text-white sm:text-3xl">\${slot?.current_bid || '0.00'}</span>
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Next \${stealPrice}</span>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.25)] ring-1 ring-white/5 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">Connection</p>
                <div
                  className={`mt-3 inline-flex items-center gap-3 rounded-full border px-3 py-2 text-sm font-semibold ${connectionStatusMeta.badge}`}
                  aria-label={`Canvas connection is currently ${connectionStatusMeta.label}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${connectionStatusMeta.accent} ${socketStatus !== 'disconnected' ? 'animate-pulse' : ''}`} />
                  {connectionStatusMeta.label}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.25)] ring-1 ring-white/5 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">Lock timer</p>
                <div className={`mt-3 inline-flex items-center gap-3 text-lg font-black sm:text-2xl ${isLocked ? 'text-rose-300 dashboard-pulse-alert' : 'text-emerald-300'}`}>
                  <Clock3 className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span>{isLocked ? formatClock(lockTimer) : 'OPEN'}</span>
                </div>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-5">
              <div className="relative flex min-h-[320px] flex-1 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(15,18,25,0.98),_rgba(8,9,13,0.98))] p-3 shadow-[0_30px_100px_rgba(0,0,0,0.45)] ring-1 ring-white/5 sm:min-h-[380px] sm:p-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_28%)]" aria-hidden="true" />
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#040507] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03),0_20px_70px_rgba(0,0,0,0.55)]">
                  <canvas ref={canvasRef} className={`h-full w-full object-contain transition duration-500 ${!hasFrames ? 'opacity-0' : 'opacity-100'}`} />

                  {!hasFrames && socketStatus !== 'disconnected' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
                      <div className="w-full max-w-md space-y-3">
                        <div className="h-5 w-32 rounded-full bg-white/10" />
                        <div className="h-32 rounded-[1.5rem] bg-white/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]" />
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="h-16 rounded-2xl bg-white/5" />
                          <div className="h-16 rounded-2xl bg-white/5" />
                          <div className="h-16 rounded-2xl bg-white/5" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-bold text-white">Awaiting live stream frames</p>
                        <p className="text-sm leading-6 text-neutral-400">
                          {socketStatus === 'reconnecting'
                            ? 'Trying to restore the live connection…'
                            : 'The stream is online, but no frames have arrived yet.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {!hasFrames && socketStatus === 'disconnected' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-rose-400/25 bg-rose-500/10 text-rose-200">
                        <WifiOff className="h-7 w-7" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-bold text-white">No stream connection</p>
                        <p className="max-w-md text-sm leading-6 text-neutral-400">
                          The dashboard is disconnected from the takeover feed right now. We’ll keep trying to reconnect automatically.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.25)] ring-1 ring-white/5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">Stage owner</p>
                  <p className="mt-3 text-xl font-black text-white">{slot?.displayName || 'SYSTEM IDLE'}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">Who currently controls the screen and how long they have held it.</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,_rgba(16,185,129,0.08),_rgba(255,255,255,0.02))] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.25)] ring-1 ring-white/5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/75">Time on stage</p>
                  <p className="mt-3 text-3xl font-black text-white">{formatClock(stageTimer)}</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-300">Live counter for the current winning session.</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,_rgba(17,20,27,0.94),_rgba(8,10,14,0.98))] px-4 py-4 shadow-[0_16px_50px_rgba(0,0,0,0.25)] ring-1 ring-white/5 sm:px-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">History ticker</p>
                  <p className="mt-1 text-sm text-neutral-300">Recent takeovers and the bids that moved the board.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">Live ledger</span>
              </div>

              {historyList.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                  <div className="dashboard-marquee-track flex min-w-max items-center gap-4 whitespace-nowrap pr-4">
                    {historyTickerItems.map((item, idx) => (
                      <div key={`${item.displayName || 'history'}-${idx}`} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-200">↗</span>
                        <span className="font-semibold text-white">{item.displayName || 'Anonymous Takeover'}</span>
                        <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-neutral-300">{stripProtocol(item.currentUrl) || 'standby'}</span>
                        <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">\${item.currentBid || '0.00'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-white">No history yet</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">The ticker will light up here as soon as the first takeover lands.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {isEmbedOpen && (
        <>
          <button
            type="button"
            className="dashboard-fade-in absolute inset-0 z-50 bg-black/80 backdrop-blur-sm"
            aria-label="Close takeover success dialog"
            onClick={() => setIsEmbedOpen(false)}
          />
          <div className="dashboard-fade-in absolute inset-0 z-[60] flex items-center justify-center p-4">
            <div
              className="dashboard-slide-up relative w-full max-w-2xl rounded-[2rem] border border-emerald-400/25 bg-[linear-gradient(180deg,_rgba(12,18,16,0.98),_rgba(7,10,12,0.98))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.6)] ring-1 ring-white/5 sm:p-7"
              role="dialog"
              aria-modal="true"
              aria-labelledby="takeover-success-title"
            >
            <button
              type="button"
              onClick={() => setIsEmbedOpen(false)}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                Takeover successful
              </div>
              <h2 id="takeover-success-title" className="mt-4 text-2xl font-black text-white sm:text-3xl">Your stage widget is ready.</h2>
              <p className="mt-3 text-sm leading-7 text-neutral-300 sm:text-base">
                Drop this embed into your blog, landing page, or community dashboard so your audience can track your control of the stage in real time.
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/25 p-4">
              <textarea
                readOnly
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                value={embedCode}
                className="h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/35 p-4 font-mono text-xs leading-6 text-emerald-200 outline-none"
              />
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-neutral-400">Tip: click inside the code block to select it, or use the copy button for one-tap clipboard access.</p>
                <button
                  type="button"
                  onClick={handleCopyEmbed}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/12 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/40 hover:bg-emerald-500/18"
                >
                  <Copy className="h-4 w-4" />
                  {copyFeedback}
                </button>
              </div>
            </div>
            </div>
          </div>
        </>
      )}

      {isConfirmOpen && (
        <>
          <button
            type="button"
            className="dashboard-fade-in absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm"
            aria-label="Close checkout confirmation dialog"
            onClick={() => setIsConfirmOpen(false)}
          />
          <div className="dashboard-fade-in absolute inset-0 z-[70] flex items-center justify-center p-4">
            <div className="dashboard-slide-up relative w-full max-w-xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(16,19,24,0.98),_rgba(7,9,13,0.98))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.6)] ring-1 ring-white/5 sm:p-7" role="dialog" aria-modal="true" aria-labelledby="checkout-confirm-title">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
              <ShieldCheck className="h-4 w-4" />
              Confirm checkout details
            </div>
            <h2 id="checkout-confirm-title" className="mt-4 text-2xl font-black text-white">Review your takeover</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              Checkout will open in a secure Stripe session with the configuration below.
            </p>

            <dl className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Target URL</dt>
                <dd className="mt-2 break-all font-semibold text-white">{normalizedTargetUrl}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Checkout total</dt>
                <dd className="mt-2 text-2xl font-black text-white">\${stealPrice}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Display name</dt>
                <dd className="mt-2 font-semibold text-white">{displayName || 'Anonymous Takeover'}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Overlay label</dt>
                <dd className="mt-2 font-semibold text-white">{overlayLabel || 'No overlay label'}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">Start path</dt>
                <dd className="mt-2 font-semibold text-white">{startPath || 'No deep link provided'}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                Back to edit
              </button>
              <button
                type="button"
                onClick={handleConfirmCheckout}
                disabled={!canStartCheckout}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition ${
                  canStartCheckout
                    ? 'border border-emerald-300/25 bg-[linear-gradient(135deg,_rgba(52,211,153,0.96),_rgba(251,191,36,0.92))] text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:-translate-y-0.5'
                    : 'cursor-not-allowed border border-white/10 bg-white/5 text-neutral-500'
                }`}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isSubmitting ? 'Opening secure checkout…' : 'Confirm and continue'}
              </button>
            </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
