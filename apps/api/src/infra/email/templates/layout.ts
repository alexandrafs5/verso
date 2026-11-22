import type { EmailLocale, EmailMessage } from '../email.provider.js';

export type TemplateInput = { name: string; url: string };
export type RenderedEmail = Omit<EmailMessage, 'to'>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type EmailCopy = {
  subject: string;
  greeting: (name: string) => string;
  intro: string;
  action: string;
  fallback: string;
  outro: string;
};

/** Brand-neutral HTML: inline styles only, no remote images. */
export function renderEmail(
  locale: EmailLocale,
  copy: EmailCopy,
  { name, url }: TemplateInput,
): RenderedEmail {
  const safeUrl = escapeHtml(url);

  const html = `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;">
    <p>${escapeHtml(copy.greeting(name))}</p>
    <p>${escapeHtml(copy.intro)}</p>
    <p><a href="${safeUrl}" style="display:inline-block;padding:10px 20px;border:1px solid currentColor;border-radius:6px;text-decoration:none;font-weight:bold;">${escapeHtml(copy.action)}</a></p>
    <p>${escapeHtml(copy.fallback)}</p>
    <p style="word-break:break-all;"><a href="${safeUrl}">${safeUrl}</a></p>
    <p>${escapeHtml(copy.outro)}</p>
  </body>
</html>`;

  const text = [copy.greeting(name), '', copy.intro, '', url, '', copy.outro].join('\n');

  return { subject: copy.subject, html, text };
}
