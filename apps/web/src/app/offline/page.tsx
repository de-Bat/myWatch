'use client'
export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        background: 'var(--bg)',
        color: 'var(--fg)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3.43rem' }}>📡</div>
      <h1 style={{ fontSize: '1.43rem', fontWeight: 700, letterSpacing: '-0.03em', margin: 0 }}>
        You&apos;re offline
      </h1>
      <p style={{ fontSize: '1rem', color: 'var(--muted2)', margin: 0, lineHeight: 1.5, maxWidth: 280 }}>
        myWatch works offline — tap the button below to go back to your watchlist.
      </p>
      <button
        onClick={() => (window.location.href = '/')}
        style={{
          marginTop: 8,
          padding: '10px 24px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Go to Watchlist
      </button>
    </div>
  )
}
