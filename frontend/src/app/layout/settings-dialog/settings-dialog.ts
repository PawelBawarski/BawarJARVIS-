import { ChangeDetectionStrategy } from '@angular/core';
import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { InternetPreferenceService } from '../../core/services/internet-preference';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';

import { PreferencesControls } from '../../shared/ui/preferences-controls/preferences-controls';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings-dialog',
  imports: [TranslatePipe, PreferencesControls],
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
})
export class SettingsDialog {
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialogElement');

  private readonly internet = inject(InternetPreferenceService);

  open(): void {
    void this.internet.load();
    const element = this.dialog()?.nativeElement;

    if (element && !element.open) {
      element.showModal();
    }
  }

  close(): void {
    const element = this.dialog()?.nativeElement;

    if (element?.open) {
      element.close();
    }
  }

  onDialogClick(event: MouseEvent): void {
    // Kliknięcie w tło, a nie w zawartość okna.
    if (event.target === this.dialog()?.nativeElement) {
      this.close();
    }
  }
}
