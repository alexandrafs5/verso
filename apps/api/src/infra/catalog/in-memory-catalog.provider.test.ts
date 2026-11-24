import { describe, expect, it } from 'vitest';
import { CatalogNotFoundError, CatalogUnavailableError } from './catalog-errors.js';
import type { ExternalAuthor, ExternalEdition, ExternalWork } from './catalog-provider.js';
import { InMemoryCatalogProvider } from './in-memory-catalog.provider.js';

const work: ExternalWork = {
  olWorkKey: 'OL1W',
  title: 'Pedro Páramo',
  subtitle: null,
  description: null,
  firstPublishYear: 1955,
  coverUrl: null,
  authorKeys: ['OL1A'],
  subjects: [],
};
const author: ExternalAuthor = {
  olAuthorKey: 'OL1A',
  name: 'Juan Rulfo',
  bio: null,
  birthYear: 1917,
  deathYear: 1986,
  photoUrl: null,
};
const edition = (key: string, language: string | null, isbn13: string | null): ExternalEdition => ({
  olEditionKey: key,
  olWorkKey: 'OL1W',
  title: 'Pedro Páramo',
  isbn10: null,
  isbn13,
  publisher: null,
  publishYear: null,
  language,
  pageCount: null,
  format: 'OTHER',
  coverUrl: null,
});

function seeded(): InMemoryCatalogProvider {
  return new InMemoryCatalogProvider()
    .addWork(work)
    .addAuthor(author)
    .addEdition(edition('OL1M', 'es', '9788475060927'))
    .addEdition(edition('OL2M', 'en', '9780802163486'))
    .addSearchResult({
      olWorkKey: 'OL1W',
      title: 'Pedro Páramo',
      authors: [{ olAuthorKey: 'OL1A', name: 'Juan Rulfo' }],
      firstPublishYear: 1955,
      coverUrl: null,
      editionCount: 2,
      languages: ['es', 'en'],
    });
}

describe('InMemoryCatalogProvider', () => {
  it('searches by title or author, case-insensitive, and returns [] for a blank query', async () => {
    const provider = seeded();
    expect(await provider.searchWorks('páramo', 1)).toHaveLength(1);
    expect(await provider.searchWorks('RULFO', 1)).toHaveLength(1);
    expect(await provider.searchWorks('other', 1)).toEqual([]);
    expect(await provider.searchWorks('  ', 1)).toEqual([]);
    expect(await provider.searchWorks('páramo', 2)).toEqual([]);
  });

  it('records each search call with its options', async () => {
    const provider = seeded();
    await provider.searchWorks('páramo', 1, { sort: 'editions' });
    await provider.searchWorks('rulfo', 2);
    expect(provider.searchCalls).toEqual([
      { query: 'páramo', page: 1, opts: { sort: 'editions' } },
      { query: 'rulfo', page: 2, opts: undefined },
    ]);
  });

  it('returns seeded works and authors, and throws CatalogNotFoundError otherwise', async () => {
    const provider = seeded();
    expect(await provider.getWork('OL1W')).toEqual(work);
    expect(await provider.getAuthor('OL1A')).toEqual(author);
    await expect(provider.getWork('OL9W')).rejects.toBeInstanceOf(CatalogNotFoundError);
    await expect(provider.getAuthor('OL9A')).rejects.toBeInstanceOf(CatalogNotFoundError);
  });

  it('lists editions and filters by language', async () => {
    const provider = seeded();
    expect(await provider.listEditions('OL1W', {})).toHaveLength(2);
    expect(await provider.listEditions('OL1W', { language: 'es' })).toHaveLength(1);
    await expect(provider.listEditions('OL9W', {})).rejects.toBeInstanceOf(CatalogNotFoundError);
  });

  it('finds an edition by ISBN and returns null when unknown or malformed', async () => {
    const provider = seeded();
    expect((await provider.getEditionByIsbn('978-84-7506-092-7'))?.olEditionKey).toBe('OL1M');
    expect(await provider.getEditionByIsbn('9780000000002')).toBeNull();
    expect(await provider.getEditionByIsbn('123')).toBeNull();
  });

  it('throws CatalogUnavailableError on every method when unavailable', async () => {
    const provider = seeded();
    provider.unavailable = true;
    await expect(provider.searchWorks('a', 1)).rejects.toBeInstanceOf(CatalogUnavailableError);
    await expect(provider.getWork('OL1W')).rejects.toBeInstanceOf(CatalogUnavailableError);
    await expect(provider.listEditions('OL1W', {})).rejects.toBeInstanceOf(CatalogUnavailableError);
    await expect(provider.getEditionByIsbn('9788475060927')).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );
    await expect(provider.getAuthor('OL1A')).rejects.toBeInstanceOf(CatalogUnavailableError);
  });
});
