'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import styles from '../auth.module.css';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      setMessage(res.message || 'Verification code sent to your email.');
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (otp.length !== 6) {
      setError('Please enter a valid 6 digit OTP code');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      setMessage(res.message || 'Password reset successfully!');
      setStep('success');
      setTimeout(() => {
        window.location.assign('/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
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
          <p className={styles.brand}>CertiFlow Security</p>

          {step === 'request' && (
            <>
              <h1 className={styles.title}>Reset password</h1>
              <p className={styles.description}>
                Enter your registered email address and we&apos;ll send an OTP verification code via our SMTP service.
              </p>

              <form className={styles.form} onSubmit={handleRequestOtp}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="forgot-email">
                    Registered Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </div>

                {error ? <p className={styles.error}>{error}</p> : null}
                {message ? (
                  <p style={{ margin: 0, padding: '12px 14px', background: '#ecfdf5', color: '#047857', borderRadius: '16px', fontSize: '0.92rem' }}>
                    {message}
                  </p>
                ) : null}

                <button className={styles.button} type="submit" disabled={loading}>
                  {loading ? 'Sending OTP...' : 'Send OTP verification code'}
                </button>
              </form>
            </>
          )}

          {step === 'reset' && (
            <>
              <h1 className={styles.title}>Enter code</h1>
              <p className={styles.description}>
                We sent a 6 digit verification code to <strong style={{ color: '#0f172a' }}>{email}</strong>. Check your inbox and enter it below.
              </p>

              <form className={styles.form} onSubmit={handleResetPassword}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="reset-otp">
                    6 Digit Verification Code (OTP)
                  </label>
                  <input
                    id="reset-otp"
                    type="text"
                    maxLength={6}
                    className={styles.input}
                    style={{ letterSpacing: '0.3em', fontSize: '1.25rem', textAlign: 'center', fontWeight: 'bold' }}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="reset-new-password">
                    New Password
                  </label>
                  <input
                    id="reset-new-password"
                    type="password"
                    minLength={8}
                    className={styles.input}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="reset-confirm-password">
                    Confirm New Password
                  </label>
                  <input
                    id="reset-confirm-password"
                    type="password"
                    minLength={8}
                    className={styles.input}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    required
                  />
                </div>

                {error ? <p className={styles.error}>{error}</p> : null}
                {message ? (
                  <p style={{ margin: 0, padding: '12px 14px', background: '#ecfdf5', color: '#047857', borderRadius: '16px', fontSize: '0.92rem' }}>
                    {message}
                  </p>
                ) : null}

                <button className={styles.button} type="submit" disabled={loading}>
                  {loading ? 'Resetting password...' : 'Reset password'}
                </button>
              </form>

              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setError('');
                    setMessage('');
                  }}
                  style={{ background: 'none', border: 'none', color: '#1f56a8', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}
                >
                  &larr; Change email or resend code
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ width: '64px', height: '64px', margin: '0 auto 16px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                &#10003;
              </div>
              <h1 className={styles.title} style={{ fontSize: '1.85rem' }}>Password reset!</h1>
              <p className={styles.description} style={{ marginTop: '12px' }}>
                Your password has been successfully reset. Redirecting you to the sign in page.
              </p>
            </div>
          )}

          <p className={styles.footer}>
            Remember your password?{' '}
            <Link href="/login" className={styles.link}>
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
