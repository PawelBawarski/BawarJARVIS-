import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RadioStation } from '../../features/radio/models/radio-station';

@Injectable({ providedIn: 'root' })
export class RadioFavoritesService {
  private readonly http = inject(HttpClient, { optional: true });
  readonly entries = signal<readonly RadioStation[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly busyId = signal<string | null>(null);

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      if (!this.http) throw new Error('Radio API unavailable');
      const response = await firstValueFrom(this.http.get<RadioStation[]>('/api/radio/favorites'));
      this.entries.set(Array.isArray(response) ? response : []);
      this.error.set(false);
    } catch { this.error.set(true); }
    finally { this.loading.set(false); }
  }

  has(id: string): boolean { return this.entries().some(station => station.id === id); }

  async toggle(station: RadioStation): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(station.id);
    try {
      if (!this.http) throw new Error('Radio API unavailable');
      if (this.has(station.id)) {
        await firstValueFrom(this.http.delete<void>(`/api/radio/favorites/${encodeURIComponent(station.id)}`));
        this.entries.update(items => items.filter(item => item.id !== station.id));
      } else {
        if (!station.streamUrl) return;
        await firstValueFrom(this.http.post<void>('/api/radio/favorites', station));
        this.entries.update(items => [station, ...items.filter(item => item.id !== station.id)]);
      }
      this.error.set(false);
    } catch { this.error.set(true); }
    finally { this.busyId.set(null); }
  }
}
