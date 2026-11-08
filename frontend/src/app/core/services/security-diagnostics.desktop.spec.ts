import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecurityDiagnosticsService } from './security-diagnostics';

type DesktopWindow = Window & {
  jarvisDesktop?: {
    checkPrivateHealth(): Promise<unknown>;
  };
};

const desktopWindow = window as DesktopWindow;

describe('SecurityDiagnosticsService - Electron bridge', () => {
  afterEach(() => {
    delete desktopWindow.jarvisDesktop;
    vi.restoreAllMocks();
  });

  it('reports authenticated when the bridge confirms the session', async () => {
    const checkPrivateHealth = vi.fn().mockResolvedValue({ status: 'authenticated' });
    desktopWindow.jarvisDesktop = { checkPrivateHealth };

    const service = new SecurityDiagnosticsService();
    await service.checkBackend();

    expect(checkPrivateHealth).toHaveBeenCalledOnce();
    expect(service.backendStatus()).toBe('authenticated');
  });

  it('reports unavailable when the bridge rejects the request', async () => {
    desktopWindow.jarvisDesktop = {
      checkPrivateHealth: vi.fn().mockRejectedValue(new Error('Backend unavailable')),
    };

    const service = new SecurityDiagnosticsService();
    await service.checkBackend();

    expect(service.backendStatus()).toBe('unavailable');
  });

  it('does not mistake a public UP status for authenticated access', async () => {
    desktopWindow.jarvisDesktop = {
      checkPrivateHealth: vi.fn().mockResolvedValue({ status: 'UP' }),
    };

    const service = new SecurityDiagnosticsService();
    await service.checkBackend();

    expect(service.backendStatus()).toBe('unavailable');
  });
});
