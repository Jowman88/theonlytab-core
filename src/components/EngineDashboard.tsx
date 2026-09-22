'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { ShieldCheck, Zap, ArrowUpRight, ShieldAlert, Globe } from 'lucide-react';

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

  useEffect(() => {
    const socket = io(streamServerUrl);
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
      const res = await fetch('/api/get-active-slot');
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
    if (!slot?.id) return;
    const confirmFlag = window.confirm("Weet je zeker dat je deze inhoud wilt rapporteren wegens misbruik?");
    if (!confirmFlag) return;

    const res = await fetch('/api/report-tab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: slot.id })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'slot_slashed_and_blacklisted') {
        alert("Inhoud verwijderd wegens community flags.");
      } else {
        setReportCount(data.current_count);
      }
    }
  };

  const handleAcquireTab = async () => {
    try {
      const currentBidVal = slot?.current_bid ? parseFloat(slot.current_bid) : 0;
      const nextBid = (currentBidVal <= 0 ? 1.00 : currentBidVal + 1.00).toFixed(2);

      const res = await fetch('https://theonlytab.io', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incomingBidAmount: nextBid,
          displayName: 'Premium Tester',
          targetUrl: 'https://theonlytab.io',
          xHandle: 'tester'
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || "Inleiding betaling mislukt.");
        return;
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
      alert("Er ging iets mis bij het openen van Stripe.");
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
        
        {/* Subtiele live URL status in de header */}
        <div className="flex items-center gap-2 bg-[#1C1C21] border border-neutral-800 px-4 py-1.5 rounded-full text-xs text-neutral-400 shadow-inner max-w-md">
          <Globe size={12} className="text-neutral-500 shrink-0" />
          <span className="truncate font-mono tracking-tight">{slot?.currentUrl || 'synchronizing_node_feed...'}</span>
        </div>
        <div className="w-24" /> {/* Flex balancer */}
      </header>

      {/* Main Canvas Area */}
      <main className="flex-1 w-full flex items-center justify-center p-8 relative bg-radial-gradient">
        <div className="w-full max-w-5xl h-full flex flex-col justify-center">
          {/* Het Canvas - Gestyled als een high-end high-definition display */}
          <div className="flex-1 bg-[#121215] border border-neutral-800/80 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden p-1.5 flex items-center justify-center min-h-0 ring-1 ring-white/5">
            <canvas ref={canvasRef} className="w-full h-full aspect-video rounded-xl bg-[#030303] object-contain max-h-full transition-all duration-500" />
          </div>
        </div>
      </main>

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

        {/* Cta & Subtiele Flag-beveiliging groep */}
        <div className="flex items-center gap-4">
          {/* Subtiel verborgen Flag Icoontje om misbruik te remmen */}
          <button 
            onClick={triggerReportSlasher} 
            title="Rapporteer ongepaste inhoud"
            className="p-3 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/20 transition-all duration-200"
          >
            <ShieldAlert size={16} />
            {reportCount > 0 && <span className="text-[10px] ml-1 font-bold">({reportCount})</span>}
          </button>

          {/* Premium Buy Button */}
          <button 
            onClick={handleAcquireTab} 
            className="flex items-center gap-2 bg-white text-black hover:bg-neutral-200 active:scale-[0.98] font-bold text-xs h-12 px-6 rounded-xl transition-all duration-200 shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
          >
            <Zap size={13} className="fill-black" />
            <span>Acquire Tab for \${slot?.current_bid ? (parseFloat(slot.current_bid) + 1.00).toFixed(2) : '1.00'}</span>
            <ArrowUpRight size={13} className="opacity-60" />
          </button>
        </div>
      </footer>
    </div>
  );
}
