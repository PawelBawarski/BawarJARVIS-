import { Component, ElementRef, inject, signal } from '@angular/core';

import { RadioPlayerService } from '../../core/services/radio-player';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-radio-panel',
  imports: [TranslatePipe],
  templateUrl: './radio-panel.html',
  styleUrl: './radio-panel.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class RadioPanel {
  readonly player = inject(RadioPlayerService);
  readonly isOpen = signal(false);

  private readonly hostElement = inject(ElementRef<HTMLElement>);

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  close(): void {
    this.isOpen.set(false);
  }

  onCountryChange(code: string): void {
    this.player.selectCountry(code);
  }

  onStationChange(id: string): void {
    this.player.selectStation(id);
  }

  onVolumeChange(value: string): void {
    this.player.setVolumePercent(Number(value));
  }

  onDocumentClick(event: MouseEvent): void {
    const target = event.target;

    if (target instanceof Node && !this.hostElement.nativeElement.contains(target)) {
      this.close();
    }
  }
}
