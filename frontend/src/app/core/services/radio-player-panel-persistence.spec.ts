import { describe, expect, it, vi } from 'vitest';
import { RadioPlayerService } from './radio-player';

describe('Radio 4C: stable catalog updates while playing', () => {
  it('does not stop audio when refreshing the currently playing station', async () => {
    const original = globalThis.Audio;
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    class FakeAudio {
      volume = 0;
      preload = '';
      src = '';
      play = play;
      pause = pause;
      load = vi.fn();
      addEventListener = vi.fn();
      removeAttribute = vi.fn();
    }
    Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
    try {
      const service = new RadioPlayerService();
      const first = { id: 'pl-test', name: 'Test FM', countryCode: 'PL' as const, streamUrl: 'https://example.org/live.mp3' };
      service.setStations('PL', [first]);
      expect(await service.play()).toBe(true);
      service.setStations('PL', [{ ...first, name: 'Test FM (updated)' }]);
      expect(service.isPlaying()).toBe(true);
      expect(service.selectedStation()?.id).toBe('pl-test');
      expect(pause).not.toHaveBeenCalled();
      expect(play).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(globalThis, 'Audio', { configurable: true, value: original });
    }
  });

  it('stops playback if the selected stream changes on refresh', async () => {
    const original = globalThis.Audio;
    const pause = vi.fn();
    class FakeAudio {
      volume = 0;
      preload = '';
      src = '';
      play = vi.fn().mockResolvedValue(undefined);
      pause = pause;
      load = vi.fn();
      addEventListener = vi.fn();
      removeAttribute = vi.fn();
    }
    Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
    try {
      const service = new RadioPlayerService();
      service.setStations('PL', [{ id: 'pl-test', name: 'Test', countryCode: 'PL', streamUrl: 'https://example.org/a.mp3' }]);
      expect(await service.play()).toBe(true);
      service.setStations('PL', [{ id: 'pl-test', name: 'Test', countryCode: 'PL', streamUrl: 'https://example.org/b.mp3' }]);
      expect(service.isPlaying()).toBe(false);
      expect(pause).toHaveBeenCalledOnce();
    } finally {
      Object.defineProperty(globalThis, 'Audio', { configurable: true, value: original });
    }
  });
});
