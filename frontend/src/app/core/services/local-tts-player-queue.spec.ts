import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalTtsApi } from './local-tts-api';
import { LocalTtsPlayer } from './local-tts-player';
import { ModuleNavigationService } from './module-navigation.service';

class FakeAudio {
  static instances: FakeAudio[] = [];
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  removeAttribute = vi.fn();
  load = vi.fn();
  constructor(readonly src: string) {
    FakeAudio.instances.push(this);
  }
  finish(): void {
    this.onended?.();
  }
}

const wav = new Blob(['RIFF....WAVE' + '.'.repeat(40)], { type: 'audio/wav' });
function setup(synthesize: ReturnType<typeof vi.fn>) {
  const api = {
    status: vi.fn().mockResolvedValue({ enabled: true, configuredPl: true, configuredEn: true }),
    synthesize,
  };
  const revoked = vi.fn();
  const created = vi.fn(() => `blob:part-${FakeAudio.instances.length}`);
  FakeAudio.instances = [];
  vi.stubGlobal('Audio', FakeAudio);
  const NativeURL = URL;
  vi.stubGlobal(
    'URL',
    class extends NativeURL {
      static override createObjectURL = created;
      static override revokeObjectURL = revoked;
    },
  );
  TestBed.configureTestingModule({ providers: [{ provide: LocalTtsApi, useValue: api }] });
  TestBed.inject(ModuleNavigationService).select('chat');
  return { player: TestBed.inject(LocalTtsPlayer), api, revoked, created };
}

describe('21.2 sequential voice player', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('synthesizes one part at a time and releases every finished WAV', async () => {
    const { player, api, revoked } = setup(vi.fn().mockResolvedValue(wav));
    expect(api.synthesize).not.toHaveBeenCalled();
    await player.read('m1', 'Długa odpowiedź. '.repeat(90), 'pl');
    const total = player.partTotal();
    expect(total).toBeGreaterThan(1);
    expect(api.synthesize).toHaveBeenCalledTimes(1);
    expect(player.phase()).toBe('playing');
    for (let index = 1; index < total; index++) {
      FakeAudio.instances.at(-1)?.finish();
      await vi.waitFor(() => expect(api.synthesize).toHaveBeenCalledTimes(index + 1));
    }
    FakeAudio.instances.at(-1)?.finish();
    expect(player.phase()).toBe('idle');
    expect(player.activeId()).toBeNull();
    expect(revoked).toHaveBeenCalledTimes(total);
  });

  it('pauses and resumes without synthesizing again', async () => {
    const { player, api } = setup(vi.fn().mockResolvedValue(wav));
    await player.read('m2', 'Wiadomość testowa', 'pl');
    player.pause();
    expect(player.phase()).toBe('paused');
    expect(FakeAudio.instances[0].pause).toHaveBeenCalled();
    await player.resume();
    expect(player.phase()).toBe('playing');
    expect(api.synthesize).toHaveBeenCalledTimes(1);
    TestBed.inject(ModuleNavigationService).select('mining');
    TestBed.tick();
    expect(player.phase()).toBe('playing');
  });

  it('pauses an in-flight synthesis and only plays after explicit resume', async () => {
    let complete!: (value: Blob) => void;
    const synthesize = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          complete = resolve;
        }),
    );
    const { player } = setup(synthesize);
    const pending = player.read('m3', 'Tekst', 'pl');
    player.pause();
    expect(player.phase()).toBe('paused');
    complete(wav);
    await pending;
    expect(FakeAudio.instances[0].play).not.toHaveBeenCalled();
    await player.resume();
    expect(FakeAudio.instances[0].play).toHaveBeenCalledOnce();
  });

  it('discards a cancelled late synthesis without creating an audio URL', async () => {
    let complete!: (value: Blob) => void;
    const synthesize = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          complete = resolve;
        }),
    );
    const { player, created } = setup(synthesize);
    const pending = player.read('m4', 'Tekst', 'en');
    player.stop();
    complete(wav);
    await pending;
    expect(created).not.toHaveBeenCalled();
    expect(player.phase()).toBe('idle');
  });
});
