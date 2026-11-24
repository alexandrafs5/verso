export const workHref = (ref: string): string => `/works/${encodeURIComponent(ref)}`;
export const authorHref = (ref: string): string => `/authors/${encodeURIComponent(ref)}`;
export const seriesHref = (id: string): string => `/series/${encodeURIComponent(id)}`;

/** Route params arrive percent-encoded (`ol%3AOL1W`). A malformed escape is kept as is. */
export function decodeRouteParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
