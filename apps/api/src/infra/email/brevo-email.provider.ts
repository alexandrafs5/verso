import { parseSender } from './email-env.js';
import type { EmailMessage, EmailProvider } from './email.provider.js';

export const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

type FetchLike = typeof fetch;

/** Production: sends through the Brevo HTTP API (Render Free blocks SMTP). */
export class BrevoEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await this.fetchImpl(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: parseSender(this.from),
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // Status only: the response body and the request never go into the error (no address or URL).
      throw new Error(`Brevo send failed with status ${response.status}`);
    }
  }
}
