import { redirect } from 'next/navigation';

// OnboardingFlow moves a returning user past step 1 when the username already exists.
export default function OnboardingIndexPage() {
  redirect('/onboarding/1');
}
