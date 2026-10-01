'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, ShieldAlert } from 'lucide-react';

type RevertResult = { slotId: string | null; timestamp: string } | null;

export default function AdminPage() {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const [secret, setSecret] = useState('');
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [result, setResult] = useState<RevertResult>(null);

  useEffect(() => {
    if (!isConfirmOpen) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsConfirmOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (!focusableElements?.length) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      window.removeEventListener('keydown', handleDialogKeyDown);
      previouslyFocused?.focus();
    };
  }, [isConfirmOpen]);

  const revertToHouse = async () => {
    setIsSubmitting(true);
    setNotice(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/revert-to-house', {
        method: 'POST',
        headers: { 'X-Admin-Secret': secret },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to revert the active stage.');
      }

      setResult({ slotId: data.slotId, timestamp: data.timestamp });
      setNotice({
        type: 'success',
        message: data.slotId ? 'Stage killed and reverted to house-default.' : 'No active stage was found.',
      });
      setIsConfirmOpen(false);
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to revert the active stage.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_35%),linear-gradient(180deg,_#08090d_0%,_#050507_100%)] px-4 py-12 text-neutral-100 sm:px-6">
      <section className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-black/40 p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3 text-emerald-200">
          <ShieldAlert aria-hidden="true" className="h-6 w-6" />
          <p className="text-xs font-bold uppercase tracking-[0.24em]">The Only Tab · Admin</p>
        </div>
        <h1 className="mt-5 text-3xl font-black text-white">Stage emergency controls</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-300">
          Freeze the active stage and return the public stream to the house-default page.
        </p>

        <label htmlFor="admin-secret" className="mt-7 block text-sm font-semibold text-neutral-100">
          Admin secret
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="admin-secret"
            type={isSecretVisible ? 'text' : 'password'}
            autoComplete="off"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/50 px-4 py-3 text-base text-white outline-none focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300/40"
          />
          <button
            type="button"
            onClick={() => setIsSecretVisible((visible) => !visible)}
            aria-label={isSecretVisible ? 'Hide admin secret' : 'Show admin secret'}
            aria-pressed={isSecretVisible}
            className="rounded-xl border border-white/15 bg-white/5 px-3 text-neutral-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            {isSecretVisible ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>

        <button
          type="button"
          disabled={!secret.trim() || isSubmitting}
          onClick={() => {
            setNotice(null);
            setIsConfirmOpen(true);
          }}
          className="mt-6 w-full rounded-xl border border-rose-300/30 bg-rose-500/15 px-5 py-4 text-sm font-black tracking-[0.12em] text-rose-100 transition hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          🛑 KILL STAGE NOW
        </button>

        {notice && (
          <div
            role={notice.type === 'error' ? 'alert' : 'status'}
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
              notice.type === 'success'
                ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
                : 'border-rose-400/25 bg-rose-500/10 text-rose-100'
            }`}
          >
            {notice.message}
          </div>
        )}

        {result && (
          <p className="mt-3 break-all text-xs leading-5 text-neutral-400">
            Frozen slot: {result.slotId || 'none'} · {new Date(result.timestamp).toLocaleString()}
          </p>
        )}
      </section>

      {isConfirmOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <section
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="revert-confirm-title"
            aria-describedby="revert-confirm-description"
            className="w-full max-w-md rounded-2xl border border-rose-300/25 bg-[#101116] p-6 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-rose-200">
              <AlertTriangle aria-hidden="true" className="h-5 w-5" />
              <h2 id="revert-confirm-title" className="font-bold">Confirm emergency revert</h2>
            </div>
            <p id="revert-confirm-description" className="mt-4 text-sm leading-6 text-neutral-300">
              Are you sure? This will immediately freeze the active stage and revert to house-default.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                ref={cancelButtonRef}
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={revertToHouse}
                className="rounded-lg border border-rose-300/30 bg-rose-500/20 px-4 py-2 text-sm font-bold text-rose-100 hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-50"
              >
                {isSubmitting ? 'Reverting…' : 'Confirm revert'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
