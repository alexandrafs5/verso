import type { EmailLocale } from '../email.provider.js';
import { renderEmail, type EmailCopy, type RenderedEmail, type TemplateInput } from './layout.js';

const COPY: Record<EmailLocale, EmailCopy> = {
  en: {
    subject: 'Verify your email address',
    greeting: (name) => `Hi ${name},`,
    intro: 'Thanks for signing up. Confirm your email address to finish creating your account.',
    action: 'Verify email',
    fallback: 'If the button does not work, copy and paste this link into your browser:',
    outro: 'If you did not create an account, you can ignore this email.',
  },
  es: {
    subject: 'Verifica tu correo electrónico',
    greeting: (name) => `Hola ${name},`,
    intro:
      'Gracias por registrarte. Confirma tu correo electrónico para terminar de crear tu cuenta.',
    action: 'Verificar correo',
    fallback: 'Si el botón no funciona, copia y pega este enlace en tu navegador:',
    outro: 'Si no creaste una cuenta, puedes ignorar este correo.',
  },
};

export function verificationEmail(locale: EmailLocale, input: TemplateInput): RenderedEmail {
  return renderEmail(locale, COPY[locale], input);
}
