import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalTtsApi } from './local-tts-api';
import { LocalTtsPlayer } from './local-tts-player';
import { ModuleNavigationService } from './module-navigation.service';

class FakeAudio {
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_src: string) {}
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  removeAttribute = vi.fn();
  load = vi.fn();
}
const wav = new Blob(['RIFF....WAVE' + '.'.repeat(40)], { type: 'audio/wav' });

describe('21.1 explicit audio playback', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('never synthesizes on initialization; stops and revokes a generated URL', async () => {
    const api = {
      status: vi.fn().mockResolvedValue({ enabled: true, configuredPl: true, configuredEn: true }),
      synthesize: vi.fn().mockResolvedValue(wav),
    };
    const revoke = vi.fn();
    vi.stubGlobal('Audio', FakeAudio);
    const RealURL = URL;
    vi.stubGlobal(
      'URL',
      class extends RealURL {
        static override createObjectURL = vi.fn(() => 'blob:test');
        static override revokeObjectURL = revoke;
      },
    );
    TestBed.configureTestingModule({ providers: [{ provide: LocalTtsApi, useValue: api }] });
    const navigation = TestBed.inject(ModuleNavigationService);
    navigation.select('chat');
    const player = TestBed.inject(LocalTtsPlayer);
    await player.checkAvailability();
    await player.checkAvailability();
    expect(api.status).toHaveBeenCalledTimes(1);
    expect(api.synthesize).not.toHaveBeenCalled();
    await player.read('id-1', 'Odpowiedź Jarvisa', 'pl');
    expect(api.synthesize).toHaveBeenCalledTimes(1);
    expect(player.phase()).toBe('playing');
    player.stop();
    expect(player.phase()).toBe('idle');
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
