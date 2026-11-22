import { notFound } from 'next/navigation';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { parseStep } from '@/features/onboarding/steps';

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const step = parseStep((await params).step);
  if (step === null) notFound();
  return <OnboardingFlow step={step} />;
}
