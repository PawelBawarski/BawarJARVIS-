import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { NetworkStatusService } from '../../core/services/network-status';
import { RadioCatalogService } from '../../core/services/radio-catalog';
import { RadioPlayerService } from '../../core/services/radio-player';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  readonly network = inject(NetworkStatusService);
  private readonly catalog = inject(RadioCatalogService);
  readonly isOpen = signal(false);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private requestId = 0;

  toggle(): void {
    const open = !this.isOpen();
    this.isOpen.set(open);
    // Opening/closing a popover must not restart the active audio stream.
    // Fetch the catalog only when no playable stations are cached.
    if (open && !this.player.stations().some(station => !!station.streamUrl) && !this.player.catalogLoading()) {
      void this.refreshStations();
    }
  }
  close(): void { this.isOpen.set(false); }

  async refreshStations(): Promise<void> {
    if (this.network.isOffline()) {
      this.player.errorKey.set('radio.offline');
      return;
    }
    const country = this.player.countryCode();
    const requestId = ++this.requestId;
    this.player.catalogLoading.set(true);
    try {
      const stations = await this.catalog.load(country);
      if (requestId !== this.requestId) return;
      this.player.setStations(country, stations);
      if (!stations.length) this.player.errorKey.set('radio.noStations');
    } catch {
      if (requestId === this.requestId) this.player.errorKey.set('radio.catalogFailed');
    } finally {
      if (requestId === this.requestId) this.player.catalogLoading.set(false);
    }
  }

  onCountryChange(code: string): void {
    ++this.requestId;
    this.player.selectCountry(code);
    void this.refreshStations();
  }
  onStationChange(id: string): void { this.player.selectStation(id); }
  onVolumeChange(value: string): void { this.player.setVolumePercent(Number(value)); }
  onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Node && !this.hostElement.nativeElement.contains(target)) this.close();
  }
}
