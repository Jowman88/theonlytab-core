'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { ShieldCheck, Zap, ArrowUpRight, ShieldAlert, Globe, X, Link2, User, ChevronRight } from 'lucide-react';

interface SlotData {
  id: string;
  currentUrl?: string;
  displayName?: string;
  current_bid?: string;
  expiresAt?: string;
}

export default function EngineDashboard({ streamServerUrl }: { streamServerUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [slot, setSlot] = useState<SlotData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [reportCount, setReportCount] = useState<number>(0);

  // Formulier statussen
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [xHandle, setXHandle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const socket = io(streamServerUrl, { transports: ['websocket'] });
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
      const res = await fetch('/api/get-active-tab');
      if (res.ok) {
        const payload = await res.json();
        setSlot(payload.data);
        if (payload.data?.expiresAt) {
          setSecondsLeft(Math.max(0, Math.floor((new Date(payload.data.expiresAt).getTime() - Date.now()) / 1000)));
        }
      }
    };
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerReportSlasher = async () => {
    const confirmFlag = window.confirm("Are you sure you want to report/flag this content??");
    if (!confirmFlag) return;

    const res = await fetch('/api/report-tab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: slot.id })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'slot_slashed_and_blacklisted') {
        alert("Content removed due to community flags.");
      } else {
        setReportCount(data.current_count);
      }
    }
  };
  const handleAcquireTabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl) return alert('Please enter a valid target URL.');
    
    setIsSubmitting(true);
    try {
      const currentBidVal = slot?.current_bid ? parseFloat(slot.current_bid) : 0;
      const nextBid = (currentBidVal <= 0 ? 1.00 : currentBidVal + 1.00).toFixed(2);

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incomingBidAmount: nextBid,
          displayName: displayName || 'Anonymous Tester',
          targetUrl: targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`,
          xHandle: xHandle || 'anonymous'
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Failed to initiate payment.");
        setIsSubmitting(false);
        return;
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
      alert("Something went wrong opening Stripe.");
      setIsSubmitting(false);
    }
  };

  const formatClock = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#0A0A0C] flex flex-col font-sans antialiased text-neutral-200 select-none overflow-hidden">
      {/* Premium Header */}
      <header className="h-16 bg-[#121215]/80 backdrop-blur-md border-b border-neutral-800/60 flex items-center justify-between px-8 z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="font-extrabold text-sm tracking-wider uppercase text-neutral-100">The Only Tab</span>
        </div>
        
        <div className="flex items-center gap-2 bg-[#1C1C21] border border-neutral-800 px-4 py-1.5 rounded-full text-xs text-neutral-400 shadow-inner max-w-md">
          <Globe size={12} className="text-neutral-500 shrink-0" />
          <span className="truncate font-mono tracking-tight">{slot?.currentUrl || 'synchronizing_node_feed...'}</span>
        </div>
        <div className="w-24" />
      </header>

      {/* Main Container Area */}
      <div className="flex-1 w-full flex relative overflow-hidden">
        
        {/* Dynamic Drawer / Formulier Paneel */}
        <div className={`absolute lg:relative top-0 left-0 h-full w-80 bg-[#121215] border-r border-neutral-800/60 z-30 transform transition-transform duration-300 flex flex-col ${isFormOpen ? 'translate-x-0' : '-translate-x-full lg:absolute'}`}>
          <div className="p-6 border-b border-neutral-800/60 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-100">Configure Your Tab</h3>
            <button 
              type="button"
              onClick={() => setIsFormOpen(false)} 
              className="text-xs text-neutral-500 hover:text-white font-medium bg-[#1C1C21] border border-neutral-800 hover:border-neutral-700 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
            >
              <X size={12} />
              <span>Cancel</span>
            </button>
          </div>
          <form onSubmit={handleAcquireTabSubmit} className="p-6 flex-1 flex flex-col gap-5 overflow-y-auto">
            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-2">Target Website URL *</label>
              <div className="relative flex items-center">
                <Link2 size={14} className="absolute left-3.5 text-neutral-500" />
                <input 
                  type="text" 
                  required
                  placeholder="example.com"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full bg-[#1C1C21] border border-neutral-800 focus:border-neutral-700 rounded-xl h-11 pl-10 pr-4 text-xs font-mono text-neutral-200 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-2">Display Name</label>
              <div className="relative flex items-center">
                <User size={14} className="absolute left-3.5 text-neutral-500" />
                <input 
                  type="text" 
                  placeholder="Your Brand / Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#1C1C21] border border-neutral-800 focus:border-neutral-700 rounded-xl h-11 pl-10 pr-4 text-xs text-neutral-200 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-2">X (Twitter) Handle</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-xs text-neutral-500 font-mono">@</span>
                <input 
                  type="text" 
                  placeholder="username"
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value)}
                  className="w-full bg-[#1C1C21] border border-neutral-800 focus:border-neutral-700 rounded-xl h-11 pl-10 pr-4 text-xs font-mono text-neutral-200 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="mt-auto pt-4">
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-neutral-200 disabled:opacity-50 font-bold text-xs h-12 rounded-xl transition-all shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
              >
                <span>{isSubmitting ? 'Connecting...' : 'Proceed to Payment'}</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </form>
        </div>

        {/* Video Canvas Container */}
        <main className="flex-1 w-full flex items-center justify-center p-8 relative bg-radial-gradient">
          <div className="w-full max-w-5xl h-full flex flex-col justify-center">
            <div className="flex-1 bg-[#121215] border border-neutral-800/80 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden p-1.5 flex items-center justify-center min-h-0 ring-1 ring-white/5">
              <canvas ref={canvasRef} className="w-full h-full aspect-video rounded-xl bg-[#030303] object-contain max-h-full" />
            </div>
          </div>
        </main>
      </div>

      {/* Premium Footer */}
      <footer className="h-24 bg-[#121215]/90 backdrop-blur-md border-t border-neutral-800/60 flex items-center justify-between px-10 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex gap-16 items-center">
          <div>
            <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest block mb-1">Active Space</span>
            <span className="text-neutral-200 font-bold text-sm tracking-wide max-w-[180px] truncate block">{slot?.displayName || 'System Idle'}</span>
          </div>
          <div className="w-[1px] h-10 bg-neutral-800/80" />
          <div>
            <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest block mb-1">Current Value</span>
            <span className="text-white font-black text-xl tracking-tight block">
              \${slot?.current_bid ? parseFloat(slot.current_bid).toFixed(2) : '0.00'}
            </span>
          </div>
          <div className="w-[1px] h-10 bg-neutral-800/80" />
          <div>
            <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest block mb-1">Time Remaining</span>
            <span className="font-mono text-xl font-bold text-neutral-300 tracking-wide block bg-[#1C1C21] px-3 py-0.5 rounded-md border border-neutral-800/60">
              {formatClock(secondsLeft)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={triggerReportSlasher} 
            title="Rapproteer ongepaste inhoud"
            className="p-3 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/20 transition-all duration-200"
          >
            <ShieldAlert size={16} />
            {reportCount > 0 && <span className="text-[10px] ml-1 font-bold">({reportCount})</span>}
          </button>

          {!isFormOpen ? (
            <button 
              onClick={() => setIsFormOpen(true)} 
              className="flex items-center gap-2 bg-white text-black hover:bg-neutral-200 active:scale-[0.98] font-bold text-xs h-12 px-6 rounded-xl transition-all duration-200 shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
            >
              <Zap size={13} className="fill-black" />
              <span>Acquire Tab for \${slot?.current_bid ? (parseFloat(slot.current_bid) + 1.00).toFixed(2) : '1.00'}</span>
              <ArrowUpRight size={13} className="opacity-60" />
            </button>
          ) : (
            <div className="text-xs text-neutral-500 font-medium italic animate-pulse pr-4">
              Fill out the form on the left...
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
