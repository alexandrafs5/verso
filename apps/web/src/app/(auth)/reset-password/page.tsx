import { ResetExpired, ResetPasswordForm } from '@/features/auth/ResetPasswordForm';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  // Better Auth redirects to ?error=INVALID_TOKEN for a bad or expired link.
  if (!token || error) return <ResetExpired />;
  return <ResetPasswordForm token={token} />;
}
