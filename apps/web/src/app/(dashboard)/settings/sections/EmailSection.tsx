'use client';

import { SenderSettingsClient } from '../../sender/sender-settings-client';
import type { SettingsUser } from '../page';

type Props = { user: SettingsUser | null; onSaved: () => void };

// SMTP sender setup — this is the onboarding-critical section. Reuses the existing sender client.
export function EmailSection({ onSaved }: Props) {
  return <SenderSettingsClient initialCompanyId="" onSaved={onSaved} />;
}
