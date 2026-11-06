import { Component, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

// Jedna wiadomość na czacie.
type Role = 'user' | 'assistant';
interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
}

// Rozmowa składa się z wielu wiadomości.
interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
}

const STORAGE_KEY = 'jarvis-desktop:conversations:v1';
const ACTIVE_KEY = 'jarvis-desktop:active:v1';
const INTRO = 'Witaj! Jestem interfejsem J.A.R.V.I.S. W tej wersji ćwiczymy aplikację desktopową. W kolejnym etapie dołączymy prawdziwy model językowy przez Java Spring Boot i Ollama.';

function makeConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'Nowa rozmowa',
    messages: [{ id: crypto.randomUUID(), role: 'assistant', text: INTRO, createdAt: Date.now() }]
  };
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly draft = signal('');
  readonly voiceOn = signal(false);
  readonly conversations = signal<Conversation[]>(this.loadConversations());
  readonly activeId = signal(this.loadActiveId(this.conversations()));
  readonly activeConversation = computed(() =>
    this.conversations().find(chat => chat.id === this.activeId()) ?? this.conversations()[0]
  );
  readonly messageCount = computed(() =>
    this.conversations().reduce((sum, chat) => sum + chat.messages.length, 0)
  );

  newConversation(): void {
    const chat = makeConversation();
    this.conversations.update(all => [chat, ...all]);
    this.activeId.set(chat.id);
    this.persist();
  }

  selectConversation(id: string): void {
    this.activeId.set(id);
    this.persist();
  }

  deleteConversation(id: string): void {
    const rest = this.conversations().filter(chat => chat.id !== id);
    const updated = rest.length ? rest : [makeConversation()];
    this.conversations.set(updated);
    if (this.activeId() === id) this.activeId.set(updated[0].id);
    this.persist();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    const text = this.draft().trim();
    if (!text) return;

    const conversationId = this.activeConversation().id;
    this.appendMessage(conversationId, 'user', text);
    this.draft.set('');

    // TYMCZASOWA odpowiedź demonstracyjna. W etapie 02 zastąpi ją REST API Spring Boot.
    const reply = 'Wiadomość została odebrana: „' + text + '”. Jestem jeszcze w trybie demonstracyjnym. Mój prawdziwy mózg LLM podłączymy w następnej lekcji.';
    this.appendMessage(conversationId, 'assistant', reply);
    if (this.voiceOn()) this.speak(reply);
  }

  toggleVoice(): void {
    this.voiceOn.update(enabled => !enabled);
    if (!this.voiceOn() && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  speak(text: string): void {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pl-PL';
    utterance.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const polishVoice = voices.find(voice => voice.lang.toLowerCase().startsWith('pl'));
    if (polishVoice) utterance.voice = polishVoice;
    window.speechSynthesis.speak(utterance);
  }

  private appendMessage(conversationId: string, role: Role, text: string): void {
    const message: ChatMessage = { id: crypto.randomUUID(), role, text, createdAt: Date.now() };
    this.conversations.update(all => all.map(chat => {
      if (chat.id !== conversationId) return chat;
      const newTitle = chat.title === 'Nowa rozmowa' && role === 'user'
        ? text.slice(0, 42) + (text.length > 42 ? '…' : '')
        : chat.title;
      return { ...chat, title: newTitle, messages: [...chat.messages, message] };
    }));
    this.persist();
  }

  private loadConversations(): Conversation[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const value: unknown = JSON.parse(stored);
        if (Array.isArray(value) && value.length > 0 && value.every(
          item => typeof item?.id === 'string' && typeof item?.title === 'string' && Array.isArray(item?.messages)
        )) return value as Conversation[];
      }
    } catch { /* Uszkodzone dane nie mogą zablokować startu aplikacji. */ }
    return [makeConversation()];
  }

  private loadActiveId(conversations: Conversation[]): string {
    try {
      const saved = localStorage.getItem(ACTIVE_KEY);
      if (saved && conversations.some(chat => chat.id === saved)) return saved;
    } catch { /* Domyślna rozmowa. */ }
    return conversations[0].id;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.conversations()));
      localStorage.setItem(ACTIVE_KEY, this.activeId());
    } catch { /* Na przykład: brak dostępnego miejsca na dysku. */ }
  }
}
