
import { Component, inject, signal } from '@angular/core';

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
export class PreferencesControls {
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
