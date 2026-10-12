import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Only Tab',
    short_name: 'The Only Tab',
    description: 'The singular, live-streamed browser billboard window for the entire internet.',
    start_url: '/',
    display: 'standalone',
    background_color: '#060608',
    theme_color: '#060608',
    icons: [{ src: '/icon', sizes: '512x512', type: 'image/png' }],
  };
}
