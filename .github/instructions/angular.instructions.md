---
applyTo: "frontend/src/**/*.ts,frontend/src/**/*.html,frontend/src/**/*.scss,frontend/e2e/**/*.ts"
---
# Angular 22 and Playwright
- Use standalone components, Angular Signals and computed for derived UI state; OnPush where supported by state updates.
- Prefer Angular `@if` and `@for (...; track ...)`, typed Reactive Forms and explicit cleanup for subscriptions.
- Avoid unnecessary `effect()`, nested subscriptions and Promise conversions of reactive streams.
- Keep four component files where applicable: .ts, .html, .scss, .spec.ts; provide exact repository-relative paths.
- Add meaningful Vitest unit tests and Playwright E2E for any frontend change; use stable `data-testid` selectors.
- Preserve keyboard navigation, focus, aria labels, dark/light themes and responsive layout.
- Keep visible content localized via PL/EN JSON and TranslatePipe, including errors and accessible labels.
- Never trust model-provided HTML; sanitize and never use `bypassSecurityTrustHtml` for generated Markdown.
- Respect existing 4 kB component style budget, do not raise thresholds to hide warnings.
- Browser and Electron modes must both work; avoid assuming native bridge availability.
