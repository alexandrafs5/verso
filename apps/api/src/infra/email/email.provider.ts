export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** Same values as the User.locale enum. */
export type EmailLocale = 'en' | 'es';

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
