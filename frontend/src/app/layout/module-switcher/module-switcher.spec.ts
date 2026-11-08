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

    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.module-switcher__current')?.textContent).toContain(
      'workspace.chat',
    );
  });

  it('should navigate to next module', () => {
    const fixture = TestBed.createComponent(ModuleSwitcher);
    const navigation = TestBed.inject(ModuleNavigationService);

    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.module-switcher__arrow',
    ) as NodeListOf<HTMLButtonElement>;

    buttons[1].click();

    expect(navigation.activeId()).toBe('mining');
  });
});
