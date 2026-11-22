import { describe, expect, it } from 'vitest';
import type { EmailMessage } from './email.provider.js';
import { InMemoryEmailProvider } from './in-memory-email.provider.js';

const message: EmailMessage = {
  to: 'a@example.com',
  subject: 'Hi',
  html: '<p>Hi</p>',
  text: 'Hi',
};

describe('InMemoryEmailProvider', () => {
  it('records sent messages in order', async () => {
    const provider = new InMemoryEmailProvider();
    await provider.send(message);
    await provider.send({ ...message, to: 'b@example.com' });
    expect(provider.sent.map((m) => m.to)).toEqual(['a@example.com', 'b@example.com']);
  });

  it('lastTo returns the most recent message for a recipient', async () => {
    const provider = new InMemoryEmailProvider();
    await provider.send(message);
    await provider.send({ ...message, subject: 'Second' });
    expect(provider.lastTo('a@example.com')?.subject).toBe('Second');
    expect(provider.lastTo('nobody@example.com')).toBeUndefined();
  });

  it('rejects and records nothing when failWith is set', async () => {
    const provider = new InMemoryEmailProvider();
    provider.failWith = new Error('boom');
    await expect(provider.send(message)).rejects.toThrow('boom');
    expect(provider.sent).toHaveLength(0);
  });

  it('clear resets messages and failure', async () => {
    const provider = new InMemoryEmailProvider();
    await provider.send(message);
    provider.failWith = new Error('boom');
    provider.clear();
    await expect(provider.send(message)).resolves.toBeUndefined();
    expect(provider.sent).toHaveLength(1);
  });
});
