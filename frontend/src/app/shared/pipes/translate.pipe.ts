import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslationService } from '../../core/services/translation';

/** Impure by design: changing language must update static keys in OnPush views.
 * Versioned memoization avoids redundant dictionary lookups during change detection.
 */
@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly translations = inject(TranslationService);
  private previousKey: string | null = null;
  private previousVersion = -1;
  private previousValue = '';

  transform(key: string): string {
    // Optional chaining tolerates the minimal TranslationService test doubles in existing tests.
    const version = this.translations.dictionaryVersion?.() ?? 0;
    if (this.previousKey !== key || this.previousVersion !== version) {
      this.previousKey = key;
      this.previousVersion = version;
      this.previousValue = this.translations.translate(key);
    }
    return this.previousValue;
  }
}
