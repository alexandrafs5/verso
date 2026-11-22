import { SignInForm } from '@/features/auth/SignInForm';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;
  return <SignInForm oauthFailed={error === 'oauth'} resetSuccess={reset === 'success'} />;
}
