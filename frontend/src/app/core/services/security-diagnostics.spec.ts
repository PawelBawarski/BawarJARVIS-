import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecurityDiagnosticsService } from './security-diagnostics';

type DesktopWindow = Window & {
  jarvisDesktop?: { checkPrivateHealth(): Promise<unknown> };
};
const desktopWindow = window as DesktopWindow;

describe('SecurityDiagnosticsService', () => {
  afterEach(() => {
    delete desktopWindow.jarvisDesktop;
    vi.unstubAllGlobals();
  });

  it('reports reachable only after successful browser health', async () => {
    delete desktopWindow.jarvisDesktop;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'UP' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = new SecurityDiagnosticsService();
    await service.checkBackend();

    expect(service.backendStatus()).toBe('reachable');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('reports unavailable for unsuccessful browser health', async () => {
    delete desktopWindow.jarvisDesktop;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const service = new SecurityDiagnosticsService();
    await service.checkBackend();

    expect(service.backendStatus()).toBe('unavailable');
  });

  it('reports authenticated only after desktop bridge confirms it', async () => {
    desktopWindow.jarvisDesktop = {
      checkPrivateHealth: vi.fn().mockResolvedValue({ status: 'authenticated' }),
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const service = new SecurityDiagnosticsService();
    await service.checkBackend();

    expect(service.backendStatus()).toBe('authenticated');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not claim authentication from unexpected desktop response', async () => {
    desktopWindow.jarvisDesktop = {
      checkPrivateHealth: vi.fn().mockResolvedValue({ status: 'UP' }),
    };

    const service = new SecurityDiagnosticsService();
    await service.checkBackend();

    expect(service.backendStatus()).toBe('unavailable');
  });
});
