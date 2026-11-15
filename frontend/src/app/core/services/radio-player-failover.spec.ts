import { afterEach, describe, expect, it, vi } from 'vitest';
import { RadioPlayerService } from './radio-player';

const stations = [
  { id: 'one', name: 'One', countryCode: 'PL' as const, streamUrl: 'https://example.org/1.mp3' },
  { id: 'two', name: 'Two', countryCode: 'PL' as const, streamUrl: 'https://example.org/2.mp3' },
  { id: 'three', name: 'Three', countryCode: 'PL' as const, streamUrl: 'https://example.org/3.mp3' },
  { id: 'four', name: 'Four', countryCode: 'PL' as const, streamUrl: 'https://example.org/4.mp3' },
];

const originalAudio = globalThis.Audio;
class FakeAudio {
  static instances: FakeAudio[] = [];
  static rejectNext = new Set<number>();
  readonly listeners = new Map<string, Array<() => void>>();
  preload = '';
  volume = 0;
  src = '';
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
  play = vi.fn(async () => {
    if (FakeAudio.rejectNext.has(FakeAudio.instances.indexOf(this))) throw new Error('stream rejected');
  });
  constructor() { FakeAudio.instances.push(this); }
  addEventListener(type: string, callback: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) || []), callback]);
  }
  fire(type: string): void { this.listeners.get(type)?.forEach(callback => callback()); }
}

afterEach(() => {
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: originalAudio });
  FakeAudio.instances.length = 0;
  FakeAudio.rejectNext.clear();
});

function player(): RadioPlayerService {
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
  const result = new RadioPlayerService();
  result.setStations('PL', stations);
  return result;
}

async function tick(): Promise<void> { await new Promise(resolve => setTimeout(resolve, 0)); }

describe('Radio 4C.3 automatic stream failover', () => {
  it('switches to next playable station on an audio error and keeps playing', async () => {
    const radio = player();
    expect(await radio.play()).toBe(true);
    FakeAudio.instances[0].fire('error');
    await tick();
    expect(radio.stationId()).toBe('two');
    expect(radio.isPlaying()).toBe(true);
    expect(radio.failoverCount()).toBe(1);
    expect(FakeAudio.instances).toHaveLength(2);
    // A late event from a destroyed element must be ignored.
    FakeAudio.instances[0].fire('error');
    expect(radio.stationId()).toBe('two');
  });

  it('tries at most three different stations, then stops with a meaningful error', async () => {
    const radio = player();
    FakeAudio.rejectNext.add(0);
    FakeAudio.rejectNext.add(1);
    FakeAudio.rejectNext.add(2);
    expect(await radio.play()).toBe(false);
    expect(FakeAudio.instances).toHaveLength(3);
    expect(radio.isPlaying()).toBe(false);
    expect(radio.errorKey()).toBe('radio.allStreamsFailed');
    expect(radio.failoverCount()).toBe(2);
    expect(radio.stationId()).toBe('three');
  });

  it('does not switch on Pause or Stop, or from an old media event', async () => {
    const radio = player();
    expect(await radio.play()).toBe(true);
    const initial = FakeAudio.instances[0];
    radio.pause();
    expect(radio.stationId()).toBe('one');
    expect(radio.isPaused()).toBe(true);
    initial.fire('error');
    await tick();
    expect(radio.stationId()).toBe('one');
    radio.stop();
    initial.fire('error');
    await tick();
    expect(radio.stationId()).toBe('one');
    expect(FakeAudio.instances).toHaveLength(1);
    expect(radio.failoverCount()).toBe(0);
  });

  it('ignores late failure after explicit station change', async () => {
    const radio = player();
    await radio.play();
    const stale = FakeAudio.instances[0];
    radio.selectStation('four');
    stale.fire('ended');
    await tick();
    expect(radio.stationId()).toBe('four');
    expect(radio.failoverCount()).toBe(0);
  });
});
