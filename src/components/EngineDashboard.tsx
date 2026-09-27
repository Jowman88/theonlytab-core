'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { ShieldCheck, Zap, ArrowUpRight, ShieldAlert, Globe, X, Link2, User, ChevronRight, Lock, Unlock, History, Type, Hash } from 'lucide-react';

interface SlotData {
  id: string;
  currentUrl?: string;
  displayName?: string;
  current_bid?: string;
  stealPrice?: string;
  secondsOnStage?: number;
  secondsLeftInLock?: number;
  isLocked?: boolean;
}

export default function EngineDashboard({ streamServerUrl }: { streamServerUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [slot, setSlot] = useState<SlotData | null>(null);
  const [lockTimer, setLockTimer] = useState<number>(0);
  const [reportCount, setReportCount] = useState<number>(0);

  // Formulier statussen
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [overlayLabel, setOverlayLabel] = useState<string>('');
  const [startPath, setStartPath] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
          const rawData = payload?.data;
          
          if (rawData) {
            setSlot(rawData);
            setLockTimer(Number(rawData.secondsLeftInLock) || 0);
          }
        }
      } catch (e) {
        console.error("Fetch state error sync", e);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 4000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setLockTimer(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAcquireTabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl) return alert('Please enter a valid target URL.');
    if (overlayLabel.length > 15) return alert('Overlay label must be 15 characters or less.');
    
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

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Feed is locked or transaction failed.");
        setIsSubmitting(false);
        return;
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
      alert("Something went wrong communicating with Stripe.");
      setIsSubmitting(false);
    }
  };

  const formatLockClock = (s: number) => {
    if (!s || isNaN(s) || s <= 0) return "OPEN TO STEAL";
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `LOCKED ${mins}:${secs}`;
  };

  const formatStageClock = (s: number) => {
    if (!s || isNaN(s) || s <= 0) return "00:00";
    if (s > 5400) return "00:00"; 
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#060608] flex flex-col font-sans antialiased text-neutral-200 select-none overflow-hidden">
      {/* High-Contrast Sport Header */}
      <header className="h-16 bg-[#0D0D11] border-b border-neutral-800/80 flex items-center justify-between px-6 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="font-black text-xs sm:text-sm tracking-[0.2em] uppercase text-neutral-100">The Only Tab</span>
        </div>
        
        {/* HUGE GLOBAL SPORT TICKER */}
        <div className="hidden md:flex items-center gap-6 bg-[#13131A] border border-neutral-800 px-6 py-2 rounded-xl text-xs font-bold shadow-inner">
          <div className="flex items-center gap-1.5 border-r border-neutral-800 pr-4">
            <Globe size={13} className="text-neutral-500" />
            <span className="text-neutral-400 uppercase tracking-wider text-[10px]">NOW:</span>
            <span className="text-emerald-400 font-mono truncate max-w-[180px]">{slot?.currentUrl?.replace('https://', '') || 'System Idle'}</span>
          </div>
          <div className="border-r border-neutral-800 pr-4">
            <span className="text-neutral-100 font-mono">${slot?.current_bid || '0.00'} PAID</span>
            <span className="text-neutral-500 mx-2">·</span>
            <span className="text-neutral-400">STEAL FOR </span>
            <span className="text-amber-400 font-mono">${slot?.stealPrice || '19.00'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-mono ${lockTimer > 0 ? 'text-red-400' : 'text-emerald-400 animate-pulse'}`}>
              {formatLockClock(lockTimer)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="h-9 px-5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 text-xs font-black transition-all flex items-center gap-1 shadow-lg active:scale-[0.97]"
        >
          <span>Steal Feed</span>
          <ArrowUpRight size={13} />
        </button>
      </header>

      {/* Main Container Area */}
      <div className="flex-1 w-full flex flex-col lg:flex-row relative overflow-hidden">
        
        {/* Slidable Intake Configuration Overlay */}
        <div className={`fixed lg:absolute top-0 left-0 h-full w-full sm:w-80 bg-[#0D0D11] border-r border-neutral-800/80 z-30 transform transition-transform duration-300 flex flex-col ${isFormOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 border-b border-neutral-800/80 flex items-center justify-between">
            <h3 className="font-black text-xs uppercase tracking-widest text-neutral-100">Initiate Takeover</h3>
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-xs text-neutral-500 hover:text-white bg-[#13131A] border border-neutral-800 px-3 py-1 rounded-lg transition-colors flex items-center gap-1">
              <X size={12} />
              <span>Cancel</span>
            </button>
          </div>
          
          <form onSubmit={handleAcquireTabSubmit} className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-1.5">Target Website URL *</label>
              <div className="relative flex items-center">
                <Link2 size={14} className="absolute left-3.5 text-neutral-500" />
                <input type="text" required placeholder="example.com" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} className="w-full bg-[#13131A] border border-neutral-800 focus:border-neutral-700 rounded-xl h-11 pl-10 pr-4 text-xs font-mono text-neutral-200 outline-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-1.5">Display Name</label>
              <div className="relative flex items-center">
                <User size={14} className="absolute left-3.5 text-neutral-500" />
                <input type="text" placeholder="Brand / Alias" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-[#13131A] border border-neutral-800 focus:border-neutral-700 rounded-xl h-11 pl-10 pr-4 text-xs text-neutral-200 outline-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-1.5">Custom Overlay Label (Max 15 Chars)</label>
              <div className="relative flex items-center">
                <Type size={14} className="absolute left-3.5 text-neutral-500" />
                <input type="text" maxLength={15} placeholder="LIVE CLIP TEXT" value={overlayLabel} onChange={(e) => setOverlayLabel(e.target.value)} className="w-full bg-[#13131A] border border-neutral-800 focus:border-neutral-700 rounded-xl h-11 pl-10 pr-4 text-xs text-neutral-200 outline-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-1.5">Optional Start Path / Hash</label>
              <div className="relative flex items-center">
                <Hash size={14} className="absolute left-3.5 text-neutral-500" />
                <input type="text" placeholder="#dashboard or /pricing" value={startPath} onChange={(e) => setStartPath(e.target.value)} className="w-full bg-[#13131A] border border-neutral-800 focus:border-neutral-700 rounded-xl h-11 pl-10 pr-4 text-xs font-mono text-neutral-200 outline-none" />
              </div>
            </div>

            <div className="bg-[#13131A] border border-neutral-800/60 p-4 rounded-xl text-center mt-2">
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block mb-0.5">Required Steal Amount</span>
              <span className="text-xl font-mono font-black text-amber-400">${slot?.stealPrice || '19.00'}</span>
            </div>

            <button type="submit" disabled={isSubmitting || lockTimer > 0} className="w-full bg-neutral-100 hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-900 font-black h-11 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98]">
              <span>{isSubmitting ? 'Opening Stripe...' : lockTimer > 0 ? 'FEED LOCKED' : 'Pay & Take Stage'}</span>
              <ChevronRight size={14} />
            </button>
          </form>
        </div>

        {/* Video Canvas Presentation Layer */}
        <div className="flex-1 h-full bg-[#060608] p-4 sm:p-8 flex flex-col items-center justify-center relative overflow-y-auto">
          {/* MOBILE TICKER SUMMARY */}
          <div className="w-full max-w-4xl md:hidden bg-[#0D0D11] border border-neutral-800 p-4 rounded-xl mb-4 text-center font-bold text-xs space-y-2">
            <div className="text-neutral-400 truncate">NOW: <span className="text-emerald-400 font-mono">{slot?.currentUrl || 'System Idle'}</span></div>
            <div className="flex justify-around border-t border-neutral-800/60 pt-2 text-[11px]">
              <span className="text-neutral-400">${slot?.current_bid || '0.00'} PAID</span>
              <span className="text-amber-400">STEAL: ${slot?.stealPrice || '19.00'}</span>
              <span className={lockTimer > 0 ? 'text-red-400' : 'text-emerald-400'}>{lockTimer > 0 ? 'LOCKED' : 'OPEN'}</span>
            </div>
          </div>

          <div className="w-full max-w-4xl aspect-video bg-[#0D0D11] border border-neutral-800/80 rounded-2xl overflow-hidden shadow-2xl relative flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full object-contain" />
            
            {/* Premium Logo Overlay */}
            <div className="absolute inset-0 bg-[#060608] flex flex-col items-center justify-center font-sans overflow-hidden pointer-events-none transition-opacity duration-500">
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
          </div>

          {/* Subheader Dashboard Metrics Under Video */}
          <div className="w-full max-w-4xl mt-6 flex items-center justify-between bg-[#0D0D11] border border-neutral-800/80 p-4 rounded-xl shadow-xl">
            <div className="flex items-center gap-8">
              <div>
                <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest block mb-1">On Stage</span>
{slot?.displayName || 'System Idle'}Time On Stage{formatStageClock(slot?.secondsOnStage || 0)}Ticker History);}
