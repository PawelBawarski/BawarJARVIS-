import { ChangeDetectionStrategy, Component, computed, inject, input, signal, ViewEncapsulation } from '@angular/core';
import { marked, Renderer } from 'marked';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

/** Escape raw HTML from LLM output before handing the rendered result to Angular. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const renderer = new Renderer();
renderer.html = ({ text }) => escapeHtml(text);

/** Angular [innerHTML] sanitizes the generated HTML again; never bypassSecurityTrustHtml. */
export function renderChatMarkdown(content: string): string {
  return marked.parse(content, { async: false, gfm: true, breaks: true, renderer }) as string;
}

@Component({
  selector: 'app-chat-markdown',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="jarvis-markdown" data-testid="chat-markdown">
      <div class="jarvis-markdown__body" [innerHTML]="html()"></div>
      <div class="jarvis-markdown__actions">
        <button type="button" class="jarvis-markdown__copy" data-testid="chat-copy-answer"
          (click)="copyAnswer()">{{ 'chat.copyAnswer' | translate }}</button>
        @if (copyError()) { <span role="status">{{ 'chat.copyFailed' | translate }}</span> }
      </div>
    </div>
  `,
  styleUrl: './chat-markdown.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Styles are scoped to .jarvis-markdown; HTML inserted by [innerHTML] is not compiled by Angular.
  encapsulation: ViewEncapsulation.None,
})
export class ChatMarkdown {
  readonly content = input.required<string>();
  readonly html = computed(() => renderChatMarkdown(this.content()));
  readonly copyError = signal(false);

  async copyAnswer(): Promise<void> {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(this.content());
      this.copyError.set(false);
    } catch {
      this.copyError.set(true);
    }
  }
}
