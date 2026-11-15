/** Text intended for the Piper voice engine, NOT for HTML rendering.
 * Strip Markdown decoration while retaining human-readable words and link labels.
 * Do not synthesize fenced source code: code tokens sound unnatural.
 */
export function speechPlainText(raw: string): string {
  if (!raw || raw.includes('\0')) return '';
  return raw
    .replace(/```[\s\S]*?```/g, '\nFragment kodu.\n')
    .replace(/~~~[\s\S]*?~~~/g, '\nFragment kodu.\n')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]*\)/g, '$1')
    .replace(/<https?:\/\/[^>]+>/g, 'odnośnik')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)*\s*\|?\s*$/gm, '')
    .replace(/\*\*|__|\*|(?<!\w)_(?!\w)|~~|`/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, 'mniejsze niż')
    .replace(/&gt;/g, 'większe niż').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\|/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}
