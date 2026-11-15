import { test, expect } from '@playwright/test';

test('Radio automatically switches from a failing station, manual Stop cancels failover', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeAudio {
      preload = '';
      volume = 0;
      src = '';
      private listeners = new Map<string, Array<() => void>>();
      constructor() { (window as any).__radioAudioInstances ??= []; (window as any).__radioAudioInstances.push(this); }
      addEventListener(name: string, callback: () => void) {
        this.listeners.set(name, [...(this.listeners.get(name) || []), callback]);
      }
      play() { return Promise.resolve(); }
      pause() {}
      removeAttribute(_name: string) {}
      load() {}
      emit(name: string) { this.listeners.get(name)?.forEach(callback => callback()); }
    }
    (window as any).Audio = FakeAudio;
  });
  await page.route('**/api/radio/stations?**', async route => route.fulfill({ json: [
    { id: 'one', name: 'One FM', countryCode: 'PL', streamUrl: 'https://radio.example.org/one.mp3' },
    { id: 'two', name: 'Two FM', countryCode: 'PL', streamUrl: 'https://radio.example.org/two.mp3' },
    { id: 'three', name: 'Three FM', countryCode: 'PL', streamUrl: 'https://radio.example.org/three.mp3' },
  ] }));
  await page.route('**/api/radio/favorites**', route => route.fulfill({ json: [] }));
  await page.goto('/chat');
  await page.getByTestId('radio-trigger').click();
  await expect(page.getByTestId('radio-play')).toBeEnabled();
  await page.getByTestId('radio-play').click();
  await expect(page.getByTestId('radio-status')).toContainText(/odtwarzanie|playing/i);
  await page.evaluate(() => (window as any).__radioAudioInstances[0].emit('error'));
  await expect(page.locator('.radio-panel__station strong')).toHaveText('Two FM');
  await expect(page.getByTestId('radio-status')).toContainText(/odtwarzanie|playing/i);
  await page.getByTestId('radio-stop').click();
  await page.evaluate(() => (window as any).__radioAudioInstances[1].emit('error'));
  await expect(page.locator('.radio-panel__station strong')).toHaveText('Two FM');
});
