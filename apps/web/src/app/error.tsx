'use client';

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Something went wrong</h1>
        <p style={{ color: '#475569', marginBottom: '1.5rem' }}>Please try again.</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{ border: '1px solid #cbd5e1', borderRadius: '9999px', padding: '0.75rem 1.25rem' }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
