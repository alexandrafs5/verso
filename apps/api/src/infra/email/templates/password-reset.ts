import type { EmailLocale } from '../email.provider.js';
import { renderEmail, type EmailCopy, type RenderedEmail, type TemplateInput } from './layout.js';

const COPY: Record<EmailLocale, EmailCopy> = {
  en: {
    subject: 'Reset your password',
    greeting: (name) => `Hi ${name},`,
    intro:
      'We received a request to reset your password. Use the button below to choose a new one.',
    action: 'Reset password',
    fallback: 'If the button does not work, copy and paste this link into your browser:',
    outro: 'If you did not request this, you can ignore this email. Your password will not change.',
  },
  es: {
    subject: 'Restablece tu contraseña',
    greeting: (name) => `Hola ${name},`,
    intro:
      'Recibimos una solicitud para restablecer tu contraseña. Usa el botón para elegir una nueva.',
    action: 'Restablecer contraseña',
    fallback: 'Si el botón no funciona, copia y pega este enlace en tu navegador:',
    outro: 'Si no lo solicitaste, puedes ignorar este correo. Tu contraseña no cambiará.',
  },
};

export function passwordResetEmail(locale: EmailLocale, input: TemplateInput): RenderedEmail {
  return renderEmail(locale, COPY[locale], input);
}
