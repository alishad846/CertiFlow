export default function NotFoundPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Page not found</h1>
        <p style={{ color: '#475569' }}>The page you&apos;re looking for does not exist.</p>
      </div>
    </main>
  );
}
