export default function HouseDefaultPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#060608',
        color: '#e5e5e5',
        fontFamily: 'monospace',
        textAlign: 'center',
      }}
    >
      <section>
        <div style={{ fontSize: 'clamp(1.25rem, 3vw, 2.5rem)', fontWeight: 900, letterSpacing: '0.2em' }}>
          THE ONLY TAB
        </div>
        <div style={{ marginTop: '1rem', color: '#737373', fontSize: '0.8rem', letterSpacing: '0.18em' }}>
          SYSTEM IDLE · AWAITING TAKEOVER
        </div>
      </section>
    </main>
  );
}
