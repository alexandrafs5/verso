import { VerifyEmailPanel, type VerifyState } from '@/features/auth/VerifyEmailPanel';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status, error } = await searchParams;
  // Better Auth appends `error` to the callback URL on a bad token. Its codes are not stable,
  // so any error means an expired link.
  const state: VerifyState = error ? 'expired' : status === 'success' ? 'success' : 'pending';
  return <VerifyEmailPanel state={state} />;
}
