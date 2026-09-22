'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { ShieldCheck, Zap, ArrowUpRight, ShieldAlert } from 'lucide-react';

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
    const res = await fetch('/api/report-tab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: slot.id })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'slot_slashed_and_blacklisted') {
        alert("Removed due to community flags.");
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
        alert(errData.error || "Failed to initiate payment.");
        return;
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
   } catch (err: any) {
  console.error(err);
  alert(`FRONTEND_ERROR: ${err.message || 'Network/CORS block'}`);
}
  };

  const formatClock = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-neutral-50 flex flex-col font-sans antialiased text-neutral-900 select-none overflow-hidden">
      <header className="h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-6 z-20 shadow-sm">
        <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /><span className="font-bold text-sm">The Only Tab</span></div>
        <button onClick={triggerReportSlasher} className="flex items-center gap-1.5 text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 font-medium transition-colors">
          <ShieldAlert size={12} /><span>Flag Content {reportCount > 0 ? `(${reportCount}/5)` : ''}</span>
        </button>
      </header>
      <main className="flex-1 w-full bg-neutral-100 flex items-center justify-center p-6 relative">
        <div className="w-full max-w-5xl h-full flex flex-col justify-center">
          <div className="bg-white border-t border-x border-neutral-200 rounded-t-xl px-4 py-2 flex items-center text-xs text-neutral-500"><ShieldCheck size={14} className="text-emerald-500 mr-2" /><span className="truncate font-medium">{slot?.currentUrl || 'Synchronizing node feed...'}</span></div>
          <div className="flex-1 bg-white border border-neutral-200 rounded-b-xl shadow-xl overflow-hidden p-1 flex items-center justify-center min-h-0"><canvas ref={canvasRef} className="w-full h-full aspect-video rounded-lg bg-neutral-50 object-contain max-h-full" /></div>
        </div>
      </main>
      <footer className="h-20 bg-white border-t border-neutral-200 flex items-center justify-between px-8 z-20 shadow-inner">
        <div className="flex gap-12 items-center">
          <div><span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-0.5">Active Space</span><span className="text-neutral-800 font-semibold text-sm max-w-[200px] truncate block">{slot?.displayName || 'Idle'}</span></div>
          <div className="w-[1px] h-8 bg-neutral-200" />
          <div><span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-0.5">Value</span><span className="text-neutral-900 font-black text-base block">\${slot?.current_bid ? parseFloat(slot.current_bid).toFixed(2) : '0.00'}</span></div>
          <div className="w-[1px] h-8 bg-neutral-200" />
          <div><span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-0.5">Burn Ticker</span><span className="font-mono text-base font-black text-neutral-700 block">{formatClock(secondsLeft)}</span></div>
        </div>
        <button onClick={handleAcquireTab} className="flex items-center gap-1.5 bg-neutral-900 text-white hover:bg-black font-semibold text-xs h-11 px-5 rounded-lg border border-neutral-800">
          <Zap size={12} className="fill-white" /><span>Acquire Tab for \${slot?.current_bid ? (parseFloat(slot.current_bid) + 1.00).toFixed(2) : '1.00'}</span><ArrowUpRight size={12} className="text-neutral-400" />
        </button>
      </footer>
    </div>
  );
}
