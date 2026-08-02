import { redirect } from 'next/navigation';

// Two-factor now lives in Settings › Security. Keep this route as a redirect for old links/bookmarks.
export default function SecurityRedirectPage() {
  redirect('/settings?tab=security');
}
