import { describe, expect, it } from 'vitest';
import {
  isSeriesSubject,
  olSeriesName,
  seriesFromSubjects,
  seriesNameFromSubject,
  seriesSearchQuery,
} from './ol-series';

describe('seriesNameFromSubject', () => {
  it('reads the name after the series: prefix, in any case', () => {
    expect(seriesNameFromSubject('series:A Song of Ice and Fire')).toBe('A Song of Ice and Fire');
    expect(seriesNameFromSubject('Series: Discworld')).toBe('Discworld');
  });

  it('turns underscores into spaces and title-cases an all-lowercase name', () => {
    expect(seriesNameFromSubject('series:harry_potter')).toBe('Harry Potter');
    expect(seriesNameFromSubject('series:a_song_of_ice_and_fire')).toBe('A Song Of Ice And Fire');
  });

  it('keeps a name that already has capitals', () => {
    expect(seriesNameFromSubject('series:the_Lord_of_the_Rings')).toBe('the Lord of the Rings');
  });

  it('returns null for other subjects, an empty name and a name over 120 characters', () => {
    expect(seriesNameFromSubject('Fantasy')).toBeNull();
    expect(seriesNameFromSubject('series:')).toBeNull();
    expect(seriesNameFromSubject('series:   ')).toBeNull();
    expect(seriesNameFromSubject(`series:${'a'.repeat(121)}`)).toBeNull();
  });
});

describe('isSeriesSubject', () => {
  it('detects series subjects only', () => {
    expect(isSeriesSubject('series:Discworld')).toBe(true);
    expect(isSeriesSubject('Fiction, series')).toBe(false);
    expect(isSeriesSubject('Fantasy')).toBe(false);
  });
});

describe('seriesFromSubjects', () => {
  it('builds the id from the first usable series subject, with no position', () => {
    expect(
      seriesFromSubjects(['Fantasy', 'series:A Song of Ice and Fire', 'series:Other']),
    ).toEqual({
      id: 'ol:A Song of Ice and Fire',
      name: 'A Song of Ice and Fire',
      position: null,
    });
  });

  it('returns null when no subject is a series', () => {
    expect(seriesFromSubjects([])).toBeNull();
    expect(seriesFromSubjects(['Fantasy', 'Dragons'])).toBeNull();
  });

  it('skips an unusable series subject and takes the next', () => {
    expect(seriesFromSubjects(['series:', 'series:Discworld'])?.name).toBe('Discworld');
  });
});

describe('olSeriesName', () => {
  it('returns the name of an ol: id', () => {
    expect(olSeriesName('ol:A Song of Ice and Fire')).toBe('A Song of Ice and Fire');
  });

  it('returns null for UUIDs, empty names, control characters and long names', () => {
    expect(olSeriesName('0190f0f0-1234-7abc-8def-0123456789ab')).toBeNull();
    expect(olSeriesName('ol:')).toBeNull();
    expect(olSeriesName('ol:   ')).toBeNull();
    expect(olSeriesName(`ol:bad${String.fromCharCode(7)}name`)).toBeNull();
    expect(olSeriesName(`ol:${'a'.repeat(121)}`)).toBeNull();
  });
});

describe('seriesSearchQuery', () => {
  it('builds a subject query and strips double quotes', () => {
    expect(seriesSearchQuery('Discworld')).toBe('subject:"series:Discworld"');
    expect(seriesSearchQuery('Say "hi"')).toBe('subject:"series:Say hi"');
  });
});
