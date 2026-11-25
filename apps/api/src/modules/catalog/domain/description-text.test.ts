import { describe, expect, it } from 'vitest';
import { plainDescription } from './description-text';

describe('plainDescription', () => {
  it('returns null for empty input', () => {
    expect(plainDescription(null)).toBeNull();
    expect(plainDescription(undefined)).toBeNull();
    expect(plainDescription('  \r\n ')).toBeNull();
  });

  it('keeps plain text unchanged', () => {
    expect(plainDescription('A man travels to Comala.')).toBe('A man travels to Comala.');
  });

  it('strips emphasis markers', () => {
    expect(
      plainDescription(
        '***A Game of Thrones*** is the first book by **George R. R. Martin**, _really_.',
      ),
    ).toBe('A Game of Thrones is the first book by George R. R. Martin, really.');
  });

  it('keeps underscores inside words', () => {
    expect(plainDescription('see snake_case_name here')).toBe('see snake_case_name here');
  });

  it('turns links and images into their text and drops reference definitions', () => {
    expect(
      plainDescription(
        'Read [the novel](https://example.org/x) and ![cover](https://example.org/c.jpg) ([source][1])\n\n[1]: https://example.org/s',
      ),
    ).toBe('Read the novel and cover');
  });

  it('drops headings markers and normalizes line breaks', () => {
    expect(plainDescription('# Title\r\n\r\n\r\n\r\nBody  \r\nnext')).toBe('Title\n\nBody\nnext');
  });

  it('cuts the source notes after a horizontal rule', () => {
    expect(plainDescription('Real text.\r\n\r\n----------\r\nContained in: Omnibus')).toBe(
      'Real text.',
    );
  });
});
