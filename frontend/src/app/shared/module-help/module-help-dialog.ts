import { DOCUMENT } from '@angular/common';
import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ModuleHelpService } from '../../core/services/module-help.service';
import { MODULE_HELP } from './module-help.data';

@Component({
  selector: 'app-module-help-dialog',
  standalone: true,
  templateUrl: './module-help-dialog.html',
  styleUrl: './module-help-dialog.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class ModuleHelpDialog {
  readonly help = inject(ModuleHelpService);
  readonly guides = MODULE_HELP;
  readonly copied = signal('');
  private readonly document = inject(DOCUMENT);
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private lastFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (!this.help.topic()) return;
      const button = this.closeButton();
      if (button) {
        if (!this.lastFocused) this.lastFocused = this.document.activeElement as HTMLElement | null;
        button.nativeElement.focus();
      }
    });
  }

  close(): void {
    if (!this.help.topic()) return;
    this.help.close();
    this.copied.set('');
    const trigger = this.lastFocused;
    this.lastFocused = null;
    queueMicrotask(() => trigger?.isConnected && trigger.focus());
  }

  backdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  trapTab(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }
    const parent = event.currentTarget as HTMLElement;
    const elements = [
      ...parent.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled])',
      ),
    ];
    if (!elements.length) {
      event.preventDefault();
      return;
    }
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async copyCommand(command: string): Promise<void> {
    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      if (clipboard) {
        await clipboard.writeText(command);
      } else {
        const textarea = this.document.createElement('textarea');
        textarea.value = command;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        this.document.body.appendChild(textarea);
        textarea.select();
        const copied = this.document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('Clipboard not available');
      }
      this.copied.set('Skopiowano polecenie.');
    } catch {
      this.copied.set('Nie udało się skopiować. Zaznacz polecenie ręcznie.');
    }
  }
}
