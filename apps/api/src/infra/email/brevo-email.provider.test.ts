import { describe, expect, it, vi } from 'vitest';
import { BREVO_ENDPOINT, BrevoEmailProvider } from './brevo-email.provider.js';

const FROM = 'Verso <no-reply@verso.local>';
const message = { to: 'a@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' };

const okResponse = () => new Response('{"messageId":"x"}', { status: 201 });

describe('BrevoEmailProvider', () => {
  it('POSTs to the Brevo endpoint with the api-key header and the full message', async () => {
    const fetchStub = vi.fn().mockResolvedValue(okResponse());
    const provider = new BrevoEmailProvider('secret-key', FROM, fetchStub);

    await provider.send(message);

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(BREVO_ENDPOINT);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['api-key']).toBe('secret-key');
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: 'Verso', email: 'no-reply@verso.local' },
      to: [{ email: 'a@example.com' }],
      subject: 'Hi',
      htmlContent: '<p>Hi</p>',
      textContent: 'Hi',
    });
  });

  it('sets a timeout signal', async () => {
    const fetchStub = vi.fn().mockResolvedValue(okResponse());
    await new BrevoEmailProvider('k', FROM, fetchStub).send(message);
    const [, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects on a non-2xx response without leaking the recipient or the body', async () => {
    const fetchStub = vi.fn().mockResolvedValue(new Response('bad a@example.com', { status: 401 }));
    const promise = new BrevoEmailProvider('k', FROM, fetchStub).send(message);
    await expect(promise).rejects.toThrow('Brevo send failed with status 401');
    await expect(promise).rejects.not.toThrow(/example\.com/);
  });

  it('rejects when fetch fails', async () => {
    const fetchStub = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(new BrevoEmailProvider('k', FROM, fetchStub).send(message)).rejects.toThrow(
      'network down',
    );
  });
});
