import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TranslatePipe } from './translate.pipe';
import { TranslationService } from '../../core/services/translation';

describe('TranslatePipe', () => {
  beforeEach(() => {
    localStorage.removeItem('jarvis.language');

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.removeItem('jarvis.language');
  });

  it('should translate Polish keys', async () => {
    const service = TestBed.inject(TranslationService);
    const http = TestBed.inject(HttpTestingController);

    const loading = service.setLanguage('pl');

    http.expectOne('i18n/pl.json').flush({
      'chat.send': 'Wyślij',
    });

    await loading;

    const pipe = TestBed.runInInjectionContext(() => new TranslatePipe());

    expect(pipe.transform('chat.send')).toBe('Wyślij');
  });

  it('should use English after switching', async () => {
    const service = TestBed.inject(TranslationService);
    const http = TestBed.inject(HttpTestingController);

    const pipe = TestBed.runInInjectionContext(() => new TranslatePipe());

    const loading = service.setLanguage('en');

    http.expectOne('i18n/en.json').flush({
      'chat.send': 'Send',
    });

    await loading;

    expect(pipe.transform('chat.send')).toBe('Send');
  });

  it('reuses a lookup until the language dictionary changes', async () => {
    const service = TestBed.inject(TranslationService);
    const http = TestBed.inject(HttpTestingController);
    const lookup = vi.spyOn(service, 'translate');
    const pipe = TestBed.runInInjectionContext(() => new TranslatePipe());

    const polish = service.setLanguage('pl');
    http.expectOne('i18n/pl.json').flush({ 'chat.send': 'Wyślij' });
    await polish;
    expect(pipe.transform('chat.send')).toBe('Wyślij');
    expect(pipe.transform('chat.send')).toBe('Wyślij');
    expect(lookup).toHaveBeenCalledTimes(1);

    const english = service.setLanguage('en');
    http.expectOne('i18n/en.json').flush({ 'chat.send': 'Send' });
    await english;
    expect(pipe.transform('chat.send')).toBe('Send');
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('should return key if translation is missing', () => {
    const pipe = TestBed.runInInjectionContext(() => new TranslatePipe());

    expect(pipe.transform('missing.key')).toBe('missing.key');
  });
});
