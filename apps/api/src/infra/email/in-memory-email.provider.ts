import type { EmailMessage, EmailProvider } from './email.provider.js';

/** Test fake: records messages instead of sending them. */
export class InMemoryEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];
  failWith: Error | null = null;

  async send(message: EmailMessage): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
  }

  lastTo(to: string): EmailMessage | undefined {
    return [...this.sent].reverse().find((m) => m.to === to);
  }

  clear(): void {
    this.sent.length = 0;
    this.failWith = null;
  }
}
