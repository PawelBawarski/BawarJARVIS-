import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalTtsPlayer } from './local-tts-player';
import { LocalTtsApi } from './local-tts-api';

/** Regression: Piper can be started later without reloading the entire Chat. */
describe('21.4 recoverable Piper status', () => {
  afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });

  it('rechecks a failed status explicitly without losing regular cached reads', async () => {
    const api = { status: vi.fn()
      .mockRejectedValueOnce(new Error('not ready'))
      .mockResolvedValue({ enabled: true, configuredPl: true, configuredEn: true }),
      synthesize: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: LocalTtsApi, useValue: api }] });
    const player = TestBed.inject(LocalTtsPlayer);
    await player.checkAvailability();
    expect(player.available()).toBeNull();
    await player.checkAvailability();
    expect(api.status).toHaveBeenCalledTimes(1);
    await player.checkAvailability(true);
    expect(player.available()?.configuredPl).toBe(true);
    expect(api.status).toHaveBeenCalledTimes(2);
    await player.checkAvailability();
    expect(api.status).toHaveBeenCalledTimes(2);
  });

  it('does not keep a pending status forever when an endpoint stops responding', async () => {
    const api = { status: vi.fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValue({ enabled: true, configuredPl: true, configuredEn: true }),
      synthesize: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: LocalTtsApi, useValue: api }] });
    const player = TestBed.inject(LocalTtsPlayer);
    vi.useFakeTimers();
    const pending = player.checkAvailability();
    await vi.advanceTimersByTimeAsync(4_501);
    await pending;
    expect(player.checked()).toBe(true);
    expect(player.available()).toBeNull();
    await player.checkAvailability(true);
    expect(player.available()?.configuredPl).toBe(true);
    expect(api.status).toHaveBeenCalledTimes(2);
  });
});
