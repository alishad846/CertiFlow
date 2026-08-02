'use client';

import { Card } from '@/components/ui/card';
import type { SettingsUser } from '../page';

type Props = { user: SettingsUser | null; onSaved: () => void };

// Filled in T5 — the SMTP sender setup lives here.
export function EmailSection(_props: Props) {
  return (
    <Card className="p-6">
      <h3 className="font-serif text-2xl text-ink">Email</h3>
      <p className="mt-1 text-sm text-ink-soft">SMTP setup coming here.</p>
    </Card>
  );
}
