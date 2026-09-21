import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Only Tab — One Slot. Total Attention.',
  description: 'The singular, live-streamed browser billboard window for the entire internet.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-neutral-50">
      <body className="h-full antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
