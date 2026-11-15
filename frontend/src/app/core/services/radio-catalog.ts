import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RadioCountryCode, RadioStation } from '../../features/radio/models/radio-station';

@Injectable({ providedIn: 'root' })
export class RadioCatalogService {
  private readonly http = inject(HttpClient, { optional: true });

  async load(country: RadioCountryCode): Promise<RadioStation[]> {
    if (!this.http) throw new Error('Radio API unavailable');
    const items = await firstValueFrom(this.http.get<RadioStation[]>('/api/radio/stations', {
      params: { country },
    }));
    return Array.isArray(items) ? items.filter((station) =>
      station.countryCode === country && !!station.id && !!station.name &&
      typeof station.streamUrl === 'string' && station.streamUrl.startsWith('https://'),
    ) : [];
  }
}
