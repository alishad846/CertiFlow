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
    <div className={styles.gridPattern} />

    <section className={styles.authShell}>
      <div className={styles.infoPanel}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark} aria-hidden="true">
  <svg
    viewBox="0 0 24 24"
    className={styles.logoIcon}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 3.5L19 6.5V11.4C19 15.8 16.15 19.8 12 21C7.85 19.8 5 15.8 5 11.4V6.5L12 3.5Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M9 12L11.1 14.1L15.5 9.8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
</span>
          <span className={styles.logoText}>
            <span className={styles.logoName}>CertiFlow</span>
            <span className={styles.logoTagline}>Bulk certificates, credits, and delivery control</span>
          </span>
        </Link>

        <div>
          <p className={styles.eyebrow}>Certificate operations</p>
          <h1 className={styles.heroTitle}>Manage bulk certificates without the manual mess.</h1>
          <p className={styles.heroText}>
            Sign in to upload batches, track delivery, manage credits, and keep certificate workflows moving.
          </p>
        </div>

        <div className={styles.statsRow}>
          <div>
            <strong>50k+</strong>
            <span>Certificates</span>
          </div>
          <div>
            <strong>99%</strong>
            <span>Delivery clarity</span>
          </div>
        </div>
      </div>

      <section className={styles.card}>
        <p className={styles.brand}>Welcome back</p>
        <h2 className={styles.title}>Sign in to your account</h2>
        <p className={styles.description}>Use your CertiFlow credentials to continue.</p>

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
              Email address
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
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="login-password">
                Password
              </label>
              <Link href="/forgot-password" className={styles.link}>
                Forgot?
              </Link>
            </div>

            <input
              id="login-password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className={styles.footer}>
          New to CertiFlow?{' '}
          <Link href="/register" className={styles.link}>
            Create account
          </Link>
        </p>
      </section>
    </section>
  </main>
);
}
