import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ModuleNavigationService } from '../../core/services/module-navigation.service';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-module-switcher',
  imports: [TranslatePipe],
  templateUrl: './module-switcher.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './module-switcher.scss',
})
export class ModuleSwitcher {
  readonly navigation = inject(ModuleNavigationService);

  selectModule(id: string): void {
    this.navigation.select(id);
  }
}
