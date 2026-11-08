import { describe, expect, it } from 'vitest';

import { ModuleNavigationService } from './module-navigation.service';

describe('ModuleNavigationService', () => {
  it('should start with Chat', () => {
    const navigation = new ModuleNavigationService();

    expect(navigation.activeId()).toBe('chat');
  });

  it('should switch to next module', () => {
    const navigation = new ModuleNavigationService();

    navigation.next();

    expect(navigation.activeId()).toBe('mining');
  });

  it('should wrap from last module to first', () => {
    const navigation = new ModuleNavigationService();

    const lastModule = navigation.modules.at(-1);

    expect(lastModule).toBeDefined();

    navigation.select(lastModule!.id);
    navigation.next();

    expect(navigation.activeId()).toBe(navigation.modules[0].id);
  });

  it('should wrap backwards', () => {
    const navigation = new ModuleNavigationService();

    const lastModule = navigation.modules.at(-1);

    navigation.previous();

    expect(navigation.activeId()).toBe(lastModule?.id);
  });

  it('should ignore unknown modules', () => {
    const navigation = new ModuleNavigationService();

    navigation.select('non-existent');

    expect(navigation.activeId()).toBe('chat');
  });
});
