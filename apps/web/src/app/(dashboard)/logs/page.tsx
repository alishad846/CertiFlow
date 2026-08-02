import { redirect } from 'next/navigation';

// Email delivery status now lives on the Dashboard charts. Redirect old links there.
export default function LogsRedirectPage() {
  redirect('/dashboard');
}
