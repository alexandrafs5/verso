/** The requested work, edition or author does not exist (404 or malformed key). */
export class CatalogNotFoundError extends Error {
  constructor(message = 'Catalog item not found', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CatalogNotFoundError';
  }
}

/** The external catalog failed: timeout, network error, 429, 5xx, unexpected status or bad shape. */
export class CatalogUnavailableError extends Error {
  constructor(message = 'Catalog provider unavailable', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CatalogUnavailableError';
  }
}
