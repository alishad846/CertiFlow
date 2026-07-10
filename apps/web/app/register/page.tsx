'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import styles from '../auth.module.css';

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: ''
  });
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
            <span className={styles.logoTagline}>
              Bulk certificates, credits, and delivery control
            </span>
          </span>
        </Link>

        <div>
          <p className={styles.eyebrow}>Workspace setup</p>
          <h1 className={styles.heroTitle}>
            Start managing certificates with clarity.
          </h1>
          <p className={styles.heroText}>
            Create your company workspace, invite your team, and begin sending certificates with clean tracking.
          </p>
        </div>

        <div className={styles.statsRow}>
          <div>
            <strong>Starter</strong>
            <span>Credits included</span>
          </div>
          <div>
            <strong>Admin</strong>
            <span>Workspace access</span>
          </div>
        </div>
      </div>

      <section className={styles.card}>
        <p className={styles.brand}>Get started</p>
        <h1 className={styles.title}>Create your workspace</h1>
        <p className={styles.description}>
          Set up your CertiFlow account and company profile.
        </p>

        <form
          className={styles.form}
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');

            const nameValue = form.name.trim();
            const emailValue = form.email.trim();
            const passwordValue = form.password.trim();
            const companyNameValue = form.companyName.trim();

            const missingFields = [];

            if (!nameValue) missingFields.push('Full name');
            if (!emailValue) missingFields.push('Email address');
            if (!passwordValue) missingFields.push('Password');
            if (!companyNameValue) missingFields.push('Company name');

            if (missingFields.length >= 2) {
              setError('All fields are required');
              return;
            }

            if (missingFields.length === 1) {
              setError(`${missingFields[0]} is required`);
              return;
            }

            setLoading(true);

            try {
              await apiFetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: nameValue,
                  email: emailValue,
                  password: passwordValue,
                  companyName: companyNameValue
                })
              });

              window.location.assign('/dashboard');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Registration failed');
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-name">
              Full name
            </label>
            <input
              id="register-name"
              className={styles.input}
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Enter your name"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-email">
              Email address
            </label>
            <input
              id="register-email"
              className={styles.input}
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="you@company.com"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-password">
              Password
            </label>
            <input
              id="register-password"
              className={styles.input}
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Create a password"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-companyName">
              Company name
            </label>
            <input
              id="register-companyName"
              className={styles.input}
              type="text"
              value={form.companyName}
              onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
              placeholder="Acme Learning"
            />
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link href="/login" className={styles.link}>
            Sign in
          </Link>
        </p>
      </section>
    </section>
  </main>
);
}
