import { UrlSegment } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { jarvisModuleMatcher, routes } from './app.routes';

describe('J.A.R.V.I.S. routing', () => {
  it('matches only the three real modules', () => {
    for (const id of ['chat', 'lab', 'security']) {
      expect(jarvisModuleMatcher([new UrlSegment(id, {})], null as never, null as never)?.consumed).toHaveLength(1);
    }
    expect(jarvisModuleMatcher([new UrlSegment('unknown', {})], null as never, null as never)).toBeNull();
    expect(jarvisModuleMatcher([new UrlSegment('lab', {}), new UrlSegment('nested', {})], null as never, null as never)).toBeNull();
  });

  it('defines redirect from / and unknown paths to /chat', () => {
    expect(routes[0].redirectTo).toBe('chat');
    expect(routes.at(-1)?.redirectTo).toBe('chat');
  });
});
