import { TestBed } from '@angular/core/testing';

import { provideHttpClient } from '@angular/common/http';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TranslationService } from './translation';

describe('TranslationService', () => {
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

  it('should create service', () => {
    const service = TestBed.inject(TranslationService);

    expect(service).toBeTruthy();
  });

  it('should load Polish translations', async () => {
    const service = TestBed.inject(TranslationService);
    const http = TestBed.inject(HttpTestingController);

    const loading = service.setLanguage('pl');

    http.expectOne('i18n/pl.json').flush({
      'chat.send': 'Wyślij',
      'chat.title': 'Centrum dowodzenia',
    });

    await loading;

    expect(service.language()).toBe('pl');
    expect(service.translate('chat.send')).toBe('Wyślij');
  });

  it('should switch language to English', async () => {
    const service = TestBed.inject(TranslationService);
    const http = TestBed.inject(HttpTestingController);

    const loading = service.setLanguage('en');

    http.expectOne('i18n/en.json').flush({
      'chat.send': 'Send',
      'chat.title': 'Command Center',
    });

    await loading;

    expect(service.language()).toBe('en');
    expect(service.translate('chat.send')).toBe('Send');
  });

  it('should keep the newest language when HTTP responses arrive out of order', async () => {
    const service = TestBed.inject(TranslationService);
    const http = TestBed.inject(HttpTestingController);
    const oldRequest = service.setLanguage('en');
    const newRequest = service.setLanguage('pl');

    http.expectOne('i18n/pl.json').flush({ 'chat.send': 'Wyślij' });
    await newRequest;
    http.expectOne('i18n/en.json').flush({ 'chat.send': 'Send' });
    await oldRequest;

    expect(service.language()).toBe('pl');
    expect(service.translate('chat.send')).toBe('Wyślij');
    expect(service.loading()).toBe(false);
  });

  it('reuses already loaded dictionaries and avoids repeat HTTP calls', async () => {
    const service = TestBed.inject(TranslationService);
    const http = TestBed.inject(HttpTestingController);

    const first = service.setLanguage('pl');
    http.expectOne('i18n/pl.json').flush({ 'chat.send': 'Wyślij' });
    await first;
    const version = service.dictionaryVersion();
    await service.setLanguage('pl');
    http.expectNone('i18n/pl.json');
    expect(service.dictionaryVersion()).toBe(version);

    const english = service.setLanguage('en');
    http.expectOne('i18n/en.json').flush({ 'chat.send': 'Send' });
    await english;
    await service.setLanguage('pl');
    http.expectNone('i18n/pl.json');
    expect(service.translate('chat.send')).toBe('Wyślij');
    expect(service.dictionaryVersion()).toBe(version + 2);
  });

  it('cached latest language choice wins over an outstanding network request', async () => {
    const service = TestBed.inject(TranslationService);
    const http = TestBed.inject(HttpTestingController);

    const initial = service.setLanguage('pl');
    http.expectOne('i18n/pl.json').flush({ 'chat.send': 'Wyślij' });
    await initial;
    const stale = service.setLanguage('en');
    await service.setLanguage('pl');
    http.expectOne('i18n/en.json').flush({ 'chat.send': 'Send' });
    await stale;
    expect(service.translate('chat.send')).toBe('Wyślij');
    expect(service.language()).toBe('pl');
    expect(service.loading()).toBe(false);
  });

  it('should return key when translation is missing', () => {
    const service = TestBed.inject(TranslationService);

    expect(service.translate('unknown.key')).toBe('unknown.key');
  });

  it('should save selected language', async () => {
    const service = TestBed.inject(TranslationService);
    const http = TestBed.inject(HttpTestingController);

    const loading = service.setLanguage('en');

    http.expectOne('i18n/en.json').flush({
      'chat.send': 'Send',
    });

    await loading;

    expect(localStorage.getItem('jarvis.language')).toBe('en');
  });
});
