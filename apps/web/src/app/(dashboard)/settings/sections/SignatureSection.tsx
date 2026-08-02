'use client';

import { Card } from '@/components/ui/card';
import type { SettingsUser } from '../page';

type Props = { user: SettingsUser | null; onSaved: () => void };

// Filled in T12 — company DSC upload / auto-sign settings live here.
export function SignatureSection(_props: Props) {
  return (
    <Card className="p-6">
      <h3 className="font-serif text-2xl text-ink">Digital Signature</h3>
      <p className="mt-1 text-sm text-ink-soft">DSC upload coming here.</p>
    </Card>
  );
}
