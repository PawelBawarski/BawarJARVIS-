import { computed, Injectable, signal } from '@angular/core';

import { JARVIS_MODULES, JarvisModuleId } from '../models/jarvis-module.model';

@Injectable({
  providedIn: 'root',
})
export class ModuleNavigationService {
  readonly modules = JARVIS_MODULES;

  private readonly selectedId = signal<JarvisModuleId>('chat');

  readonly activeId = this.selectedId.asReadonly();

  readonly activeModule = computed(
    () => this.modules.find((module) => module.id === this.selectedId()) ?? this.modules[0],
  );

  select(id: string): void {
    const module = this.modules.find((item) => item.id === id);

    if (module) {
      this.selectedId.set(module.id);
    }
  }

  next(): void {
    this.move(1);
  }

  previous(): void {
    this.move(-1);
  }

  private move(direction: 1 | -1): void {
    const currentIndex = this.modules.findIndex((module) => module.id === this.selectedId());

    const nextIndex = (currentIndex + direction + this.modules.length) % this.modules.length;

    this.selectedId.set(this.modules[nextIndex].id);
  }
}
