'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import styles from '../auth.module.css';

const FIELD_LABELS: Record<string, string> = {
  name: 'Full name',
  username: 'Username',
  email: 'Email',
  password: 'Password',
  companyName: 'Company name'
};

export default function RegisterPage() {
  const [form, setForm] = useState(() => ({
    name: '',
    // Prefill the username when arriving from the login "create an account" prompt (?username=…).
    username:
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('username') ?? ''
        : '',
    email: '',
    password: '',
    companyName: ''
  }));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <main className={styles.page}>
      <div className={styles.orbLeft} />
      <div className={styles.orbRight} />
      <div className={styles.shell}>
        <section className={styles.card}>
          <p className={styles.brand}>Get started</p>
          <h1 className={styles.title}>Create your workspace</h1>
          <p className={styles.description}>Company admins get a fresh company record and starter credits.</p>

          <form
          className={styles.form}
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            setLoading(true);
            try {
              await apiFetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
              });
              window.location.assign('/dashboard');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Registration failed');
            } finally {
              setLoading(false);
            }
          }}
        >
          {(['name', 'username', 'email', 'password', 'companyName'] as const).map((field) => (
            <div key={field} className={styles.field}>
              <label className={styles.label} htmlFor={`register-${field}`}>
                {FIELD_LABELS[field]}
              </label>
              <input
                id={`register-${field}`}
                className={styles.input}
                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                autoComplete={
                  field === 'password'
                    ? 'new-password'
                    : field === 'username'
                      ? 'username'
                      : field === 'email'
                        ? 'email'
                        : undefined
                }
                value={form[field]}
                onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                placeholder={
                  field === 'companyName'
                    ? 'Acme Learning'
                    : field === 'username'
                      ? 'e.g. Sahil'
                      : `Enter ${FIELD_LABELS[field].toLowerCase()}`
                }
              />
            </div>
          ))}

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
      </div>
    </main>
  );
}
