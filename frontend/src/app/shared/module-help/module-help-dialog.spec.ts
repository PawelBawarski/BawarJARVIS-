import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ModuleHelpDialog } from './module-help-dialog';
import { ModuleHelpService } from '../../core/services/module-help.service';
import { MODULE_HELP } from './module-help.data';

describe('ModuleHelpDialog', () => {
  it('renders help for the chosen module and closes', async () => {
    const fixture = TestBed.createComponent(ModuleHelpDialog);
    const service = TestBed.inject(ModuleHelpService);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    service.open('lab-offline');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toMatch(/token/i);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('tools/offline-brain/start.ps1');
    fixture.nativeElement.querySelector('[aria-label="Zamknij pomoc"]').click();
    await fixture.whenStable();
    expect(service.topic()).toBeNull();
  });


  it('falls back safely on unrecognized topic', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ModuleHelpService);
    service.open('__unknown__');
    expect(service.topic()).toBe('chat');
  });
});
