import { describe, expect, it } from 'vitest';
import {
  authorSchema,
  bareKey,
  coverUrl,
  editionsResponseSchema,
  mapAuthor,
  mapEdition,
  typicalYear,
  mapFormat,
  mapLanguage,
  mapSearchDoc,
  mapWork,
  normalizeIsbn,
  parseYear,
  searchResponseSchema,
  textValue,
  workSchema,
} from './open-library-mappers.js';
import { loadFixture } from './test-fixtures.js';

describe('helpers', () => {
  it('bareKey strips the path prefix', () => {
    expect(bareKey('/works/OL1731119W')).toBe('OL1731119W');
    expect(bareKey('OL1731119W')).toBe('OL1731119W');
    expect(bareKey('/authors/OL199285A')).toBe('OL199285A');
  });

  it('coverUrl builds cover-ID URLs and rejects missing or negative ids', () => {
    expect(coverUrl(5419076)).toBe('https://covers.openlibrary.org/b/id/5419076-M.jpg');
    expect(coverUrl(15104175, 'a')).toBe('https://covers.openlibrary.org/a/id/15104175-M.jpg');
    expect(coverUrl(-1)).toBeNull();
    expect(coverUrl(0)).toBeNull();
    expect(coverUrl(undefined)).toBeNull();
  });

  it('parseYear reads the year from the formats Open Library uses', () => {
    expect(parseYear('Feb 01, 1984')).toBe(1984);
    expect(parseYear('1959-01-01')).toBe(1959);
    expect(parseYear('16 May 1917')).toBe(1917);
    expect(parseYear('November 14, 2023')).toBe(2023);
    expect(parseYear('c1955')).toBe(1955);
    expect(parseYear('unknown')).toBeNull();
    expect(parseYear(undefined)).toBeNull();
  });

  it('textValue accepts a string or { type, value }', () => {
    expect(textValue('  hello ')).toBe('hello');
    expect(textValue({ value: 'world' })).toBe('world');
    expect(textValue('   ')).toBeNull();
    expect(textValue(undefined)).toBeNull();
  });

  it('mapLanguage maps known codes and returns null for the rest', () => {
    expect(mapLanguage('/languages/spa')).toBe('es');
    expect(mapLanguage('/languages/eng')).toBe('en');
    expect(mapLanguage('fre')).toBe('fr');
    expect(mapLanguage('fra')).toBe('fr');
    expect(mapLanguage('/languages/xxx')).toBeNull();
  });

  it('mapFormat covers the formats seen in Open Library', () => {
    expect(mapFormat('hardcover')).toBe('HARDCOVER');
    expect(mapFormat('Hardback')).toBe('HARDCOVER');
    expect(mapFormat('Paperback')).toBe('PAPERBACK');
    expect(mapFormat('Mass Market Paperback')).toBe('PAPERBACK');
    expect(mapFormat('Kindle')).toBe('EBOOK');
    expect(mapFormat('ebook')).toBe('EBOOK');
    expect(mapFormat('Audio CD')).toBe('OTHER');
    expect(mapFormat(undefined)).toBe('OTHER');
  });

  it('normalizeIsbn cleans valid ISBNs and rejects the rest', () => {
    expect(normalizeIsbn('978-84-7506-092-7')).toBe('9788475060927');
    expect(normalizeIsbn(' 8475060927 ')).toBe('8475060927');
    expect(normalizeIsbn('0-8044-2957-x')).toBe('080442957X');
    expect(normalizeIsbn('12345')).toBeNull();
    expect(normalizeIsbn('abcdefghij')).toBeNull();
    expect(normalizeIsbn('')).toBeNull();
  });
});

