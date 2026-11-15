
import { Component, inject, signal, OnInit } from '@angular/core';
import { InternetPreferenceService } from '../../../core/services/internet-preference';
import { ChatGenerationPreferenceService } from '../../../core/services/chat-generation-preference';

import { ThemeService } from '../../../core/services/theme';
import { TranslationService } from '../../../core/services/translation';
import {
  Language,
  SUPPORTED_LANGUAGES
} from '../../../../../public/i18n/language.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-preferences-controls',
  imports: [TranslatePipe],
  templateUrl: './preferences-controls.html',
  styleUrl: './preferences-controls.scss'
})
export class PreferencesControls implements OnInit {
  readonly internet = inject(InternetPreferenceService);
  readonly chatGeneration = inject(ChatGenerationPreferenceService);
  readonly chatMaxTokensDraft = signal(256);
  readonly chatMaxTokensInvalid = signal(false);
  onChatMaxTokensChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.chatMaxTokensDraft.set(input.valueAsNumber);
    this.chatMaxTokensInvalid.set(!Number.isInteger(input.valueAsNumber) ||
      input.valueAsNumber < this.chatGeneration.min() || input.valueAsNumber > this.chatGeneration.max());
  }
  async saveChatMaxTokens(): Promise<void> {
    if (this.chatMaxTokensInvalid()) return;
    await this.chatGeneration.update(this.chatMaxTokensDraft());
  }
  ngOnInit(): void {
    void this.internet.load();
    void this.chatGeneration.load().then(() => {
      this.chatMaxTokensDraft.set(this.chatGeneration.value());
    });
  }
  toggleInternet(): void { void this.internet.update(!this.internet.enabled()); }
  readonly theme = inject(ThemeService);
  readonly translation = inject(TranslationService);

  readonly languages = SUPPORTED_LANGUAGES;

  readonly languageError = signal(false);

  async selectLanguage(language: Language): Promise<void> {
    if (this.translation.language() === language) {
      return;
    }

    this.languageError.set(false);

    try {
      await this.translation.setLanguage(language);
    } catch {
      this.languageError.set(true);
    }
  }
}
