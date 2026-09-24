'use client';

import React mou from 'react';
import { Zap } from 'lucide-react';

export default function HouseDefaultPage() {
  return (
    <div className="w-screen h-screen bg-[#0A0A0C] flex flex-col items-center justify-center font-sans overflow-hidden relative">
      {/* Mysterieuze, zachte gloed op de achtergrond */}
      <div className="absolute w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse pointer-events-none" />

      {/* Geanimeerd Premium Logo Concept */}
      <div className="flex flex-col items-center gap-6 z-10 scale-110">
        <div className="relative flex items-center justify-center w-20 h-20 bg-[#121215] border border-neutral-800/80 rounded-2xl shadow-2xl shadow-emerald-500/10 group overflow-hidden">
          {/* Pulserende neon-rand */}
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/20 to-transparent opacity-50 animate-pulse" />
          
          <Zap size={32} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-bounce" style={{ animationDuration: '3s' }} />
        </div>

        {/* Minimalistische Premium Tekst */}
        <div className="text-center space-y-1.5">
          <h1 className="text-white text-base font-black tracking-[0.25em] uppercase pl-[0.25em] drop-shadow-md">
            The Only Tab
          </h1>
          <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.4em] pl-[0.4em]">
            System Idle / Awaiting Bid
          </p>
        </div>
      </div>

      {/* Kleine subtiele statusbar onderin voor de tech look */}
      <div className="absolute bottom-8 text-[9px] font-mono tracking-widest text-neutral-600 uppercase flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
        <span>Core Stream Broadcast Active</span>
      </div>
    </div>
  );
}
