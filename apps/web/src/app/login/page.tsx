'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import styles from '../auth.module.css';

type LoginResponse = { twoFactorRequired?: boolean; ticket?: string; user?: unknown };

export default function LoginPage() {
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ticket, setTicket] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submitCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.twoFactorRequired && res.ticket) {
        setTicket(res.ticket);
        setStep('2fa');
      } else {
        window.location.assign('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, token: code.trim() })
      });
      window.location.assign('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.orbLeft} />
      <div className={styles.orbRight} />
      <div className={styles.shell}>
        <section className={styles.card}>
          <p className={styles.brand}>CertiFlow</p>

          {step === 'credentials' ? (
            <>
              <h1 className={styles.title}>Welcome back</h1>
              <p className={styles.description}>Sign in to manage batches, credits, and delivery logs.</p>

              <form className={styles.form} onSubmit={submitCredentials}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                  />
                </div>
                <div className={styles.field}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className={styles.label} htmlFor="login-password">Password</label>
                    <Link href="/forgot-password" className={styles.link} style={{ fontSize: '0.85rem' }}>
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    className={styles.input}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                  />
                </div>

                {error ? <p className={styles.error}>{error}</p> : null}

                <button className={styles.button} type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className={styles.footer}>
                New here?{' '}
                <Link href="/register" className={styles.link}>Create an account</Link>
              </p>
            </>
          ) : (
            <>
              <h1 className={styles.title}>Two-factor</h1>
              <p className={styles.description}>
                Enter the 6 digit code from your authenticator app, or a backup code.
              </p>

              <form className={styles.form} onSubmit={submitCode}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="login-2fa">Authentication code</label>
                  <input
                    id="login-2fa"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className={styles.input}
                    style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.15rem' }}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="123456"
                    autoFocus
                  />
                </div>

                {error ? <p className={styles.error}>{error}</p> : null}

                <button className={styles.button} type="submit" disabled={loading}>
                  {loading ? 'Verifying…' : 'Verify & sign in'}
                </button>
              </form>

              <p className={styles.footer}>
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setError(''); setCode(''); }}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, font: 'inherit' }}
                  className={styles.link}
                >
                  ← Back to sign in
                </button>
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
