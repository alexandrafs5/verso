import type { EmailLocale } from '../email.provider.js';
import { renderEmail, type EmailCopy, type RenderedEmail, type TemplateInput } from './layout.js';

// Sent when someone signs up with an email that already has an account. The sign-up response is
// identical to a new sign-up (no account enumeration), so this email is how the real owner finds
// out. `url` is the web sign-in page: it carries no token.
const COPY: Record<EmailLocale, EmailCopy> = {
  en: {
    subject: 'You already have an account',
    greeting: (name) => `Hi ${name},`,
    intro:
      'Someone, hopefully you, tried to create an account with this email address, but one already exists.',
    action: 'Sign in',
    fallback: 'If the button does not work, copy and paste this link into your browser:',
    outro:
      'If you forgot your password, choose "Forgot password?" on the sign-in page. If this was not you, you can ignore this email.',
  },
  es: {
    subject: 'Ya tienes una cuenta',
    greeting: (name) => `Hola ${name},`,
    intro:
      'Alguien, esperamos que tú, intentó crear una cuenta con esta dirección de correo, pero ya existe una.',
    action: 'Iniciar sesión',
    fallback: 'Si el botón no funciona, copia y pega este enlace en tu navegador:',
    outro:
      'Si olvidaste tu contraseña, elige "¿Olvidaste tu contraseña?" en la página de inicio de sesión. Si no fuiste tú, puedes ignorar este correo.',
  },
};

export function accountExistsEmail(locale: EmailLocale, input: TemplateInput): RenderedEmail {
  return renderEmail(locale, COPY[locale], input);
}
