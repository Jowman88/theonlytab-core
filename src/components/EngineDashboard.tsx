'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

interface SlotData {
  id: string; currentUrl?: string; displayName?: string;
  current_bid?: string; stealPrice?: string;
  secondsOnStage?: number; secondsLeftInLock?: number;
}

export default function EngineDashboard({ streamServerUrl }: { streamServerUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [slot, setSlot] = useState<SlotData | null>(null);
  const [lockTimer, setLockTimer] = useState<number>(0);
  const [stageTimer, setStageTimer] = useState<number>(0);
  const [hasFrames, setHasFrames] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<any[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEmbedOpen, setIsEmbedOpen] = useState(false); // Post-purchase modal trigger
  const [targetUrl, setTargetUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [overlayLabel, setOverlayLabel] = useState('');
  const [startPath, setStartPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [legalAgreed, setLegalAgreed] = useState(false);

  useEffect(() => {
    const socket = io('https://theonlytab-server.onrender.com', {
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  secure: true,
  rejectUnauthorized: false
});

    socket.on('v-frame', (base64: string) => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        setHasFrames(true);
        canvasRef.current!.width = img.width;
        canvasRef.current!.height = img.height;
        ctx.drawImage(img, 0, 0);
      };
      img.src = `data:image/jpeg;base64,${base64}`;
    });
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    // 🛡️ REVENGE LOOP HOOK: Automatically sliding open the embed configurations ONLY for verified checkout redirect links
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
          const p = await res.json();
          if (p?.data) {
            setSlot(p.data);
            setLockTimer(Number(p.data.secondsLeftInLock) || 0);
            setStageTimer(parseFloat(p.data.current_bid || '0') <= 0 ? 0 : Number(p.data.secondsOnStage) || 0);
          }
        }
        const hRes = await fetch('/api/get-ticker-history');
        if (hRes.ok) {
          const hP = await hRes.json();
          setHistoryList(hP.history || []);
        }
      } catch (e) { console.error(e); }
    };
    fetchState();
    const interval = setInterval(fetchState, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setLockTimer(prev => Math.max(0, prev - 1));
      setStageTimer(prev => (slot?.current_bid && parseFloat(slot.current_bid) > 0 ? prev + 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [slot]);

  const handleAcquireTabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl || !legalAgreed) return alert('Fill fields and accept terms.');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName || 'Anonymous Takeover',
          targetUrl: targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`,
          overlayLabel, startPath
        })
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error || "Refused."); setIsSubmitting(false); return; }
      if (d.url) window.location.href = d.url;
    } catch { setIsSubmitting(false); }
  };

  const formatClock = (s: number) => {
    if (!s || s <= 0) return "00:00";
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };
  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#060608] flex flex-col font-sans text-neutral-200 select-none overflow-hidden p-4 gap-4">
      {/* Gated Boardroom Navigation Header */}
      <header className="flex justify-between items-center bg-[#0D0D11] border border-neutral-800 p-4 rounded-xl shrink-0 font-mono">
        <span className="font-black tracking-widest text-xs">THE ONLY TAB</span>
        <div className="flex gap-2">
          {/* ⚡ CLEAN RESTRUCTURING: The loose, public "Get Embed" button is completely removed from public view! */}
          <button onClick={() => setIsFormOpen(!isFormOpen)} className="text-[10px] bg-white text-black font-black px-4 py-1 rounded">STEAL STAGE</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row gap-4 relative overflow-hidden">
        {/* Slidable Configuration Intake Drawer */}
        {isFormOpen && (
          <form onSubmit={handleAcquireTabSubmit} className="w-full md:w-64 bg-[#0D0D11] border border-neutral-800 p-4 rounded-xl flex flex-col gap-3 overflow-y-auto z-30 font-sans relative">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1">
              <span className="text-[10px] font-bold text-neutral-400 font-mono tracking-wider">CONFIG DRAWER</span>
              <button type="button" onClick={() => setIsFormOpen(false)} className="text-neutral-500 hover:text-white text-xs font-mono font-bold bg-[#14141A] border border-neutral-800 px-2 py-0.5 rounded">✕ CLOSE</button>
            </div>

            <div>
              <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-wide block mb-1">Target Website URL *</label>
              <input type="text" required placeholder="" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} className="w-full bg-black border border-neutral-800 rounded p-2 text-xs outline-none font-mono" />
            </div>
            <div>
              <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-wide block mb-1">Display Name</label>
              <input type="text" placeholder="" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-black border border-neutral-800 rounded p-2 text-xs outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-wide block mb-1">Overlay Label (Max 15 Chars)</label>
              <input type="text" maxLength={15} placeholder="" value={overlayLabel} onChange={e => setOverlayLabel(e.target.value)} className="w-full bg-black border border-neutral-800 rounded p-2 text-xs outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-neutral-500 font-bold uppercase tracking-wide block mb-1">Optional Start Path / Hash</label>
              <input type="text" placeholder="" value={startPath} onChange={e => setStartPath(e.target.value)} className="w-full bg-black border border-neutral-800 rounded p-2 text-xs outline-none font-mono" />
            </div>

            <label className="flex items-start gap-2 text-[9px] text-neutral-400 leading-normal cursor-pointer select-none mt-1">
              <input type="checkbox" required checked={legalAgreed} onChange={(e) => setLegalAgreed(e.target.checked)} className="mt-0.5 accent-emerald-500" />
              <span>Accept Non-Refundable Takeover Stage Rules</span>
            </label>

            <button type="submit" disabled={isSubmitting || lockTimer > 0 || !legalAgreed} className="w-full bg-white text-black font-black py-2.5 rounded text-xs font-mono mt-1">
              {isSubmitting ? 'OPENING...' : lockTimer > 0 ? 'FEED LOCKED' : 'STEAL FOR \$' + (slot?.stealPrice || '19.00')}
            </button>
          </form>
        )}

        {/* 🔐 POST-PURCHASE EXCLUSIVE EMBED CARD OVERLAY CONTAINER */}
        {isEmbedOpen && (
          <div className="absolute right-0 top-0 w-full sm:w-72 bg-[#0D0D11] border border-emerald-500/30 p-5 rounded-xl z-40 flex flex-col gap-3.5 shadow-2xl shadow-emerald-950/10 font-mono">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-[10px] text-emerald-400 font-black tracking-wider flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                TAKEOVER SUCCESSFUL!
              </span>
              <button onClick={() => setIsEmbedOpen(false)} className="text-neutral-500 hover:text-white text-sm font-bold">✕</button>
            </div>
            <p className="text-[10px] text-neutral-400 leading-normal font-sans">
              You own the screen! Copy this widget iframe code to your personal blog, SaaS panel, or landing platforms. If you get dethroned, this widget instantly alerts your community to help you steal it back!
            </p>
            <div className="space-y-1">
              <textarea 
                readOnly 
                onClick={e => (e.target as HTMLTextAreaElement).select()} 
                value={`<iframe src="https://theonlytab.io" width="100%" height="140" style="border:none;background:transparent;" scrolling="no"></iframe>`} 
                className="w-full h-18 bg-black border border-neutral-800 focus:border-neutral-700 rounded p-2.5 text-[9px] text-amber-400 font-mono resize-none outline-none" 
              />
              <span className="text-[8px] text-neutral-500 uppercase font-black block tracking-wide text-right">Click inside text box to auto-copy</span>
            </div>
          </div>
        )}

        {/* Main Scoreboard Display Section */}
        <div className="flex-1 flex flex-col gap-4 font-mono">
          <div className="bg-[#0D0D11] border border-neutral-800 rounded-xl p-4 flex flex-wrap justify-between gap-2 text-xs font-bold">
            <div>NOW: <span className="text-emerald-400">{slot?.currentUrl?.replace('https://', '') || 'SYSTEM_IDLE'}</span></div>
            <div>STAKE: <span className="text-white">\${slot?.current_bid || '0.00'}</span> · NEXT: <span className="text-amber-400">\${slot?.stealPrice || '19.00'}</span></div>
            <div className={lockTimer > 0 ? 'text-red-400' : 'text-emerald-400'}>{lockTimer > 0 ? `LOCKED ${formatClock(lockTimer)}` : 'OPEN TO STEAL'}</div>
          </div>

          {/* Canvas Wrapper */}
          <div className="flex-1 bg-[#0D0D11] border border-neutral-900 rounded-xl relative flex items-center justify-center min-h-[200px]">
            <canvas ref={canvasRef} className={`w-full h-full object-contain ${!hasFrames ? 'hidden' : 'block'}`} />
            {!hasFrames && (
              <div className="text-center space-y-1 animate-pulse">
                <div className="text-white text-xs font-black tracking-widest">THE ONLY TAB</div>
                <div className="text-[9px] text-neutral-500 uppercase">Awaiting Takeover Node Feed</div>
              </div>
            )}
          </div>

          {/* Ledger Marquee History Row */}
          <div className="h-10 bg-[#0D0D11] border border-neutral-800 rounded-xl flex items-center px-4 overflow-hidden text-[10px] gap-4 relative">
            <span className="text-neutral-500 shrink-0 font-black">RECENT:</span>
            <div className="flex gap-8 whitespace-nowrap animate-marquee">
              {historyList.length > 0 ? historyList.map((item, idx) => (
                <div key={idx} className="flex gap-1.5">
                  <span className="text-neutral-200 font-bold">{item.displayName}</span>
                  <span className="text-emerald-400">{item.currentUrl?.replace('https://', '')}</span>
                  <span className="text-amber-400">\${item.currentBid}</span>
                </div>
              )) : <span className="text-neutral-600">Awaiting ledger seeds...</span>}
            </div>
          </div>

          {/* Bottom Mini Footer Status */}
          <div className="flex justify-between text-[9px] text-neutral-500 font-bold px-1">
            <div>ON STAGE: {slot?.displayName || 'SYSTEM IDLE'}</div>
            <div>TIME ON STAGE: {formatClock(stageTimer)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
