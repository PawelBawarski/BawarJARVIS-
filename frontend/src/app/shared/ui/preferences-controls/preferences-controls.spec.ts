import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreferencesControls } from './preferences-controls';

describe('PreferencesControls', () => {
  let component: PreferencesControls;
  let fixture: ComponentFixture<PreferencesControls>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreferencesControls],
    }).compileComponents();

    fixture = TestBed.createComponent(PreferencesControls);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('groups general preferences and AI Chat into accessible collapsible sections', () => {
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const general = root.querySelector<HTMLDetailsElement>('[data-testid="settings-general-section"]');
    const chat = root.querySelector<HTMLDetailsElement>('[data-testid="settings-chat-ai-section"]');
    expect(general).not.toBeNull();
    expect(chat).not.toBeNull();
    expect(general?.open).toBe(true);
    expect(chat?.open).toBe(false);
    expect(general?.querySelector('.theme-button')).not.toBeNull();
    expect(general?.querySelector('.language-options')).not.toBeNull();
    expect(chat?.querySelector('[data-testid="settings-internet-enabled"]')).not.toBeNull();
    chat!.open = true;
    expect(chat?.open).toBe(true);
    general!.open = false;
    expect(general?.open).toBe(false);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
