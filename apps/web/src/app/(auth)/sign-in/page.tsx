import { SignInForm } from '@/features/auth/SignInForm';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <SignInForm oauthFailed={error === 'oauth'} />;
}
