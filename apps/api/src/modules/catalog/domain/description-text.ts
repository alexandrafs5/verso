/**
 * Open Library descriptions are free text that often carries Markdown (`***Title***`, links) and
 * boilerplate after a horizontal rule. The UI shows plain text, so this strips that. Pure, no
 * Nest or Prisma imports. Returns null when nothing is left.
 */
export function plainDescription(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.replace(/\r\n?/g, '\n');
  // Everything after a horizontal rule is source notes ("Contained in: ...").
  text = text.split(/\n[ \t]*-{5,}[ \t]*(?:\n|$)/)[0] ?? text;
  text = text
    .replace(/^\[\d+\]:.*$/gm, '') // reference definitions
    .replace(/\(\[source\]\[\d*\]\)/gi, '') // "([source][1])"
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // inline links
    .replace(/\[([^\]]+)\]\[\d*\]/g, '$1') // reference links
    .replace(/^#{1,6}[ \t]*/gm, '') // headings
    .replace(/(\*{1,3})(?=\S)([\s\S]*?\S)\1/g, '$2') // *emphasis*, **bold**, ***both***
    .replace(/(?<!\w)(_{1,3})(?=\S)([^_\n]*?\S)\1(?!\w)/g, '$2') // _emphasis_
    .replace(/\*{2,}/g, '') // stray markers
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text === '' ? null : text;
}
