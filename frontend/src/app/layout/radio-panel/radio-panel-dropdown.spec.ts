import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RadioPanel } from './radio-panel';

describe('Radio 4C.2 dropdown controls', () => {
  it('opens search inside station popup, closes on Escape', () => {
    const fixture = TestBed.createComponent(RadioPanel);
    fixture.componentInstance.toggle();
    // The picker intentionally stays disabled during catalog loading.
    // Simulate a catalog that has finished loading before opening it.
    fixture.componentInstance.player.catalogLoading.set(false);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-testid="radio-search"]')).toBeNull();
    (root.querySelector('[data-testid="radio-station-trigger"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="radio-search"]')).not.toBeNull();
    (root.querySelector('[data-testid="radio-search"]') as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="radio-search"]')).toBeNull();
  });
  it('places favorite action as fourth toolbar button and filter below selector', () => {
    const fixture = TestBed.createComponent(RadioPanel);
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('.radio-panel__controls button').length).toBe(4);
    expect(root.querySelector('.radio-panel__controls button:last-child')?.getAttribute('data-testid'))
      .toBe('radio-favorite-toggle');
    expect(root.querySelector('.radio-panel__station-field [data-testid="radio-favorites-only"]')).not.toBeNull();
  });
});
