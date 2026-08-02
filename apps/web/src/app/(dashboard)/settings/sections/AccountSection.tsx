'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SettingsUser } from '../page';

type Props = { user: SettingsUser | null; onSaved: () => void };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

export function AccountSection({ user, onSaved }: Props) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setUsername(user.username ?? '');
      setEmail(user.email ?? '');
    }
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const body: Record<string, string> = {};
      if (name.trim() && name !== user?.name) body.name = name.trim();
      if (username.trim() && username !== (user?.username ?? '')) body.username = username.trim();
      if (email.trim() && email !== user?.email) body.email = email.trim();
      if (!Object.keys(body).length) {
        setProfileMsg({ ok: true, text: 'Nothing to update.' });
        return;
      }
      await apiFetch('/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      setProfileMsg({ ok: true, text: 'Profile updated.' });
      onSaved();
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setPasswordMsg({ ok: true, text: 'Password changed.' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change password.' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-serif text-2xl text-ink">Profile</h3>
        <p className="mt-1 text-sm text-ink-soft">Update how your name, username, and email appear.</p>
        <form onSubmit={saveProfile} className="mt-5 space-y-4">
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Username">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </Field>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.ok ? 'text-emerald-700' : 'text-[#a3412e]'}`}>{profileMsg.text}</p>
          )}
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="font-serif text-2xl text-ink">Password</h3>
        <p className="mt-1 text-sm text-ink-soft">Changing your password signs out your other sessions.</p>
        <form onSubmit={savePassword} className="mt-5 space-y-4">
          <Field label="Current password">
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </Field>
          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.ok ? 'text-emerald-700' : 'text-[#a3412e]'}`}>{passwordMsg.text}</p>
          )}
          <Button type="submit" disabled={savingPassword || currentPassword.length < 1 || newPassword.length < 8}>
            {savingPassword ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
