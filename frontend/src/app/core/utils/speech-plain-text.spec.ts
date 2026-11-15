import { describe, expect, it } from 'vitest';
import { speechPlainText } from './speech-plain-text';

describe('Chat speech normalisation', () => {
  it('does not pronounce Markdown asterisks or underscores', () => {
    expect(speechPlainText('**Ważne** i *krótko* oraz __mocno__.')).toBe('Ważne i krótko oraz mocno.');
  });
  it('keeps link titles, list words and headings', () => {
    expect(speechPlainText('# Temat\n- **Angular**\n- [Dokumentacja](https://angular.dev)'))
      .toBe('Temat Angular Dokumentacja');
  });
  it('does not read fenced code syntax', () => {
    expect(speechPlainText('Opis.\n```java\nSystem.out.println("x");\n```\nKoniec.'))
      .toBe('Opis. Fragment kodu. Koniec.');
  });
  it('strips markup without altering underlying assistant content', () => {
    const source='**Hello**';
    expect(speechPlainText(source)).toBe('Hello');
    expect(source).toBe('**Hello**');
  });
  it('does not read HTML/script tags', () => {
    expect(speechPlainText('Cześć <em>świecie</em>')).toBe('Cześć świecie');
  });
});
