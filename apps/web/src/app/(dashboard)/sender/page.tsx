import { redirect } from 'next/navigation';

// SMTP setup now lives in Settings › Email. Keep this route as a redirect for old links/bookmarks.
export default function SenderRedirectPage() {
  redirect('/settings?tab=email');
}
