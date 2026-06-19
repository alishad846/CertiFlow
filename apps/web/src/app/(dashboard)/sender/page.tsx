import { SenderSettingsClient } from './sender-settings-client';

export const dynamic = 'force-dynamic';

export default async function SenderSettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ companyId?: string | string[] }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawCompanyId = resolvedSearchParams.companyId;
  const initialCompanyId = Array.isArray(rawCompanyId) ? rawCompanyId[0] ?? '' : rawCompanyId ?? '';

  return (
    <SenderSettingsClient initialCompanyId={initialCompanyId.trim()} />
  );
}
