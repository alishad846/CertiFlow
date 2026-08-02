import { redirect } from 'next/navigation';

// Subscriptions were replaced by credit packs on the Billing page. Redirect old links there.
export default function PlansRedirectPage() {
  redirect('/billing');
}
