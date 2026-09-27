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
  const [isEmbedOpen, setIsEmbedOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [overlayLabel, setOverlayLabel] = useState('');
  const [startPath, setStartPath] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [legalAgreed, setLegalAgreed] = useState(false);

  useEffect(() => {
    const socket = io('wss://://onrender.com', {
      path: '/socket.io/', transports: ['websocket'], secure: true, rejectUnauthorized: false
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
  }, [streamServerUrl]);

  useEffect(() => {
    // AUTOMATISCHE EMBED DETECTIE: Schuif het embed-paneel open als de koper succesvol terugkomt van Stripe!
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
    <div className="fixed inset-0 w-screen h-screen bg-[#060608] flex flex-col font-mono text-neutral-200 select-none overflow-hidden p-4 gap-4">
      {/* Header */}
      <header className="flex justify-between items-center bg-[#0D0D11] border border-neutral-800 p-4 rounded-xl shrink-0">
        <span className="font-black tracking-widest text-xs">THE ONLY TAB</span>
        <div className="flex gap-2">
          <button onClick={() => setIsEmbedOpen(!isEmbedOpen)} className="text-[10px] bg-neutral-900 border border-neutral-800 px-3 py-1 rounded">EMBED</button>
          <button onClick={() => setIsFormOpen(!isFormOpen)} className="text-[10px] bg-white text-black font-black px-4 py-1 rounded">STEAL STAGE</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row gap-4 relative overflow-hidden">
        {/* Form Drawer */}
        {isFormOpen && (
          <form onSubmit={handleAcquireTabSubmit} className="w-full md:w-64 bg-[#0D0D11] border border-neutral-800 p-4 rounded-xl flex flex-col gap-3 overflow-y-auto z-30">
            <input type="text" required placeholder="Target URL (example.com)" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} className="w-full bg-black border border-neutral-800 rounded p-2 text-xs outline-none" />
            <input type="text" placeholder="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-black border border-neutral-800 rounded p-2 text-xs outline-none" />
            <input type="text" maxLength={15} placeholder="Overlay Label" value={overlayLabel} onChange={e => setOverlayLabel(e.target.value)} className="w-full bg-black border border-neutral-800 rounded p-2 text-xs outline-none" />
            <input type="text" placeholder="Start Path (/pricing)" value={startPath} onChange={e => setStartPath(e.target.value)} className="w-full bg-black border border-neutral-800 rounded p-2 text-xs outline-none" />
            <label className="flex items-center gap-2 text-[9px] text-neutral-400">
              <input type="checkbox" required checked={legalAgreed} onChange={e => setLegalAgreed(e.target.checked)} />
              <span>Accept Non-Refundable Stage Rules</span>
            </label>
            <button type="submit" disabled={isSubmitting || lockTimer > 0} className="w-full bg-white text-black font-black py-2 rounded text-xs">
              {isSubmitting ? 'OPENING...' : lockTimer > 0 ? 'LOCKED' : `STEAL FOR $${slot?.stealPrice || '19.00'}`}
            </button>
          </form>
        )}

        {/* Embed Modal */}
        {isEmbedOpen && (
          <div className="absolute right-0 top-0 w-64 bg-[#0D0D11] border border-neutral-800 p-4 rounded-xl z-30 flex flex-col gap-2 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
              <span className="text-[10px] text-emerald-400 font-bold">🎉 TAKEOVER SUCCESSFUL!</span>
              <button onClick={() => setIsEmbedOpen(false)} className="text-neutral-500 hover:text-white text-xs">×</button>
            </div>
            <p className="text-[9px] text-neutral-400 leading-normal font-sans">Place this widget on your platform or socials. If you get outbid, it will automatically alert your audience to help you steal the stage back!</p>
            <textarea readOnly onClick={e => (e.target as HTMLTextAreaElement).select()} value={`<iframe src="https://theonlytab.io" width="100%" height="140" style="border:none;" scrolling="no"></iframe>`} className="w-full h-16 bg-black border border-neutral-800 rounded p-2 text-[9px] text-amber-400 font-mono resize-none outline-none" />
          </div>
        )}

        {/* Main Scoreboard Display Section */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Ticker Row - FIXED: Backslashes completely destroyed */}
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

          {/* Ledger Marquee History Row - FIXED: Backslashes removed from marquee elements */}
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
