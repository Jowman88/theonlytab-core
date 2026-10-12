import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// iOS home-screen icon. iOS applies its own rounding, so this is a full-bleed square.
export default function AppleIcon() {
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
          color: '#6ee7b7',
          fontSize: 120,
          fontWeight: 900,
          fontFamily: 'monospace',
          border: '6px solid #34d399',
          boxSizing: 'border-box',
        }}
      >
        T
      </div>
    ),
    { ...size }
  );
}
