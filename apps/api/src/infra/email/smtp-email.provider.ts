import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage, EmailProvider } from './email.provider.js';

export type SmtpTransport = Pick<Transporter, 'sendMail'>;

/** Local development only: sends through SMTP to Mailpit (http://localhost:8025). */
export class SmtpEmailProvider implements EmailProvider {
  private readonly transport: SmtpTransport;

  constructor(
    smtpUrl: string,
    private readonly from: string,
    transport?: SmtpTransport,
  ) {
    this.transport = transport ?? nodemailer.createTransport(smtpUrl);
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
