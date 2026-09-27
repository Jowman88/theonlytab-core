'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Zap, ArrowUpRight, Globe, X, Link2, User, ChevronRight, Type, Hash, ShieldCheck } from 'lucide-react';

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
  const [hasFrames, setHasFrames] = useState<boolean>(false);

  // Form input states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [overlayLabel, setOverlayLabel] = useState<string>('');
  const [startPath, setStartPath] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Legal Binding Compliance State
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
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchState();
    const interval = setInterval(fetchState, 15000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setLockTimer(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

    const handleAcquireTabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl) return alert('Enter a target URL.');
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
        // FIX: Toont nu ALTIJD de exacte serverfout (zoals Stripe token missend of database timeout)
        alert(errData.error || "Transaction refused.");
        setIsSubmitting(false);
        return;
      }
      if (errData.url) window.location.href = errData.url;
    } catch (err) {
      alert("Network timeout communicating with backend.");
      setIsSubmitting(false);
    }
  };
      if (!res.ok) {
        alert("Feed is currently locked or text was flagged by automated moderation.");
        setIsSubmitting(false);
        return;
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
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
    if (!s || s <= 0 || s > 5400) return "00:00";
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#060608] flex flex-col font-sans text-neutral-200 select-none overflow-hidden">
      {/* High-Contrast Sport Header */}
      <header className="h-16 bg-[#0D0D11] border-b border-neutral-800/80 flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-black text-xs sm:text-sm tracking-[0.2em] uppercase text-neutral-100">The Only Tab</span>
        </div>
        
        {/* GLOBAL SPORT TICKER */}
        <div className="hidden md:flex items-center gap-6 bg-[#13131A] border border-neutral-800 px-6 py-2 rounded-xl text-xs font-bold shadow-inner">
          <div className="flex items-center gap-1.5 border-r border-neutral-800 pr-4">
            <Globe size={13} className="text-neutral-500" />
            <span className="text-emerald-400 font-mono truncate max-w-[180px]">{slot?.currentUrl?.replace('https://', '') || 'System Idle'}</span>
          </div>
          <div className="border-r border-neutral-800 pr-4">
            <span className="text-neutral-100 font-mono">\${slot?.current_bid || '0.00'} PAID</span>
            <span className="text-neutral-500 mx-2">·</span>
            <span className="text-amber-400 font-mono">STEAL FOR \${slot?.stealPrice || '19.00'}</span>
          </div>
          <div className={`font-mono ${lockTimer > 0 ? 'text-red-400' : 'text-emerald-400 animate-pulse'}`}>
            {formatLockClock(lockTimer)}
          </div>
        </div>

        <button type="button" onClick={() => setIsFormOpen(true)} className="h-9 px-5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 text-xs font-black flex items-center gap-1 active:scale-[0.97]">
          <span>Steal Feed</span>
          <ArrowUpRight size={13} />
        </button>
      </header>

      {/* Container Stack */}
      <div className="flex-1 w-full flex flex-col lg:flex-row relative overflow-hidden">
        {/* Slidable Intake Configuration Overlay */}
        <div className={`fixed lg:absolute top-0 left-0 h-full w-full sm:w-80 bg-[#0D0D11] border-r border-neutral-800/80 z-30 transform transition-transform duration-300 flex flex-col ${isFormOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 border-b border-neutral-800/80 flex items-center justify-between">
            <h3 className="font-black text-xs uppercase tracking-widest text-neutral-100">Initiate Takeover</h3>
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-xs text-neutral-500 hover:text-white bg-[#13131A] border border-neutral-800 px-3 py-1 rounded-lg"><X size={12} /></button>
          </div>
          <form onSubmit={handleAcquireTabSubmit} className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1.5">Target Website URL *</label>
              <input type="text" required placeholder="example.com" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} className="w-full bg-[#13131A] border border-neutral-800 rounded-xl h-11 px-4 text-xs font-mono text-neutral-200 outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1.5">Display Name</label>
              <input type="text" placeholder="Brand / Alias" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-[#13131A] border border-neutral-800 rounded-xl h-11 px-4 text-xs text-neutral-200 outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1.5">Custom Overlay Label (Max 15 Chars)</label>
              <input type="text" maxLength={15} placeholder="LIVE CLIP TEXT" value={overlayLabel} onChange={(e) => setOverlayLabel(e.target.value)} className="w-full bg-[#13131A] border border-neutral-800 rounded-xl h-11 px-4 text-xs text-neutral-200 outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1.5">Optional Start Path / Hash</label>
              <input type="text" placeholder="/pricing" value={startPath} onChange={(e) => setStartPath(e.target.value)} className="w-full bg-[#13131A] border border-neutral-800 rounded-xl h-11 px-4 text-xs font-mono text-neutral-200 outline-none" />
            </div>

            {/* LEGAL LIABILITY GIRDLE BLOCK */}
            <div className="bg-[#13131A] border border-neutral-800/80 p-3.5 rounded-xl space-y-2 mt-1">
              <p className="text-[9px] text-neutral-500 leading-normal text-left font-medium">
                Purchases are strictly **non-refundable**. If your stream is outbid ("stolen"), no refunds apply. Malware, pornography, or illegal material will be slashed immediately without warning. This platform is protected under Safe Harbor intermediaries directives.
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer pt-1.5 border-t border-neutral-800/60 select-none">
                <input 
                  type="checkbox" 
                  required 
                  checked={legalAgreed} 
                  onChange={(e) => setLegalAgreed(e.target.checked)} 
                  className="mt-0.5 accent-emerald-500 h-3.5 w-3.5 border-neutral-800 rounded bg-[#060608]" 
                />
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wide">I accept the Terms</span>
              </label>
            </div>

            <div className="bg-[#13131A] border border-neutral-800/60 p-3 rounded-xl text-center mt-1">
              <span className="text-xl font-mono font-black text-amber-400">\${slot?.stealPrice || '19.00'}</span>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting || lockTimer > 0 || !legalAgreed} 
              className="w-full bg-neutral-100 hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-900 font-black h-11 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
            >
              <span>{isSubmitting ? 'Opening Stripe...' : lockTimer > 0 ? 'FEED LOCKED' : !legalAgreed ? 'ACCEPT TERMS' : 'Pay & Take Stage'}</span>
            </button>
          </form>
        </div>

        {/* Video Canvas Presentation Layer */}
        <div className="flex-1 h-full bg-[#060608] p-4 sm:p-8 flex flex-col items-center justify-center relative overflow-y-auto">
          {/* MOBILE TICKER SUMMARY */}
          <div className="w-full max-w-4xl md:hidden bg-[#0D0D11] border border-neutral-800 p-4 rounded-xl mb-4 text-center font-bold text-xs space-y-2">
            <div className="text-neutral-400 truncate">NOW: <span className="text-emerald-400 font-mono">{slot?.currentUrl || 'System Idle'}</span></div>
            <div className="flex justify-around border-t border-neutral-800/60 pt-2 text-[11px]">
              <span className="text-neutral-400">\${slot?.current_bid || '0.00'} PAID</span>
              <span className="text-amber-400">STEAL: \${slot?.stealPrice || '19.00'}</span>
              <span className={lockTimer > 0 ? 'text-red-400' : 'text-emerald-400'}>{lockTimer > 0 ? 'LOCKED' : 'OPEN'}</span>
            </div>
          </div>

          <div className="w-full max-w-4xl aspect-video bg-[#0D0D11] border border-neutral-800/80 rounded-2xl overflow-hidden shadow-2xl relative flex items-center justify-center">
            <canvas ref={canvasRef} className={`w-full h-full object-contain ${!hasFrames ? 'hidden' : 'block'}`} />
            
            {!hasFrames && (
              <div className="absolute inset-0 bg-[#060608] flex flex-col items-center justify-center font-sans overflow-hidden">
                <div className="absolute w-[250px] h-[250px] bg-emerald-500/5 rounded-full blur-[80px] animate-pulse" />
                <div className="flex flex-col items-center gap-4 z-10">
                  <div className="relative flex items-center justify-center w-14 h-14 bg-[#0D0D11] border border-neutral-800/80 rounded-2xl shadow-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/20 to-transparent opacity-50 animate-pulse" />
                    <Zap size={22} className="text-emerald-400 animate-bounce" style={{ animationDuration: '3s' }} />
                  </div>
                  <div className="text-center space-y-1">
                    <h1 className="text-white text-xs font-black tracking-[0.25em] uppercase pl-[0.25em]">The Only Tab</h1>
                    <p className="text-[9px] text-neutral-500 font-bold uppercase tracking-[0.3em] pl-[0.3em] animate-pulse">Awaiting Takeover</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Subheader Dashboard Metrics Under Video */}
          <div className="w-full max-w-4xl mt-6 flex items-center justify-between bg-[#0D0D11] border border-neutral-800/80 p-4 rounded-xl shadow-xl">
            <div className="flex items-center gap-8">
              <div>
                <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest block mb-1">On Stage</span>
                <span className="text-xs font-bold text-neutral-200">{slot?.displayName || 'System Idle'}</span>
              </div>
              <div>
                <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest block mb-1">Time On Stage</span>
                <span className="text-xs font-mono font-bold text-neutral-400">{formatStageClock(slot?.secondsOnStage || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
