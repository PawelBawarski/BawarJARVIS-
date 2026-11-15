import { describe, expect, it, vi } from 'vitest';
import { RadioPlayerService } from './radio-player';

describe('RadioPlayerService streaming', () => {
  it('can play, pause, resume and stop a returned HTTPS stream', async () => {
    const oldAudio = globalThis.Audio;
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    const load = vi.fn();
    class FakeAudio {
      preload = '';
      volume = 0;
      src = '';
      play = play;
      pause = pause;
      load = load;
      addEventListener = vi.fn();
      removeAttribute = vi.fn();
    }
    Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
    try {
      const player = new RadioPlayerService();
      player.setStations('PL', [{ id: 'demo', name: 'Demo', countryCode: 'PL', streamUrl: 'https://example.org/live.mp3' }]);
      expect(await player.play()).toBe(true);
      expect(player.isPlaying()).toBe(true);
      player.pause();
      expect(player.isPaused()).toBe(true);
      expect(player.isPlaying()).toBe(false);
      expect(await player.play()).toBe(true);
      player.stop();
      expect(player.isPlaying()).toBe(false);
      expect(player.isPaused()).toBe(false);
      expect(play).toHaveBeenCalledTimes(2);
      expect(pause).toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'Audio', { configurable: true, value: oldAudio });
    }
  });
  it('does not accept stale catalog results after changing country', () => {
    const player = new RadioPlayerService();
    player.selectCountry('GB');
    player.setStations('PL', [{ id: 'stale', name: 'Stale', countryCode: 'PL', streamUrl: 'https://example.org/stream' }]);
    expect(player.countryCode()).toBe('GB');
    expect(player.selectedStation()?.name).toBe('BBC Radio 1');
  });
});
