/**
 * Request log serializer. Verification and reset links carry a token in the query string
 * (`/verify-email?token=...`) or in the path (`/reset-password/<token>`); neither may reach the logs.
 */
const TOKEN_PATH = /(\/reset-password\/)[^/?#]+/;

export function redactUrl(url: string): string {
  const path = url.split(/[?#]/)[0] ?? '';
  return path.replace(TOKEN_PATH, '$1[Redacted]');
}

type LoggedRequest = {
  id?: unknown;
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: Record<string, unknown>;
  remoteAddress?: string;
  remotePort?: number;
  socket?: { remoteAddress?: string; remotePort?: number };
};

/** Replaces pino-http's default `req` serializer, which logs `url`, `query` and `params` as-is. */
export function serializeRequest(req: LoggedRequest) {
  return {
    id: req.id,
    method: req.method,
    url: redactUrl(req.originalUrl ?? req.url ?? ''),
    headers: req.headers,
    remoteAddress: req.remoteAddress ?? req.socket?.remoteAddress,
    remotePort: req.remotePort ?? req.socket?.remotePort,
  };
}
