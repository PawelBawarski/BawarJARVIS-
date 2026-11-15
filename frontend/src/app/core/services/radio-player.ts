import { computed, Injectable, signal } from '@angular/core';
import { RADIO_COUNTRIES, RADIO_PREVIEW_STATIONS, RadioCountryCode, RadioStation } from '../../features/radio/models/radio-station';

@Injectable({ providedIn: 'root' })
export class RadioPlayerService {
  readonly countries = RADIO_COUNTRIES;
  private readonly countryState = signal<RadioCountryCode>('PL');
  private readonly stationIdState = signal<string | null>('pl-rmf');
  private readonly catalog = signal<readonly RadioStation[]>(RADIO_PREVIEW_STATIONS);

  readonly countryCode = this.countryState.asReadonly();
  readonly stationId = this.stationIdState.asReadonly();
  readonly volumePercent = signal(60);
  readonly isPlaying = signal(false);
  readonly isPaused = signal(false);
  readonly isLoading = signal(false);
  readonly catalogLoading = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly stations = computed(() => this.catalog().filter((s) => s.countryCode === this.countryState()));
  readonly selectedStation = computed(() => this.stations().find((s) => s.id === this.stationIdState()) ?? null);
  readonly canPlay = computed(() => !!this.selectedStation()?.streamUrl);
  private audio: HTMLAudioElement | null = null;

  setStations(country: RadioCountryCode, stations: readonly RadioStation[]): void {
    if (country !== this.countryState()) return; // Ignore stale HTTP responses after country changes.
    const selectedId = this.stationIdState();
    const previousStation = this.selectedStation();
    const matchingStation = stations.find(station => station.id === selectedId);
    // Refreshing metadata must not destroy the HTMLAudioElement for the same stream.
    const sameStream = !!matchingStation?.streamUrl && !!previousStation?.streamUrl
      && matchingStation.streamUrl === previousStation.streamUrl;
    if (!sameStream) this.stop();
    this.catalog.set(stations);
    this.stationIdState.set(matchingStation?.id ?? stations[0]?.id ?? null);
  }

  selectCountry(code: string): void {
    const country = RADIO_COUNTRIES.find((c) => c.code === code);
    if (!country) return;
    this.stop();
    this.countryState.set(country.code);
    this.stationIdState.set(this.stations()[0]?.id ?? null);
  }

  selectStation(id: string): void {
    if (!this.stations().some((s) => s.id === id)) return;
    this.stop();
    this.stationIdState.set(id);
  }

  setVolumePercent(value: number): void {
    if (!Number.isFinite(value)) return;
    const next = Math.min(100, Math.max(0, Math.round(value)));
    this.volumePercent.set(next);
    if (this.audio) this.audio.volume = next / 100;
  }

  async play(): Promise<boolean> {
    if (this.audio && this.isPaused()) {
      const existing = this.audio;
      this.isLoading.set(true);
      try {
        await existing.play();
        if (this.audio !== existing) return false;
        this.isPaused.set(false);
        this.isPlaying.set(true);
        return true;
      } catch {
        this.errorKey.set('radio.playbackFailed');
        return false;
      } finally { this.isLoading.set(false); }
    }

    const stream = this.selectedStation()?.streamUrl;
    if (!stream) { this.errorKey.set('radio.streamUnavailable'); return false; }
    let url: URL;
    try { url = new URL(stream); } catch { this.errorKey.set('radio.invalidStream'); return false; }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
      this.errorKey.set('radio.invalidStream'); return false;
    }
    this.stop();
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = this.volumePercent() / 100;
    audio.src = url.href;
    this.audio = audio;
    this.isLoading.set(true);
    audio.addEventListener('error', () => {
      if (this.audio === audio) {
        this.stop();
        this.errorKey.set('radio.playbackFailed');
      }
    });
    audio.addEventListener('ended', () => { if (this.audio === audio) this.stop(); });
    try {
      await audio.play();
      if (this.audio !== audio) { audio.pause(); return false; }
      this.isPlaying.set(true);
      this.isPaused.set(false);
      return true;
    } catch {
      if (this.audio === audio) {
        this.stop();
        this.errorKey.set('radio.playbackFailed');
      }
      return false;
    } finally { this.isLoading.set(false); }
  }

  pause(): void {
    if (!this.audio || !this.isPlaying()) return;
    this.audio.pause();
    this.isPlaying.set(false);
    this.isPaused.set(true);
  }

  stop(): void {
    const previous = this.audio;
    this.audio = null;
    if (previous) {
      previous.pause();
      previous.removeAttribute('src');
      previous.load();
    }
    this.isPlaying.set(false);
    this.isPaused.set(false);
    this.isLoading.set(false);
    this.errorKey.set(null);
  }
}
