import { describe, expect, it } from 'vitest';
import { isAllowedCodePath } from './source-validation';

describe('18.2 web source path validation', () => {
  it('allows relative source files used by Angular and Spring Boot', () => {
    expect(isAllowedCodePath('frontend/src/app/demo.ts')).toBe(true);
    expect(isAllowedCodePath('backend/src/main/java/Demo.java')).toBe(true);
    expect(isAllowedCodePath('README.md')).toBe(true);
  });

  it.each([
    '../secret.ts', '/root/demo.ts', 'C:/Windows/app.ts', 'a\\b.ts',
    'frontend//code.ts', '.env', 'backend/.secrets/token.ts',
    'src/api-token.ts', 'node_modules/pkg/index.ts',
    'backend/target/classes/Demo.java', 'test.exe', 'src/private-key.ts',
  ])('rejects unsafe path %s', value => {
    expect(isAllowedCodePath(value)).toBe(false);
  });
});
