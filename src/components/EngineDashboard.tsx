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

  // Form states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [xHandle, setXHandle] = useState<string>('');
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
          const rawData = Array.isArray(payload.data) ? payload.data[0] : payload.data;
          setSlot(rawData);

          if (rawData && rawData.expiresAt) {
            const parsedDate = new Date(rawData.expiresAt).getTime();
            if (!isNaN(parsedDate)) {
              setSecondsLeft(Math.max(0, Math.floor((parsedDate - Date.now()) / 1000)));
              return;
            }
          }
          setSecondsLeft(0);
        }
      } catch (e) {
        console.error("Bypass invalid date popup", e);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 15000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerReportSlasher = async () => {
    if (!slot) return;
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

  const formatClock = (s: number) => {
    if (!s || isNaN(s) || s <= 0) return "00:00";
    if (s > 86400) return "∞"; 
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#0A0A0C] flex flex-col font-sans antialiased text-neutral-200 select-none overflow-hidden">
      {/* Premium Header */}
      <header className="h-16 bg-[#121215]/80 backdrop-blur-md border-b border-neutral-800/60 flex items-center justify-between px-4 sm:px-8 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="font-extrabold text-xs sm:text-sm tracking-wider uppercase text-neutral-100">The Only Tab</span>
        </div>
        
        <div className="flex items-center gap-2 bg-[#1C1C21] border border-neutral-800 px-3 py-1 rounded-full text-[10px] sm:text-xs text-neutral-400 max-w-[160px] sm:max-w-md">
          <Globe size={10} className="text-neutral-500 shrink-0" />
          <span className="truncate font-mono tracking-tight">{slot?.currentUrl || 'The Only Tab HQ'}</span>
        </div>
        <div className="w-12 sm:w-24" />
      </header>

      {/* Main Responsive Grid Layout */}
      <div className="flex-1 w-full flex flex-col lg:flex-row relative overflow-hidden">
        
        {/* Slidable Configuration Drawer Overlay for Mobile */}
        <div className={`fixed lg:absolute top-0 left-0 h-full w-full sm:w-80 bg-[#121215] border-r border-neutral-800/60 z-30 transform transition-transform duration-300 flex flex-col ${isFormOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-neutral-100 hover:bg-white text-neutral-900 font-bold h-11 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md"
            >
              <span>{isSubmitting ? 'Opening Stripe...' : 'Acquire Live Feed'}</span>
              <ArrowUpRight size={14} />
            </button>
          </form>
        </div>

        {/* Video Canvas Presentation Layout Container */}
        <div className="flex-1 h-full bg-[#0A0A0C] p-3 sm:p-6 flex flex-col items-center justify-center relative overflow-y-auto">
          <div className="w-full max-w-4xl aspect-video bg-[#121215] border border-neutral-800/60 rounded-2xl overflow-hidden shadow-2xl relative flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full object-contain" />
            
            {/* Premium Placeholder Logo Overlay */}
            <div className="absolute inset-0 bg-[#0A0A0C] flex flex-col items-center justify-center font-sans overflow-hidden pointer-events-none transition-opacity duration-500">
              <div className="absolute w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] bg-emerald-500/5 rounded-full blur-[80px] animate-pulse" />
              <div className="flex flex-col items-center gap-4 z-10">
                <div className="relative flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-[#121215] border border-neutral-800/80 rounded-2xl shadow-xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/20 to-transparent opacity-50 animate-pulse" />
                  <Zap size={20} className="text-emerald-400 animate-bounce sm:scale-110" style={{ animationDuration: '3s' }} />
                </div>
                <div className="text-center space-y-1">
                  <h1 className="text-white text-[10px] sm:text-xs font-black tracking-[0.25em] uppercase pl-[0.25em]">
                    The Only Tab
                  </h1>
                  <p className="text-[8px] sm:text-[9px] text-neutral-500 font-bold uppercase tracking-[0.3em] pl-[0.3em] animate-pulse">
                    Awaiting Active Feed
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Fully Responsive Control Bar Panel */}
          <div className="w-full max-w-4xl mt-4 sm:mt-6 flex flex-col sm:flex-row gap-4 items-center justify-between bg-[#121215]/90 border border-neutral-800/60 p-4 rounded-xl backdrop-blur-md shadow-xl shrink-0">
            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4 sm:gap-8 border-b sm:border-b-0 border-neutral-800/60 pb-3 sm:pb-0">
              <div>
                <span className="text-[8px] sm:text-[9px] text-neutral-500 font-bold uppercase tracking-widest block mb-0.5 sm:mb-1">Active Space</span>
                <span className="text-[11px] sm:text-xs font-bold text-neutral-200">{slot?.displayName || 'System Idle'}</span>
              </div>
              <div>
                <span className="text-[8px] sm:text-[9px] text-neutral-500 font-bold uppercase tracking-widest block mb-0.5 sm:mb-1">Current Value</span>
                <span className="text-[11px] sm:text-xs font-mono font-bold text-neutral-100">{slot?.current_bid ? `$${slot.current_bid}` : '\$0.00'}</span>
              </div>
              <div>
                <span className="text-[8px] sm:text-[9px] text-neutral-500 font-bold uppercase tracking-widest block mb-0.5 sm:mb-1">Time Remaining</span>
                <span className="text-[11px] sm:text-xs font-mono font-bold text-emerald-400">{formatClock(secondsLeft)}</span>
              </div>
            </div>

            <div className="w-full sm:w-auto flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={triggerReportSlasher}
                className="flex-1 sm:flex-initial h-9 px-3 sm:px-4 rounded-lg border border-neutral-800 hover:border-red-900/60 bg-[#1C1C21] text-[11px] sm:text-xs text-neutral-400 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5"
              >
                <ShieldAlert size={12} />
                <span>Flag ({reportCount})</span>
              </button>
              
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                className="flex-1 sm:flex-initial h-9 px-4 sm:px-5 rounded-lg bg-neutral-100 hover:bg-white text-neutral-900 text-11px sm:text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-[0.97]"
              >
                <span>Bid Now</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
