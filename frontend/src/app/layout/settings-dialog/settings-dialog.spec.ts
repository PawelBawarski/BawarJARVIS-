import { Component, Pipe, PipeTransform } from '@angular/core';

import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { SettingsDialog } from './settings-dialog';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';

import { PreferencesControls } from '../../shared/ui/preferences-controls/preferences-controls';

@Pipe({
  name: 'translate',
})
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

@Component({
  selector: 'app-preferences-controls',
  template: '',
})
class MockPreferencesControls {}

describe('SettingsDialog', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsDialog],
    })
      .overrideComponent(SettingsDialog, {
        remove: {
          imports: [TranslatePipe, PreferencesControls],
        },
        add: {
          imports: [MockTranslatePipe, MockPreferencesControls],
        },
      })
      .compileComponents();
  });

  it('should render settings content', () => {
    const fixture = TestBed.createComponent(SettingsDialog);

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('#jarvis-settings-title')?.textContent).toContain(
      'settings.title',
    );

    expect(element.querySelector('app-preferences-controls')).not.toBeNull();
  });

  it('should open and close dialog', () => {
    const fixture = TestBed.createComponent(SettingsDialog);

    fixture.detectChanges();

    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');

    // Symulacja natywnego API dialogu w testach.
    Object.defineProperty(dialog, 'showModal', {
      configurable: true,
      value: () => dialog.setAttribute('open', ''),
    });

    Object.defineProperty(dialog, 'close', {
      configurable: true,
      value: () => dialog.removeAttribute('open'),
    });

    fixture.componentInstance.open();

    expect(dialog.hasAttribute('open')).toBe(true);

    fixture.componentInstance.close();

    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('should close after clicking backdrop', () => {
    const fixture = TestBed.createComponent(SettingsDialog);

    fixture.detectChanges();

    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');

    Object.defineProperty(dialog, 'showModal', {
      configurable: true,
      value: () => dialog.setAttribute('open', ''),
    });

    Object.defineProperty(dialog, 'close', {
      configurable: true,
      value: () => dialog.removeAttribute('open'),
    });

    fixture.componentInstance.open();

    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(dialog.hasAttribute('open')).toBe(false);
  });
});
