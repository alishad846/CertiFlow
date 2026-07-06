'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import styles from '../auth.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <main className={styles.page}>
      <div className={styles.orbLeft} />
      <div className={styles.orbRight} />
      <div className={styles.shell}>
        <section className={styles.card}>
          <p className={styles.brand}>CertiFlow</p>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.description}>Sign in to manage batches, credits, and delivery logs.</p>

          <form
          className={styles.form}
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            setLoading(true);
            try {
              await apiFetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
              });
              window.location.assign('/dashboard');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Login failed');
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-email">
              Email
            </label>
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
              <label className={styles.label} htmlFor="login-password">
                Password
              </label>
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
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          </form>

        <p className={styles.footer}>
          New here?{' '}
          <Link href="/register" className={styles.link}>
            Create an account
          </Link>
        </p>
        </section>
      </div>
    </main>
  );
}
