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

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
