import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RadioCatalogService } from './radio-catalog';

describe('RadioCatalogService', () => {
  it('loads stations for the chosen country', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const catalog = TestBed.inject(RadioCatalogService);
    const http = TestBed.inject(HttpTestingController);
    const promise = catalog.load('PL');
    const request = http.expectOne(req => req.url === '/api/radio/stations' && req.params.get('country') === 'PL');
    request.flush([{ id: 'id', name: 'Demo', countryCode: 'PL', streamUrl: 'https://example.com/live' }]);
    expect((await promise)[0].name).toBe('Demo');
    http.verify();
  });
});