describe('search fixture', () => {
  const response = searchResponseSchema.parse(loadFixture('search-pedro-paramo.json'));
  const results = response.docs.flatMap((doc) => mapSearchDoc(doc) ?? []);

  it('maps works and skips docs whose key is not a work key', () => {
    // The real response has 4 docs under /works/OL…M (edition ids misfiled as works).
    expect(response.docs).toHaveLength(20);
    expect(results).toHaveLength(16);
    expect(results.every((result) => /^OL\d+W$/.test(result.olWorkKey))).toBe(true);
  });

  it('maps the first result', () => {
    expect(results[0]).toMatchObject({
      olWorkKey: 'OL1731119W',
      title: 'Pedro Páramo',
      authors: [{ olAuthorKey: 'OL199285A', name: 'Juan Rulfo' }],
      firstPublishYear: 1955,
      coverUrl: 'https://covers.openlibrary.org/b/id/5419076-M.jpg',
      editionCount: 135,
    });
    expect(results[0]?.languages).toEqual(expect.arrayContaining(['es', 'en', 'fr', 'de']));
    expect(new Set(results[0]?.languages).size).toBe(results[0]?.languages.length);
  });

  it('skips docs that are not works', () => {
    expect(mapSearchDoc({ key: '/authors/OL199285A', title: 'Juan Rulfo' })).toBeNull();
    expect(mapSearchDoc({ title: 'No key' })).toBeNull();
    expect(mapSearchDoc('nope')).toBeNull();
  });

  it('defaults optional fields', () => {
    expect(mapSearchDoc({ key: '/works/OL1W', title: 'Bare' })).toEqual({
      olWorkKey: 'OL1W',
      title: 'Bare',
      authors: [],
      firstPublishYear: null,
      coverUrl: null,
      editionCount: 0,
      languages: [],
      typicalYear: null,
    });
  });

  it('keeps a typical year from the edition years, ignoring one stray early date', () => {
    const doc = { key: '/works/OL1W', title: 'T', first_publish_year: 2011 };
    expect(
      mapSearchDoc({ ...doc, publish_year: [2011, 2020, 2020, 2021, 2022] })?.typicalYear,
    ).toBe(2020);
    expect(mapSearchDoc({ ...doc, publish_year: [2011, 2020] })?.typicalYear).toBe(2011);
  });
});

describe('typicalYear', () => {
  it('uses the second oldest year with 4 or more years, else the oldest', () => {
    expect(typicalYear([2011, 2020, 2020, 2021])).toBe(2020);
    expect(typicalYear([2022, 2010, 2010, 2015, 2030 - 10])).toBe(2010);
    expect(typicalYear([1996, 1998, 2000])).toBe(1996);
    expect(typicalYear([2005])).toBe(2005);
  });

  it('returns null without usable years and ignores impossible ones', () => {
    expect(typicalYear(undefined)).toBeNull();
    expect(typicalYear([])).toBeNull();
    expect(typicalYear([0, -5, 12, 99999])).toBeNull();
    expect(typicalYear([0, 1995])).toBe(1995);
  });
});

describe('work fixture', () => {
  const work = mapWork(workSchema.parse(loadFixture('work-OL1731119W.json')));

  it('maps the work', () => {
    expect(work).toMatchObject({
      olWorkKey: 'OL1731119W',
      title: 'Pedro Páramo',
      subtitle: null,
      firstPublishYear: 1955,
      coverUrl: 'https://covers.openlibrary.org/b/id/5419076-M.jpg',
      authorKeys: ['OL199285A'],
    });
    expect(work.description).toMatch(/^Dentro de su brevedad/);
    expect(work.subjects).toContain('Fiction');
  });

  it('accepts a plain string description and skips authors without a key', () => {
    const mapped = mapWork(
      workSchema.parse({
        key: '/works/OL2W',
        title: 'Plain',
        description: 'Just text',
        authors: [{}, { author: { key: '/authors/OL9A' } }],
      }),
    );
    expect(mapped.description).toBe('Just text');
    expect(mapped.authorKeys).toEqual(['OL9A']);
  });
});

