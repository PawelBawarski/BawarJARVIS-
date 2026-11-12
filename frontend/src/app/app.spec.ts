import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App routing', () => {
  it('renders Chat inside the routed shell', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient()] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/chat');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-app-shell')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-chat-view')).not.toBeNull();
  });
});
