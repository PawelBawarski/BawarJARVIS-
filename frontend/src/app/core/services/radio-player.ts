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

  // JARVIS RADIO 4C.3 — bounded automatic failover
  // Only unexpected media errors/ends trigger failover; manual Stop/Pause never do.
  readonly failoverCount = signal(0);
  private readonly attemptedIds = new Set<string>();
  private readonly maxStationAttempts = 3; // Initial station + up to two fallbacks.

  private playableStream(station: RadioStation | null): string | null {
    if (!station?.streamUrl) return null;
    try {
      const url = new URL(station.streamUrl);
      return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }

  private releaseAudio(): void {
    const previous = this.audio;
    this.audio = null; // Invalidate old pending play() and event handlers before cleanup.
    if (previous) {
      previous.pause();
      previous.removeAttribute('src');
      previous.load();
    }
    this.isPlaying.set(false);
    this.isPaused.set(false);
    this.isLoading.set(false);
  }

  private async failedStream(audio: HTMLAudioElement): Promise<boolean> {
    if (this.audio !== audio) return false;
    const previousId = this.stationIdState();
    if (previousId) this.attemptedIds.add(previousId);
    this.releaseAudio();
    if (this.attemptedIds.size >= this.maxStationAttempts) {
      this.errorKey.set('radio.allStreamsFailed');
      return false;
    }
    const stations = this.stations();
    const previousIndex = stations.findIndex(s => s.id === previousId);
    // Circular order is deterministic; never retry a failed station within one chain.
    for (let offset = 1; offset <= stations.length; offset++) {
      const candidate = stations[(Math.max(0, previousIndex) + offset) % stations.length];
      if (!candidate || this.attemptedIds.has(candidate.id) || !this.playableStream(candidate)) continue;
      this.stationIdState.set(candidate.id);
      this.failoverCount.update(n => n + 1);
      this.errorKey.set('radio.switchingStation');
      return this.attemptStation(candidate);
    }
    this.errorKey.set('radio.allStreamsFailed');
    return false;
  }

  private async attemptStation(station: RadioStation): Promise<boolean> {
    const stream = this.playableStream(station);
    if (!stream) { this.errorKey.set('radio.invalidStream'); return false; }
    this.attemptedIds.add(station.id);
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = this.volumePercent() / 100;
    audio.src = stream;
    this.audio = audio;
    this.isLoading.set(true);
    audio.addEventListener('error', () => {
      if (this.audio === audio && !this.isPaused()) void this.failedStream(audio);
    });
    // Live streams ending unexpectedly should also attempt a different station.
    audio.addEventListener('ended', () => {
      if (this.audio === audio && !this.isPaused()) void this.failedStream(audio);
    });
    try {
      await audio.play();
      if (this.audio !== audio) { audio.pause(); return false; }
      this.isPlaying.set(true);
      this.isPaused.set(false);
      this.errorKey.set(null);
      return true;
    } catch {
      return this.failedStream(audio);
    } finally {
      if (this.audio === audio) this.isLoading.set(false);
    }
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
        this.errorKey.set(null);
        return true;
      } catch { return this.failedStream(existing); }
      finally { if (this.audio === existing) this.isLoading.set(false); }
    }
    const station = this.selectedStation();
    if (!station?.streamUrl) { this.errorKey.set('radio.streamUnavailable'); return false; }
    this.stop(); // A new manual Play begins a fresh bounded retry chain.
    return this.attemptStation(station);
  }

  pause(): void {
    if (!this.audio || !this.isPlaying()) return;
    this.audio.pause();
    this.isPlaying.set(false);
    this.isPaused.set(true);
  }

  stop(): void {
    this.releaseAudio();
    this.attemptedIds.clear();
    this.failoverCount.set(0);
    this.errorKey.set(null);
  }
}
