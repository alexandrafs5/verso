import { getTranslations } from 'next-intl/server';

// Stub until the form lands (SPEC 09, step 5).
export default async function SignInPage() {
  const t = await getTranslations('auth.signIn');
  return (
    <>
      <h1>{t('title')}</h1>
      <p className="mt-2 text-muted">{t('subtitle')}</p>
    </>
  );
}
