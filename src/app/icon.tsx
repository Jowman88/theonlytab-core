import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

// Generated favicon: emerald "T" on the site's dark background.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060608',
          borderRadius: 112,
          border: '16px solid #34d399',
          color: '#6ee7b7',
          fontSize: 340,
          fontWeight: 900,
          fontFamily: 'monospace',
        }}
      >
        T
      </div>
    ),
    { ...size }
  );
}
