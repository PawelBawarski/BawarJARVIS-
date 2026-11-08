import { describe, expect, it } from 'vitest';

import { WorkspaceTabs } from './workspace-tabs';

describe('WorkspaceTabs', () => {
  it('should start with Chat tab', () => {
    const workspace = new WorkspaceTabs();

    expect(workspace.activeTab()).toBe('chat');
  });

  it('should switch to Mining', () => {
    const workspace = new WorkspaceTabs();

    workspace.selectTab('mining');

    expect(workspace.activeTab()).toBe('mining');
  });

  it('should switch to AI Lab', () => {
    const workspace = new WorkspaceTabs();

    workspace.selectTab('lab');

    expect(workspace.activeTab()).toBe('lab');
  });

  it('should return to Chat', () => {
    const workspace = new WorkspaceTabs();

    workspace.selectTab('mining');
    workspace.selectTab('chat');

    expect(workspace.activeTab()).toBe('chat');
  });
});
