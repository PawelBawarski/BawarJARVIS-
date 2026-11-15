import { Injectable, inject, signal } from '@angular/core';
import { browserApi } from './browser-api';

interface InternetSetting { internetEnabled: boolean; }

/** DB-backed preference. No localStorage: server remains source of truth. */
@Injectable({ providedIn: 'root' })
export class InternetPreferenceService {
  readonly enabled = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal(false);

  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    try {
      const setting = await browserApi<InternetSetting>('GET', '/api/chats/web-settings');
      this.enabled.set(setting.internetEnabled === true);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async update(value: boolean): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(false);
    try {
      const setting = await browserApi<InternetSetting>(
        'PUT', '/api/chats/web-settings', { internetEnabled: value });
      this.enabled.set(setting.internetEnabled === true);
    } catch {
      // Do not claim persistence or mutate visible state when the write fails.
      this.error.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
