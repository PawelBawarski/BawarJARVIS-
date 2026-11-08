import { computed, Injectable, signal } from '@angular/core';

import {
  RADIO_COUNTRIES,
  RADIO_PREVIEW_STATIONS,
  RadioCountryCode,
} from '../../features/radio/models/radio-station';

@Injectable({
  providedIn: 'root',
})
export class RadioPlayerService {
  readonly countries = RADIO_COUNTRIES;

  private readonly countryState = signal<RadioCountryCode>('PL');

  private readonly stationIdState = signal<string | null>('pl-rmf');

  readonly countryCode = this.countryState.asReadonly();
  readonly stationId = this.stationIdState.asReadonly();

  readonly volumePercent = signal(60);
  readonly isPlaying = signal(false);
  readonly errorKey = signal<string | null>(null);

  readonly stations = computed(() =>
    RADIO_PREVIEW_STATIONS.filter((station) => station.countryCode === this.countryState()),
  );

  readonly selectedStation = computed(
    () => this.stations().find((station) => station.id === this.stationIdState()) ?? null,
  );

  readonly canPlay = computed(() => !!this.selectedStation()?.streamUrl);

  private audio: HTMLAudioElement | null = null;

  selectCountry(code: string): void {
    const country = RADIO_COUNTRIES.find((item) => item.code === code);

    if (!country) {
      return;
    }

    this.stop();

    this.countryState.set(country.code);

    const firstStation = this.stations()[0];

    this.stationIdState.set(firstStation?.id ?? null);
  }

  selectStation(id: string): void {
    const station = this.stations().find((item) => item.id === id);

    if (!station) {
      return;
    }

    this.stop();
    this.stationIdState.set(station.id);
  }

  setVolumePercent(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }

    const volume = Math.min(100, Math.max(0, Math.round(value)));

    this.volumePercent.set(volume);

    if (this.audio) {
      this.audio.volume = volume / 100;
    }
  }

  async play(): Promise<boolean> {
    const streamUrl = this.selectedStation()?.streamUrl;

    if (!streamUrl) {
      this.errorKey.set('radio.streamUnavailable');
      return false;
    }

    // Wstępne sprawdzenie formatu URL.
    // Nie zastępuje bezpieczeństwa po stronie BE.
    let url: URL;

    try {
      url = new URL(streamUrl);
    } catch {
      this.errorKey.set('radio.invalidStream');
      return false;
    }

    if (url.protocol !== 'https:' || url.username || url.password) {
      this.errorKey.set('radio.invalidStream');
      return false;
    }

    this.stop();

    const audio = new Audio();

    audio.preload = 'none';
    audio.volume = this.volumePercent() / 100;
    audio.src = url.href;

    this.audio = audio;

    audio.addEventListener('error', () => {
      if (this.audio !== audio) {
        return;
      }

      this.stop();
      this.errorKey.set('radio.playbackFailed');
    });

    try {
      await audio.play();

      if (this.audio !== audio) {
        audio.pause();
        return false;
      }

      this.isPlaying.set(true);
      return true;
    } catch {
      if (this.audio === audio) {
        this.stop();
        this.errorKey.set('radio.playbackFailed');
      }

      return false;
    }
  }

  stop(): void {
    const previousAudio = this.audio;
    this.audio = null;

    if (previousAudio) {
      previousAudio.pause();
      previousAudio.removeAttribute('src');
    }

    this.isPlaying.set(false);
    this.errorKey.set(null);
  }
}
