/**
 * Coalesce DOM reads/writes issued during the same browser animation frame.
 * Does not create a timer or run when there is no DOM animation API.
 */
export class AnimationFrameCoalescer {
  private frame: number | undefined;

  constructor(
    private readonly request: ((callback: FrameRequestCallback) => number) | null =
      typeof requestAnimationFrame === 'function' ? callback => requestAnimationFrame(callback) : null,
    private readonly cancelFrame: ((id: number) => void) | null =
      typeof cancelAnimationFrame === 'function' ? id => cancelAnimationFrame(id) : null,
  ) {}

  schedule(callback: () => void): void {
    if (this.frame !== undefined) return;
    if (!this.request) {
      callback();
      return;
    }
    this.frame = this.request(() => {
      this.frame = undefined;
      callback();
    });
  }

  cancel(): void {
    if (this.frame !== undefined) {
      this.cancelFrame?.(this.frame);
      this.frame = undefined;
    }
  }
}
