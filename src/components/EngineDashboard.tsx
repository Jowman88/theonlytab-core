'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Zap, ArrowUpRight, Globe, X, Link2, User, ChevronRight, Type, Hash, ShieldAlert } from 'lucide-react';

interface SlotData {
  id: string;
  currentUrl?: string;
  displayName?: string;
  current_bid?: string;
  stealPrice?: string;
  secondsOnStage?: number;
  secondsLeftInLock?: number;
}

export default function EngineDashboard({ streamServerUrl }: { streamServerUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [slot, setSlot] = useState<SlotData | null>(null);
  const [lockTimer, setLockTimer] = useState<number>(0);
  const [stageTimer, setStageTimer] = useState<number>(0);
  const [hasFrames, setHasFrames] = useState<boolean>(false);

  // Form Drawer states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [overlayLabel, setOverlayLabel] = useState<string>('');
  const [startPath, setStartPath] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [legalAgreed, setLegalAgreed] = useState<boolean>(false);

  useEffect(() => {
    const socket = io('wss://://onrender.com', {
      path: '/socket.io/',
      transports: ['websocket'],
      secure: true,
      rejectUnauthorized: false
    });

    socket.on('v-frame', (base64Data: string) => {
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
      img.src = `data:image/jpeg;base64,${base64Data}`;
    });
    return () => { socket.disconnect(); };
  }, [streamServerUrl]);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/get-active-tab');
        if (res.ok) {
          const payload = await res.json();
          if (payload?.data) {
            setSlot(payload.data);
            setLockTimer(Number(payload.data.secondsLeftInLock) || 0);
            setStageTimer(Number(payload.data.secondsOnStage) || 0);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchState();
    const interval = setInterval(fetchState, 5000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setLockTimer(prev => Math.max(0, prev - 1));
      setStageTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAcquireTabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl) return alert('Enter a target URL.');
    if (!legalAgreed) return alert('Accept the Terms to proceed.');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName || 'Anonymous Takeover',
          targetUrl: targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`,
          overlayLabel: overlayLabel || '',
          startPath: startPath || ''
        })
      });
      const errData = await res.json();
      if (!res.ok) {
        alert(errData.error || "Transaction refused.");
        setIsSubmitting(false);
        return;
      }
      if (errData.url) window.location.href = errData.url;
    } catch (err) {
      alert("Network error.");
      setIsSubmitting(false);
    }
  };

  const formatLockClock = (s: number) => {
    if (!s || s <= 0) return "OPEN TO STEAL";
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `LOCKED ${mins}:${secs}`;
  };

  const formatStageClock = (s: number) => {
    if (!s || s <= 0) return "00:00";
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#050507] flex flex-col font-mono text-neutral-200 select-none overflow-hidden antialiased">
      {/* Premium Sports Header */}
      <header className="h-16 bg-[#0B0B0F] border-b border-neutral-900 flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="font-black text-sm tracking-[0.25em] uppercase text-neutral-100">THE ONLY TAB</span>
        </div>
        <button type="button" onClick={() => setIsFormOpen(true)} className="h-9 px-5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-950 text-xs font-black transition-all flex items-center gap-1 active:scale-[0.97]">
          <span>STEAL STAGE</span>
          <ArrowUpRight size={13} />
        </button>
      </header>

      {/* Main Structural Core */}
      <div className="flex-1 w-full flex flex-col lg:flex-row relative overflow-hidden">
        
        {/* Slidable Intake Control Drawer */}
        <div className={`fixed lg:absolute top-0 left-0 h-full w-full sm:w-80 bg-[#0B0B0F] border-r border-neutral-900 z-30 transform transition-transform duration-300 flex flex-col ${isFormOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 border-b border-neutral-900 flex items-center justify-between">
            <h3 className="font-black text-xs uppercase tracking-widest text-neutral-100">INITIATE STEAL</h3>
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-neutral-500 hover:text-white bg-[#111116] border border-neutral-900 p-1.5 rounded-lg"><X size={12} /></button>
          </div>
          <form onSubmit={handleAcquireTabSubmit} className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto font-sans">
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1.5">Target Website URL *</label>
              <input type="text" required placeholder="example.com" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} className="w-full bg-[#111116] border border-neutral-900 rounded-xl h-11 px-4 text-xs font-mono text-neutral-200 outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1.5">Display Name</label>
              <input type="text" placeholder="Brand Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-[#111116] border border-neutral-900 rounded-xl h-11 px-4 text-xs text-neutral-200 outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1.5">Custom Video Overlay (Max 15 Chars)</label>
              <input type="text" maxLength={15} placeholder="TEXT ON STREAM" value={overlayLabel} onChange={(e) => setOverlayLabel(e.target.value)} className="w-full bg-[#111116] border border-neutral-900 rounded-xl h-11 px-4 text-xs text-neutral-200 outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1.5">Optional Start Path / Hash</label>
              <input type="text" placeholder="/pricing" value={startPath} onChange={(e) => setStartPath(e.target.value)} className="w-full bg-[#111116] border border-neutral-900 rounded-xl h-11 px-4 text-xs font-mono text-neutral-200 outline-none" />
            </div>

            <div className="bg-[#111116] border border-neutral-900 p-3.5 rounded-xl space-y-2 mt-1">
              <p className="text-[9px] text-neutral-500 leading-normal text-left font-medium font-sans">
                Purchases are non-refundable. If your stream is outbid, no refunds apply. Malware or illegal content will be slashed instantly.
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer pt-1.5 border-t border-neutral-900 select-none">
                <input type="checkbox" required checked={legalAgreed} onChange={(e) => setLegalAgreed(e.target.checked)} className="mt-0.5 accent-emerald-500 h-3.5 w-3.5 border-neutral-900 rounded bg-[#050507]" />
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wide">Accept Terms</span>
              </label>
            </div>

            <div className="bg-[#111116] border border-neutral-900 p-4 rounded-xl text-center mt-2">
              <span className="text-xl font-mono font-black text-amber-400">\${slot?.stealPrice || '19.00'}</span>
            </div>
            <button type="submit" disabled={isSubmitting || lockTimer > 0 || !legalAgreed} className="w-full bg-neutral-100 hover:bg-white disabled:bg-neutral-900 disabled:text-neutral-600 text-neutral-950 font-black h-11 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 font-mono">
              <span>{isSubmitting ? 'OPENING STRIPE...' : lockTimer > 0 ? 'FEED LOCKED' : 'EXECUTE STEAL'}</span>
            </button>
          </form>
        </div>

        {/* Dynamic Presentation Grid */}
        <div className="flex-1 h-full flex flex-col p-4 sm:p-6 gap-4 sm:gap-6 overflow-y-auto">
          
          {/* HUGE RADICAL SPORT TICKER ROW */}
          <div className="w-full bg-[#0B0B0F] border border-neutral-900 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl shrink-0">
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-500 font-bold tracking-widest block uppercase">NOW BROADCASTING</span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide truncate max-w-[280px] sm:max-w-md">
                {slot?.currentUrl?.replace('https://', '') || 'SYSTEM_IDLE'}
              </h2>
            </div>
            
            <div className="space-y-1 md:text-center">
              <span className="text-[10px] text-neutral-500 font-bold tracking-widest block uppercase">CURRENT STAKE</span>
              <div className="text-sm sm:text-base font-bold text-neutral-300">
                <span className="text-white font-black">\${slot?.current_bid || '0.00'} PAID</span>
                <span className="text-neutral-600 mx-2 sm:mx-3">·</span>
                <span className="text-neutral-400">STEAL FOR </span>
                <span className="text-amber-400 font-black">\${slot?.stealPrice || '19.00'}</span>
              </div>
            </div>

            <div className="space-y-1 md:text-right">
              <span className="text-[10px] text-neutral-500 font-bold tracking-widest block uppercase">STAGE PROTECTION</span>
              <div className={`text-base sm:text-lg font-black tracking-wider ${lockTimer > 0 ? 'text-red-500' : 'text-emerald-400 animate-pulse'}`}>
                {formatLockClock(lockTimer)}
              </div>
            </div>
          </div>

          {/* Core Video Canvas Frame Container Area */}
          <div className="flex-1 w-full bg-[#0B0B0F] border border-neutral-900 rounded-3xl overflow-hidden shadow-2xl relative flex items-center justify-center min-h-[220px] sm:min-h-[380px]">
            <canvas ref={canvasRef} className={`w-full h-full object-contain ${!hasFrames ? 'hidden' : 'block'}`} />
            
            {!hasFrames && (
              <div className="absolute inset-0 bg-[#060608] flex flex-col items-center justify-center">
                <div className="absolute w-[200px] h-[200px] bg-emerald-500/5 rounded-full blur-[80px] animate-pulse" />
                <div className="flex flex-col items-center gap-4 z-10">
                  <div className="relative flex items-center justify-center w-14 h-14 bg-[#0B0B0F] border border-neutral-900 rounded-2xl shadow-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/20 to-transparent opacity-50 animate-pulse" />
                    <Zap size={22} className="text-emerald-400 animate-bounce" style={{ animationDuration: '3s' }} />
                  </div>
                  <div className="text-center space-y-1">
                    <h1 className="text-white text-xs font-black tracking-[0.25em] uppercase pl-[0.25em]">THE ONLY TAB</h1>
                    <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.3em] pl-[0.3em] animate-pulse">Awaiting Broadcast Node</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Running History Banner Footer */}
          <div className="w-full h-14 bg-[#0B0B0F] border border-neutral-900 rounded-xl px-4 flex items-center justify-between text-[11px] font-bold shadow-md shrink-0">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-neutral-500 uppercase tracking-widest text-[9px] mr-2">ON STAGE:</span>
                <span className="text-neutral-200">{slot?.displayName || 'SYSTEM IDLE'}</span>
              </div>
              <div className="hidden sm:block border-l border-neutral-900 pl-6">
                <span className="text-neutral-500 uppercase tracking-widest text-[9px] mr-2">TIME ON STAGE:</span>
                <span className="text-neutral-300 font-mono">{formatStageClock(stageTimer)}</span>
              </div>
            </div>
            
            {/* LIVE FEED MARQUEE TICKER TRACK */}
            <div className="flex items-center gap-2 text-neutral-500 uppercase text-[9px] tracking-widest bg-[#111116] border border-neutral-900 px-3 py-1 rounded-md">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>LIVE TRANSMISSION FEED</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