describe('editions fixture', () => {
  const { entries } = editionsResponseSchema.parse(loadFixture('editions-OL1731119W.json'));
  const editions = entries.flatMap((entry) => mapEdition(entry) ?? []);
  const byKey = (key: string) => editions.find((edition) => edition.olEditionKey === key);

  it('maps every entry', () => {
    expect(editions).toHaveLength(entries.length);
  });

  it('maps an English ebook edition', () => {
    expect(byKey('OL62697460M')).toEqual({
      olEditionKey: 'OL62697460M',
      olWorkKey: 'OL1731119W',
      title: 'Pedro Páramo',
      isbn10: '0802163483',
      isbn13: '9780802163486',
      publisher: 'Grove Press',
      publishYear: 2023,
      language: 'en',
      pageCount: 139,
      format: 'EBOOK',
      translatedFrom: null,
      coverUrl: 'https://covers.openlibrary.org/b/id/15269114-M.jpg',
    });
  });

  it('maps a Spanish hardcover with a -1 cover', () => {
    expect(byKey('OL47268921M')).toMatchObject({
      language: 'es',
      format: 'HARDCOVER',
      translatedFrom: null,
      publishYear: 1984,
      pageCount: 151,
      coverUrl: null,
    });
  });

  it('keeps editions without language, ISBN or format', () => {
    expect(byKey('OL53059019M')).toMatchObject({ language: null, format: 'OTHER' });
    expect(byKey('OL58980464M')).toMatchObject({ isbn10: null, isbn13: null, language: 'en' });
  });

  it('maps paperback formats and Hebrew', () => {
    expect(byKey('OL35608794M')?.format).toBe('PAPERBACK');
    expect(byKey('OL46564967M')?.format).toBe('PAPERBACK');
    expect(byKey('OL50259580M')?.language).toBe('he');
  });

  it('maps translated_from to the original language code', () => {
    const base = { key: '/books/OL1M', title: 'T', languages: [{ key: '/languages/cat' }] };
    expect(
      mapEdition({ ...base, translated_from: [{ key: '/languages/eng' }] })?.translatedFrom,
    ).toBe('en');
    expect(mapEdition(base)?.translatedFrom).toBeNull();
    expect(
      mapEdition({ ...base, translated_from: [{ key: '/languages/zzz' }] })?.translatedFrom,
    ).toBeNull();
  });

  it('returns null for an entry without a title', () => {
    expect(mapEdition({ key: '/books/OL1M' })).toBeNull();
  });
});

describe('isbn fixture', () => {
  it('maps the edition record', () => {
    expect(mapEdition(loadFixture('isbn-9788475060927.json'))).toMatchObject({
      olEditionKey: 'OL47268921M',
      olWorkKey: 'OL1731119W',
      isbn13: '9788475060927',
      isbn10: '8475060927',
      language: 'es',
    });
  });
});

describe('author fixture', () => {
  it('maps the author', () => {
    const author = mapAuthor(authorSchema.parse(loadFixture('author-OL199285A.json')));
    expect(author).toMatchObject({
      olAuthorKey: 'OL199285A',
      name: 'Juan Rulfo',
      birthYear: 1917,
      deathYear: 1986,
      photoUrl: 'https://covers.openlibrary.org/a/id/15104175-M.jpg',
    });
    expect(author.bio).toMatch(/^Juan Nepomuceno/);
  });

  it('allows an author with no optional fields', () => {
    expect(mapAuthor(authorSchema.parse({ key: '/authors/OL1A', name: 'Anon' }))).toEqual({
      olAuthorKey: 'OL1A',
      name: 'Anon',
      bio: null,
      birthYear: null,
      deathYear: null,
      photoUrl: null,
    });
  });
});

describe('schemas', () => {
  it('reject a response with the wrong shape', () => {
    expect(workSchema.safeParse({ title: 'no key' }).success).toBe(false);
    expect(authorSchema.safeParse({ key: '/authors/OL1A' }).success).toBe(false);
    expect(searchResponseSchema.safeParse({ docs: 'x' }).success).toBe(false);
  });
});
