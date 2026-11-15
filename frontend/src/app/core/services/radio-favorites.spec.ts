import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RadioFavoritesService } from './radio-favorites';

describe('RadioFavoritesService 4C.2', () => {
  it('loads from backend, adds, then removes a favourite', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const svc = TestBed.inject(RadioFavoritesService);
    const mock = TestBed.inject(HttpTestingController);
    const station = { id: 's1', name: 'Test FM', countryCode: 'PL' as const, streamUrl: 'https://example.org/live' };
    const initial = svc.refresh();
    mock.expectOne('/api/radio/favorites').flush([]);
    await initial;
    expect(svc.entries()).toHaveLength(0);
    const add = svc.toggle(station);
    const post = mock.expectOne('/api/radio/favorites');
    expect(post.request.method).toBe('POST');
    post.flush(null);
    await add;
    expect(svc.has('s1')).toBe(true);
    const remove = svc.toggle(station);
    const del = mock.expectOne('/api/radio/favorites/s1');
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    await remove;
    expect(svc.has('s1')).toBe(false);
    mock.verify();
  });
});
