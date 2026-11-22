import { Global, Module } from '@nestjs/common';
import { type EmailEnv, loadEmailEnv, selectEmailProviderKind } from './email-env.js';
import { EMAIL_PROVIDER, type EmailProvider } from './email.provider.js';
import { SmtpEmailProvider } from './smtp-email.provider.js';

export function createEmailProvider(env: EmailEnv): EmailProvider {
  const kind = selectEmailProviderKind(env);
  switch (kind) {
    case 'smtp':
      return new SmtpEmailProvider(env.SMTP_URL as string, env.EMAIL_FROM);
    case 'brevo':
      // Wired in step 4 of SPEC 08.
      throw new Error('Brevo provider is not wired yet');
  }
}

@Global()
@Module({
  providers: [{ provide: EMAIL_PROVIDER, useFactory: () => createEmailProvider(loadEmailEnv()) }],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
