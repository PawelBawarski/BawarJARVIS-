import { Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { RadioPanel } from './radio-panel';
import { RadioPlayerService } from '../../core/services/radio-player';

import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Pipe({
  name: 'translate',
})
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('RadioPanel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RadioPanel],
    })
      .overrideComponent(RadioPanel, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();
  });

  it('should start closed', () => {
    const fixture = TestBed.createComponent(RadioPanel);

    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.radio-panel')).toBeNull();
  });

  it('should open after clicking radio icon', () => {
    const fixture = TestBed.createComponent(RadioPanel);

    fixture.detectChanges();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('.radio-control__trigger');

    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('.radio-panel')).not.toBeNull();
  });

  it('should close panel after clicking close button', () => {
    const fixture = TestBed.createComponent(RadioPanel);

    fixture.componentInstance.toggle();
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.radio-panel__close');

    button.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(false);
  });

  it('should change country using select', () => {
    const fixture = TestBed.createComponent(RadioPanel);
    const player = TestBed.inject(RadioPlayerService);

    fixture.componentInstance.toggle();
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#radio-country');

    select.value = 'GB';
    select.dispatchEvent(new Event('change'));

    fixture.detectChanges();

    expect(player.countryCode()).toBe('GB');
    expect(player.selectedStation()?.name).toBe('BBC Radio 1');
  });

  it('exposes icon-only transport controls with accessible labels', () => {
    const fixture = TestBed.createComponent(RadioPanel);
    fixture.componentInstance.toggle();
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.radio-panel__controls button'));
    expect(buttons).toHaveLength(4);
    expect(buttons.slice(0, 3).map(button => button.getAttribute('aria-label')))
      .toEqual(['radio.play', 'radio.pause', 'radio.stop']);
    expect(buttons[3].getAttribute('data-testid')).toBe('radio-favorite-toggle');
    expect(['radio.addFavorite', 'radio.removeFavorite'])
      .toContain(buttons[3].getAttribute('aria-label'));
    expect(buttons.every(button => button.textContent?.trim().length && button.textContent.trim().length <= 2)).toBe(true);
  });

  it('should keep Play disabled without a stream', () => {
    const fixture = TestBed.createComponent(RadioPanel);

    fixture.componentInstance.toggle();
    fixture.detectChanges();

    const playButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.radio-panel__controls button:first-child',
    );

    expect(playButton.disabled).toBe(true);
  });
});
