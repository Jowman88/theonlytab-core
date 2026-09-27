'use client';

import React, { useEffect, useState } from 'react';
import { Zap, ArrowUpRight } from 'lucide-react';

export default function DethronedEmbed() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchEmbedState = async () => {
      try {
        const res = await fetch('/api/get-active-tab');
        if (res.ok) {
          const payload = await res.json();
          setData(payload?.data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchEmbedState();
    const interval = setInterval(fetchEmbedState, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full min-h-[130px] bg-[#0B0B0F] border border-neutral-800 rounded-xl p-4 flex flex-col justify-between font-mono text-neutral-200 select-none antialiased box-border overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-amber-500 animate-pulse" />
          <span className="text-[10px] font-black tracking-widest text-neutral-400 uppercase">THE ONLY TAB · DETHRONED</span>
        </div>
        <div className="text-[10px] font-bold text-neutral-500 uppercase">
          STAGE PRICE: <span className="text-amber-400">${data?.stealPrice || '19.00'}</span>
        </div>
      </div>

      <div className="my-2 text-xs font-bold leading-normal truncate text-neutral-400">
        We were knocked off air. Currently on stage:{" "}
        <span className="text-white font-black text-emerald-400">
          {data?.currentUrl?.replace('https://', '') || 'System Idle'}
        </span>
      </div>

      <a
        href="https://theonlytab.io"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full h-9 bg-neutral-100 hover:bg-white text-neutral-950 text-[11px] font-black tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 no-underline active:scale-[0.98]"
      >
        <span>RECLAIM FEED INSTANTLY</span>
        <ArrowUpRight size={13} />
      </a>
    </div>
  );
}
