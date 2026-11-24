import { describe, expect, it } from 'vitest';
import type { ExternalEdition, ExternalWork } from '../../infra/catalog/catalog-provider.js';
import {
  decimalToNumber,
  externalEditionToDto,
  externalWorkToDetail,
  searchResultToSummary,
  sortByYear,
} from './catalog.mappers.js';

describe('sortByYear', () => {
  const work = (title: string, firstPublishYear: number | null) => ({ title, firstPublishYear });

  it('orders ascending with unknown years last', () => {
    const sorted = sortByYear([work('c', null), work('b', 1980), work('a', 1950)]);
    expect(sorted.map((w) => w.title)).toEqual(['a', 'b', 'c']);
  });

  it('is stable for equal years and does not mutate the input', () => {
    const input = [work('x', 1990), work('y', 1990), work('z', null), work('w', null)];
    const sorted = sortByYear(input);
    expect(sorted.map((w) => w.title)).toEqual(['x', 'y', 'z', 'w']);
    expect(input.map((w) => w.title)).toEqual(['x', 'y', 'z', 'w']);
  });
});

describe('decimalToNumber', () => {
  it('converts decimals and keeps null', () => {
    expect(decimalToNumber({ toString: () => '1.50' })).toBe(1.5);
    expect(decimalToNumber({ toString: () => '2' })).toBe(2);
    expect(decimalToNumber(null)).toBeNull();
  });
});

describe('provider mappers', () => {
  it('prefixes keys with ol: and nulls the library status of a search result', () => {
    const summary = searchResultToSummary({
      olWorkKey: 'OL1W',
      title: 'T',
      authors: [{ olAuthorKey: 'OL2A', name: 'N' }],
      firstPublishYear: null,
      coverUrl: null,
      editionCount: 3,
      languages: [],
    });
    expect(summary.ref).toBe('ol:OL1W');
    expect(summary.authors).toEqual([{ ref: 'ol:OL2A', name: 'N' }]);
    expect(summary.libraryStatus).toBeNull();
  });

  it('keeps at most 30 subjects as genres and has no series', () => {
    const work: ExternalWork = {
      olWorkKey: 'OL1W',
      title: 'T',
      subtitle: null,
      description: null,
      firstPublishYear: null,
      coverUrl: null,
      authorKeys: [],
      subjects: Array.from({ length: 40 }, (_, i) => `s${i}`),
    };
    const detail = externalWorkToDetail(work, []);
    expect(detail.genres).toEqual(work.subjects.slice(0, 30));
    expect(detail.series).toBeNull();
    expect(detail.source).toBe('OPEN_LIBRARY');
  });

  it('derives the series from a series: subject and keeps it out of the genres', () => {
    const work: ExternalWork = {
      olWorkKey: 'OL1W',
      title: 'T',
      subtitle: null,
      description: null,
      firstPublishYear: null,
      coverUrl: null,
      authorKeys: [],
      subjects: ['series:A Song of Ice and Fire', ...Array.from({ length: 8 }, (_, i) => `s${i}`)],
    };
    const detail = externalWorkToDetail(work, []);
    expect(detail.series).toEqual({
      id: 'ol:A Song of Ice and Fire',
      name: 'A Song of Ice and Fire',
      position: null,
    });
    // The series subject does not take one of the 8 genre slots.
    expect(detail.genres).toEqual(Array.from({ length: 8 }, (_, i) => `s${i}`));
  });

  it('turns a Markdown description into plain text', () => {
    const work: ExternalWork = {
      olWorkKey: 'OL1W',
      title: 'T',
      subtitle: null,
      description:
        '***A Game of Thrones*** is by **George R. R. Martin**.\r\n\r\n----------\r\nContained in: x',
      firstPublishYear: null,
      coverUrl: null,
      authorKeys: [],
      subjects: [],
    };
    expect(externalWorkToDetail(work, []).description).toBe(
      'A Game of Thrones is by George R. R. Martin.',
    );
    expect(externalWorkToDetail({ ...work, description: null }, []).description).toBeNull();
  });

  it('turns a Markdown edition blurb into plain text and gives none for a missing one', () => {
    const edition: ExternalEdition = {
      olEditionKey: 'OL5M',
      olWorkKey: 'OL1W',
      title: 'T',
      isbn10: null,
      isbn13: null,
      publisher: null,
      publishYear: null,
      language: 'es',
      pageCount: null,
      format: 'EBOOK',
      coverUrl: null,
      translatedFrom: null,
      description: 'En un mundo **distinto** al nuestro, [leer más](https://example.org).',
    };
    expect(externalEditionToDto(edition, null).description).toBe(
      'En un mundo distinto al nuestro, leer más.',
    );
    expect(
      externalEditionToDto({ ...edition, description: undefined }, null).description,
    ).toBeNull();
  });

  it('maps an external edition to an ol: ref', () => {
    const edition: ExternalEdition = {
      olEditionKey: 'OL5M',
      olWorkKey: 'OL1W',
      title: 'T',
      isbn10: null,
      isbn13: '9788437604947',
      publisher: null,
      publishYear: null,
      language: 'es',
      pageCount: null,
      format: 'EBOOK',
      translatedFrom: null,
      coverUrl: null,
    };
    expect(externalEditionToDto(edition, 'es')).toMatchObject({
      ref: 'ol:OL5M',
      format: 'EBOOK',
      isOriginalLanguage: true,
    });
  });
});
