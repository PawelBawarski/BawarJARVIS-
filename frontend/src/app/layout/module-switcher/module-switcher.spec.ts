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

});
