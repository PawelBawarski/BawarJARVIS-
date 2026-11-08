export {};

declare global {
  interface Window {
    jarvisDesktop?: {
      checkPrivateHealth(): Promise<{ status: 'authenticated' | 'unavailable' }>;
      checkInternet?(): Promise<{ state: 'online' | 'offline' | 'unverified' }>;
      openReleasesPage?(): Promise<boolean>;
      openProjectPage?(): Promise<boolean>;
    };
  }
}
