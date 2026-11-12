import { Pipe, PipeTransform } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ModuleSwitcher } from './module-switcher';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

import { ModuleNavigationService } from '../../core/services/module-navigation.service';

@Pipe({
  name: 'translate',
})
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('ModuleSwitcher', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuleSwitcher],
    })
      .overrideComponent(ModuleSwitcher, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();
  });

  it('should display current module', () => {
    const fixture = TestBed.createComponent(ModuleSwitcher);

    fixture.detectChanges();

    const select: HTMLSelectElement | null =
      fixture.nativeElement.querySelector('#jarvis-module-select');

    expect(select).not.toBeNull();
    expect(select?.value).toBe('chat');
  });

  it('selects deep-linked module before options are rendered and tracks subsequent navigation', () => {
    const navigation = TestBed.inject(ModuleNavigationService);
    navigation.select('lab');

    const fixture = TestBed.createComponent(ModuleSwitcher);
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('#jarvis-module-select') as HTMLSelectElement;
    expect(select.value).toBe('lab');

    navigation.select('security');
    fixture.detectChanges();
    expect(select.value).toBe('security');

    navigation.select('chat');
    fixture.detectChanges();
    expect(select.value).toBe('chat');
  });

});
