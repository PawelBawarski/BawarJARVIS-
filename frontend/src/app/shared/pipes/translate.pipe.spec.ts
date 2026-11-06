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

  it('should return key if translation is missing', () => {
    const pipe = TestBed.runInInjectionContext(() => new TranslatePipe());

    expect(pipe.transform('missing.key')).toBe('missing.key');
  });
});
