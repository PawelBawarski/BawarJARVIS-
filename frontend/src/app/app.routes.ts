import { Routes, UrlMatcher, UrlSegment } from '@angular/router';
import { JARVIS_MODULES } from './core/models/jarvis-module.model';

/** One shared route config keeps AppShell alive as the module URL changes. */
export const jarvisModuleMatcher: UrlMatcher = (segments: UrlSegment[]) => {
  if (segments.length !== 1 || !JARVIS_MODULES.some((item) => item.id === segments[0].path)) {
    return null;
  }
  return { consumed: segments, posParams: { module: segments[0] } };
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'chat' },
  {
    matcher: jarvisModuleMatcher,
    loadComponent: () => import('./layout/app-shell/app-shell').then((m) => m.AppShell),
  },
  { path: '**', redirectTo: 'chat' },
];
