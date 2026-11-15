import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { NetworkStatusService } from '../../core/services/network-status';
import { RadioCatalogService } from '../../core/services/radio-catalog';
import { RadioFavoritesService } from '../../core/services/radio-favorites';
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
  readonly favorites = inject(RadioFavoritesService);
  readonly search = signal('');
  readonly stationDropdownOpen = signal(false);
  readonly favoritesOnly = signal(false);
  readonly filteredStations = computed(() => {
    const term = this.search().trim().toLocaleLowerCase();
    return this.player.stations().filter(station =>
      (!this.favoritesOnly() || this.favorites.has(station.id)) &&
      (!term || station.name.toLocaleLowerCase().includes(term)));
  });
  readonly selectedVisibleId = computed(() => this.filteredStations().some(station => station.id === this.player.stationId()) ? this.player.stationId() : '');
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private requestId = 0;

  toggle(): void {
    const open = !this.isOpen();
    this.isOpen.set(open);
    if (!open) this.stationDropdownOpen.set(false);
    // Opening/closing a popover must not restart the active audio stream.
    // Fetch the catalog only when no playable stations are cached.
    if (open) void this.favorites.refresh();
    if (open && !this.player.stations().some(station => !!station.streamUrl) && !this.player.catalogLoading()) {
      void this.refreshStations();
    }
  }
  close(): void { this.stationDropdownOpen.set(false); this.isOpen.set(false); }
  toggleStationDropdown(): void {
    this.stationDropdownOpen.update(open => !open);
    this.search.set('');
  }
  chooseStation(id: string): void {
    this.onStationChange(id);
    this.stationDropdownOpen.set(false);
    this.search.set('');
  }
  onStationSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.stopPropagation(); this.stationDropdownOpen.set(false); }
    else if (event.key === 'Enter' && this.filteredStations().length === 1) {
      event.preventDefault(); this.chooseStation(this.filteredStations()[0].id);
    }
  }

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
    this.stationDropdownOpen.set(false);
    this.search.set('');
    this.player.selectCountry(code);
    void this.refreshStations();
  }
  onStationChange(id: string): void { this.player.selectStation(id); }
  onSearch(value: string): void { this.search.set(value); }
  onFavoritesOnly(checked: boolean): void { this.favoritesOnly.set(checked); }
  async toggleFavorite(): Promise<void> {
    const station = this.player.selectedStation();
    if (station?.streamUrl) await this.favorites.toggle(station);
  }
  onVolumeChange(value: string): void { this.player.setVolumePercent(Number(value)); }
  onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Node && !this.hostElement.nativeElement.contains(target)) this.close();
    else if (this.stationDropdownOpen() && target instanceof Node &&
      !(target instanceof Element && target.closest('.radio-panel__station-field')) &&
      !((target as Element).parentElement?.closest('.radio-panel__station-field'))) {
      this.stationDropdownOpen.set(false);
      this.search.set('');
    }
  }
}
