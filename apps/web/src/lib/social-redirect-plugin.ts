type SuccessContext = {
  data?: { url?: unknown; redirect?: unknown } | null;
  request?: { url?: string | URL };
};

/**
 * Replaces Better Auth's default redirect plugin, which follows `url` on any response with
 * `redirect: true`. Email sign-in returns that for its `callbackURL`, but the web app sends a
 * verified user to /home itself and uses the callback only for the re-sent verification link
 * (SPEC 10). Only social sign-in needs the browser to leave for the provider.
 */
export const socialRedirectPlugin = {
  id: 'social-redirect',
  name: 'Social redirect',
  hooks: {
    onSuccess(context: SuccessContext) {
      const target = context.data?.url;
      if (typeof target !== 'string' || context.data?.redirect !== true) return;
      if (!String(context.request?.url ?? '').includes('/sign-in/social')) return;
      if (!/^https?:\/\//i.test(target)) return;
      try {
        window.location.href = target;
      } catch {
        // Navigation blocked: the caller still sees a successful response.
      }
    },
  },
};
