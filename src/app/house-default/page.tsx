'use client';

import React from 'react';
import { Zap, Shield, Layout, Radio } from 'lucide-react';

export default function HouseDefaultPage() {
  return (
    <div className="w-screen h-screen bg-[#060608] flex flex-col items-center justify-center font-sans antialiased text-neutral-400 select-none overflow-hidden relative">
      
      {/* Geometrische High-Tech Achtergrond Gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-500/5 via-purple-500/5 to-transparent rounded-full blur-[140px] pointer-events-none animate-[pulse_8s_infinite_alternate]" />
      <div className="absolute top-1/4 left-1/3 w-[300px] h-[300px] bg-emerald-500/[0.02] rounded-full blur-[100px] pointer-events-none" />

      <div className="flex flex-col items-center gap-8 max-w-md text-center px-8 z-10">
        
        {/* Het Ultramoderne Gelaagde Logo */}
        <div className="relative group">
          {/* Externe gloed achter het logo */}
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
          
          {/* De Core Container */}
          <div className="relative flex items-center justify-center w-24 h-24 bg-[#0D0D12]/90 border border-neutral-800/80 rounded-3xl shadow-[0_30px_70px_rgba(0,0,0,0.9)] ring-1 ring-white/5 transition-transform duration-500 group-hover:scale-[1.02]">
            
            {/* Abstracte 'Gelaagde Tab' Behuizing (Binnenkant) */}
            <div className="absolute inset-2 border border-neutral-800/40 rounded-[20px] bg-[#121218]/40 flex items-center justify-center">
              
              {/* De Futuritische Bliksem / Core Icon */}
              <Zap size={36} className="text-white fill-white/[0.03] drop-shadow-[0_0_15px_rgba(255,255,255,0.7)] animate-[pulse_3s_infinite_alternate]" />
            </div>

            {/* Subtiel Radar/Uitzendingsstipje linksboven */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]"></span>
            </span>
          </div>
        </div>

        {/* Typografie & Branding */}
        <div className="space-y-3">
          <h1 className="text-2xl font-black uppercase tracking-[0.25em] bg-gradient-to-b from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent drop-shadow-sm">
            The Only Tab
          </h1>
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-neutral-800 to-transparent mx-auto" />
          <p className="text-xs text-neutral-500 leading-relaxed font-medium max-w-xs mx-auto">
            Broadcast network currently idle. Secure this premium space to launch your project live instantly.
          </p>
        </div>

        {/* High-End Status Ticker */}
        <div className="mt-2 flex items-center gap-2 bg-[#0D0D12]/60 backdrop-blur-sm border border-neutral-800/80 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-neutral-400 shadow-[inner_0_1px_0_rgba(255,255,255,0.05)]">
          <Radio size={12} className="text-indigo-400 animate-pulse" />
          <span>Status: <span className="text-indigo-400">Ready for takeover</span></span>
        </div>

      </div>

      {/* Subtiele minimalistische copyright / footer in het videoscherm */}
      <div className="absolute bottom-6 text-[9px] font-mono tracking-widest text-neutral-600 uppercase">
        Node: Live_Feed_Secure // Port 8080
      </div>
    </div>
  );
}
