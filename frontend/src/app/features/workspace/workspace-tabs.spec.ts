import { describe, expect, it } from 'vitest';

import { ModuleNavigationService } from '../../core/services/module-navigation.service';

describe('Workspace module state', () => {

  it('should select AI Lab', () => {
    const navigation = new ModuleNavigationService();

    navigation.select('lab');

    expect(navigation.activeId()).toBe('lab');
  });

  it('should return to Chat', () => {
    const navigation = new ModuleNavigationService();

    navigation.select('lab');
    navigation.select('chat');

    expect(navigation.activeId()).toBe('chat');
  });
});
