import { Global, Module } from '@nestjs/common';
import { BrevoEmailProvider } from './brevo-email.provider.js';
import { type EmailEnv, loadEmailEnv, selectEmailProviderKind } from './email-env.js';
import { EMAIL_PROVIDER, type EmailProvider } from './email.provider.js';
import { SmtpEmailProvider } from './smtp-email.provider.js';

export function createEmailProvider(env: EmailEnv): EmailProvider {
  const kind = selectEmailProviderKind(env);
  switch (kind) {
    case 'smtp':
      return new SmtpEmailProvider(env.SMTP_URL as string, env.EMAIL_FROM);
    case 'brevo':
      return new BrevoEmailProvider(env.BREVO_API_KEY as string, env.EMAIL_FROM);
  }
}

@Global()
@Module({
  providers: [{ provide: EMAIL_PROVIDER, useFactory: () => createEmailProvider(loadEmailEnv()) }],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
