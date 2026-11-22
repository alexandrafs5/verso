import { describe, expect, it, vi } from 'vitest';
import { SmtpEmailProvider } from './smtp-email.provider.js';

const FROM = 'Verso <no-reply@verso.local>';
const SMTP = 'smtp://localhost:1025';

describe('SmtpEmailProvider', () => {
  it('passes sender, recipient, subject and both bodies to the transport', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const provider = new SmtpEmailProvider(SMTP, FROM, { sendMail });
    await provider.send({ to: 'a@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' });
    expect(sendMail).toHaveBeenCalledWith({
      from: FROM,
      to: 'a@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it('rejects when the transport fails', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('connection refused'));
    const provider = new SmtpEmailProvider(SMTP, FROM, { sendMail });
    await expect(
      provider.send({ to: 'a@example.com', subject: 'Hi', html: 'x', text: 'x' }),
    ).rejects.toThrow('connection refused');
  });
});
