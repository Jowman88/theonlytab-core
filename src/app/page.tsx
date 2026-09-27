import React from 'react';
import EngineDashboard from '../components/EngineDashboard';

export const dynamic = 'force-dynamic';

export default function Home() {
  // 🛡️ UNBREKABLE STAGE BOOT:
  // We sturen een lege string mee. Hierdoor móet het dashboard wel terugvallen
  // op onze stabiele wss://://onrender.com string in EngineDashboard.tsx!
  return <EngineDashboard streamServerUrl="" />;
}
