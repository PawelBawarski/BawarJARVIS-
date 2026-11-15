import { Injectable, signal } from '@angular/core';
import { browserApi } from './browser-api';

export interface ChatGenerationSettings {
  chatMaxTokens: number;
  minTokens: number;
  maxTokens: number;
}

/** DB-backed preference exclusively for local Qwen Chat inference. */
@Injectable({ providedIn: 'root' })
export class ChatGenerationPreferenceService {
  readonly value = signal(256);
  readonly min = signal(64);
  readonly max = signal(1024);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal(false);

  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    try {
      const setting = await browserApi<ChatGenerationSettings>('GET', '/api/chats/generation-settings');
      this.setResponse(setting);
    } catch { this.error.set(true); }
    finally { this.loading.set(false); }
  }

  async update(value: number): Promise<void> {
    if (this.saving() || !Number.isInteger(value) || value < this.min() || value > this.max()) {
      this.error.set(true);
      return;
    }
    this.saving.set(true);
    this.error.set(false);
    try {
      const setting = await browserApi<ChatGenerationSettings>('PUT', '/api/chats/generation-settings', {chatMaxTokens: value});
      this.setResponse(setting);
    } catch { this.error.set(true); }
    finally { this.saving.set(false); }
  }

  private setResponse(setting: ChatGenerationSettings): void {
    if (!Number.isInteger(setting.chatMaxTokens) || !Number.isInteger(setting.minTokens) ||
        !Number.isInteger(setting.maxTokens) || setting.chatMaxTokens < setting.minTokens ||
        setting.chatMaxTokens > setting.maxTokens) {
      throw new Error('Invalid backend generation settings');
    }
    this.min.set(setting.minTokens);
    this.max.set(setting.maxTokens);
    this.value.set(setting.chatMaxTokens);
  }
}
