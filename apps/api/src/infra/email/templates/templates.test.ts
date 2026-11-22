import { describe, expect, it } from 'vitest';
import type { EmailLocale } from '../email.provider.js';
import { passwordResetEmail } from './password-reset.js';
import { verificationEmail } from './verification.js';

const url = 'http://localhost:4000/api/auth/verify-email?token=abc&callbackURL=%2F';
const templates = { verificationEmail, passwordResetEmail };
const locales: EmailLocale[] = ['en', 'es'];

describe.each(Object.entries(templates))('%s', (_name, render) => {
  describe.each(locales)('locale %s', (locale) => {
    it('returns non-empty subject, html and text containing the name and url', () => {
      const email = render(locale, { name: 'Maria', url });
      expect(email.subject).not.toBe('');
      expect(email.html).toContain('Maria');
      expect(email.text).toContain('Maria');
      expect(email.text).toContain(url);
      // '&' in the URL is escaped inside HTML attributes and text
      expect(email.html).toContain(url.replace(/&/g, '&amp;'));
    });

    it('escapes HTML characters in the name', () => {
      const email = render(locale, { name: '<script>alert("x")</script> & co', url });
      expect(email.html).not.toContain('<script>');
      expect(email.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co');
    });

    it('uses no images and no remote resources', () => {
      const { html } = render(locale, { name: 'Maria', url });
      expect(html).not.toContain('<img');
      expect(html).not.toMatch(/src=/i);
    });
  });

  it('differs between locales', () => {
    const en = render('en', { name: 'Maria', url });
    const es = render('es', { name: 'Maria', url });
    expect(en.subject).not.toBe(es.subject);
    expect(es.html).toContain('lang="es"');
  });
});
