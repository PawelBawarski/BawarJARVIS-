
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  it('should render the Jarvis layout', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const shell = fixture.nativeElement
      .querySelector('app-app-shell');

    expect(shell).not.toBeNull();
  });
});
