import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceConversationService } from './voice-conversation';
import { ChatStore } from './chat-store';
import { LocalTtsPlayer } from './local-tts-player';
import { ModuleNavigationService } from './module-navigation.service';
import { TranslationService } from './translation';

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>(r => { resolve = r; }), resolve };
}

function setup() {
  const currentChat = signal('chat-one');
  const messages = signal([
    { id: 'u1', role: 'user' as const, content: 'Jak działa silnik?' },
    { id: 'a1', role: 'assistant' as const, content: 'Silnik zamienia energię.' },
  ]);
  const store = {
    activeId: currentChat, messages,
    loading: signal(false), sending: signal(false), busy: signal(false),
    sendMessage: vi.fn(async () => true),
  };
  const activeId = signal<string | null>(null);
  const phase = signal<'idle' | 'playing' | 'error'>('idle');
  const player = {
    stop: vi.fn(), checkAvailability: vi.fn(async () => {}),
    available: signal({ enabled: true, configuredPl: true, configuredEn: true }),
    activeId, phase,
    read: vi.fn(async (_id: string) => { activeId.set(_id); phase.set('playing'); }),
  };
  TestBed.configureTestingModule({ providers: [
    { provide: ChatStore, useValue: store },
    { provide: LocalTtsPlayer, useValue: player },
    { provide: TranslationService, useValue: { language: signal('pl') } },
  ] });
  const navigation = TestBed.inject(ModuleNavigationService);
  navigation.select('chat');
  const voice = TestBed.inject(VoiceConversationService);
  return { store, player, voice, currentChat, messages, navigation };
}

describe('21.3 voice conversation — explicit consent and cancellation', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('does not send transcript when mode is off', async () => {
    const { voice, store, player } = setup();
    expect(await voice.acceptTranscript('Jak działa silnik?')).toBe('ignored');
    expect(store.sendMessage).not.toHaveBeenCalled();
    expect(player.read).not.toHaveBeenCalled();
  });

  it('sends one transcript after opt-in and reads only the returned Chat answer', async () => {
    const { voice, store, player } = setup();
    voice.enable();
    expect(await voice.acceptTranscript('Jak działa silnik?')).toBe('sent');
    expect(store.sendMessage).toHaveBeenCalledExactlyOnceWith('Jak działa silnik?');
    expect(player.read).toHaveBeenCalledExactlyOnceWith('a1', 'Silnik zamienia energię.', 'pl');
    expect(voice.statusKey()).toBe('voice.conversation.speaking');
  });

  it('never speaks when Chat POST failed and does not retry automatically', async () => {
    const { voice, store, player } = setup();
    store.sendMessage.mockResolvedValue(false);
    voice.enable();
    expect(await voice.acceptTranscript('Jak działa silnik?')).toBe('failed');
    expect(store.sendMessage).toHaveBeenCalledTimes(1);
    expect(player.read).not.toHaveBeenCalled();
    expect(voice.errorKey()).toBe('voice.conversation.sendFailed');
  });

  it('ignores a late Qwen answer after pressing Stop', async () => {
    const { voice, store, player } = setup();
    const pending = deferred<boolean>();
    store.sendMessage.mockImplementation(() => pending.promise);
    voice.enable();
    const turn = voice.acceptTranscript('Jak działa silnik?');
    expect(voice.pending()).toBe(true);
    voice.stop();
    pending.resolve(true);
    expect(await turn).toBe('cancelled');
    expect(player.read).not.toHaveBeenCalled();
    expect(voice.pending()).toBe(false);
    expect(voice.enabled()).toBe(true);
  });

  it('does not narrate a response after switching to another chat', async () => {
    const { voice, store, currentChat, player } = setup();
    const pending = deferred<boolean>();
    store.sendMessage.mockImplementation(() => pending.promise);
    voice.enable();
    const turn = voice.acceptTranscript('Jak działa silnik?');
    currentChat.set('chat-two');
    TestBed.tick();
    pending.resolve(true);
    expect(await turn).toBe('cancelled');
    expect(voice.enabled()).toBe(false);
    expect(player.read).not.toHaveBeenCalled();
  });

  it('keeps the Chat reply even when Piper is offline, without pretending to speak', async () => {
    const { voice, store, player } = setup();
    player.available.set({ enabled: false, configuredPl: false, configuredEn: false });
    voice.enable();
    expect(await voice.acceptTranscript('Jak działa silnik?')).toBe('sent');
    expect(store.sendMessage).toHaveBeenCalledTimes(1);
    expect(player.read).not.toHaveBeenCalled();
    expect(voice.errorKey()).toBe('voice.conversation.ttsUnavailable');
  });

  it('prevents parallel Chat submissions', async () => {
    const { voice, store } = setup();
    const pending = deferred<boolean>();
    store.sendMessage.mockImplementation(() => pending.promise);
    voice.enable();
    const first = voice.acceptTranscript('Jak działa silnik?');
    expect(await voice.acceptTranscript('Drugie pytanie')).toBe('failed');
    expect(store.sendMessage).toHaveBeenCalledOnce();
    pending.resolve(true);
    await first;
  });
});
