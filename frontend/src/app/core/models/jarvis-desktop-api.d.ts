export {};

declare global {
  interface Window {
    jarvisDesktop?: {
      checkPrivateHealth(): Promise<{
        status: "authenticated" | "unavailable";
      }>;
    };
  }
}
