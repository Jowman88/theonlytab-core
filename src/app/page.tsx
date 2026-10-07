import React from 'react';
import EngineDashboard from '../components/EngineDashboard';

export const dynamic = 'force-dynamic';

export default function Home() {
  // The streamer URL comes from NEXT_PUBLIC_STREAM_URL (see .env.example).
  return <EngineDashboard streamServerUrl="" />;
}
