import React from 'react';
import EngineDashboard from '@/components/EngineDashboard';

export const dynamic = 'force-dynamic';

export default function Home() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_STREAM_URL || "ws://localhost:8080";
  return <EngineDashboard streamServerUrl={wsUrl} />;
}
