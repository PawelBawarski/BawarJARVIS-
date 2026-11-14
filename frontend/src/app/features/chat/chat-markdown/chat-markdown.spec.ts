import { describe, expect, it } from 'vitest';
import { renderChatMarkdown } from './chat-markdown';

describe('M07 Markdown renderer', () => {
  it('renders headings, lists and emphasis', () => {
    const result = renderChatMarkdown('# Hello\n\n- First\n- Second\n\n**bold**'.replace(/\\n/g, '\n'));
    expect(result).toContain('<h1>Hello</h1>');
    expect(result).toContain('<li>First</li>');
    expect(result).toContain('<strong>bold</strong>');
  });
  it('renders fenced code without interpreting code tags', () => {
    const result = renderChatMarkdown('```html\n<script>alert(1)</script>\n```'.replace(/\\n/g, '\n'));
    expect(result).toContain('<pre>');
    expect(result).toContain('&lt;script&gt;');
  });
  it('renders GFM tables', () => {
    const result = renderChatMarkdown('| A | B |\n|---|---|\n| 1 | 2 |'.replace(/\\n/g, '\n'));
    expect(result).toContain('<table>');
    expect(result).toContain('<td>1</td>');
  });
  it('escapes raw HTML supplied by a model', () => {
    const result = renderChatMarkdown('<img src=x onerror=alert(1)>');
    expect(result).toContain('&lt;img');
    expect(result).not.toContain('<img');
  });
});
