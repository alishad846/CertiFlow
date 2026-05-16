import { redirect } from 'next/navigation';

export default async function DashboardBatchAliasPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/batches/${id}`);
}
