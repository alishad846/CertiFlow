'use client';

import { Card } from '@/components/ui/card';
import type { SettingsUser } from '../page';

type Props = { user: SettingsUser | null; onSaved: () => void };

// Filled in T6 — two-factor enable/disable lives here.
export function SecuritySection(_props: Props) {
  return (
    <Card className="p-6">
      <h3 className="font-serif text-2xl text-ink">Security</h3>
      <p className="mt-1 text-sm text-ink-soft">Two-factor authentication coming here.</p>
    </Card>
  );
}
