import { afterEach, describe, expect, it, vi } from 'vitest';
import { RadioPlayerService } from './radio-player';

const originalAudio = globalThis.Audio;
class FakeAudio {
  static instances: FakeAudio[] = [];
  readonly listeners = new Map<string, Array<() => void>>();
  preload = '';
  volume = 0;
  src = '';
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
  play = vi.fn(async () => undefined);
  constructor() { FakeAudio.instances.push(this); }
  addEventListener(type: string, callback: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), callback]);
  }
  fire(type: string): void { this.listeners.get(type)?.forEach(callback => callback()); }
}

function createPlayer(): RadioPlayerService {
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
  const player = new RadioPlayerService();
  player.setStations('PL', [
    { id: 'one', name: 'One', countryCode: 'PL', streamUrl: 'https://example.org/one.mp3' },
    { id: 'two', name: 'Two', countryCode: 'PL', streamUrl: 'https://example.org/two.mp3' },
    { id: 'three', name: 'Three', countryCode: 'PL', streamUrl: 'https://example.org/three.mp3' },
  ]);
  return player;
}
async function flush(): Promise<void> { for (let i = 0; i < 6; i++) await Promise.resolve(); }

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: originalAudio });
  FakeAudio.instances.length = 0;
});

describe('Radio 4C.4 — stalled-stream safety', () => {
  it('switches once after 12 seconds of stalled playback', async () => {
    vi.useFakeTimers();
    const player = createPlayer();
    expect(await player.play()).toBe(true);
    FakeAudio.instances[0].fire('stalled');
    await vi.advanceTimersByTimeAsync(11_999);
    expect(player.stationId()).toBe('one');
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(player.stationId()).toBe('two');
    expect(player.failoverCount()).toBe(1);
    expect(player.isPlaying()).toBe(true);
  });

  it('never switches after Pause even if stale events arrive', async () => {
    vi.useFakeTimers();
    const player = createPlayer();
    await player.play();
    FakeAudio.instances[0].fire('waiting');
    player.pause();
    FakeAudio.instances[0].fire('error');
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    expect(player.stationId()).toBe('one');
    expect(player.failoverCount()).toBe(0);
    expect(player.isPaused()).toBe(true);
  });

  it('manual Stop cancels the watchdog and ignores late errors', async () => {
    vi.useFakeTimers();
    const player = createPlayer();
    await player.play();
    FakeAudio.instances[0].fire('stalled');
    player.stop();
    FakeAudio.instances[0].fire('error');
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    expect(player.failoverCount()).toBe(0);
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('progress clears stalled watchdog; retries stay capped at three', async () => {
    vi.useFakeTimers();
    const player = createPlayer();
    await player.play();
    FakeAudio.instances[0].fire('waiting');
    FakeAudio.instances[0].fire('playing');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(player.stationId()).toBe('one');
    for (let n = 0; n < 3; n++) {
      FakeAudio.instances[n].fire('stalled');
      await vi.advanceTimersByTimeAsync(12_000);
      await flush();
    }
    expect(FakeAudio.instances).toHaveLength(3);
    expect(player.errorKey()).toBe('radio.allStreamsFailed');
    expect(player.isPlaying()).toBe(false);
  });
});
