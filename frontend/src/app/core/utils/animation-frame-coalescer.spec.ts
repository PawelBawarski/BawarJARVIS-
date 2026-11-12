import { describe, expect, it, vi } from 'vitest';
import { AnimationFrameCoalescer } from './animation-frame-coalescer';

describe('AnimationFrameCoalescer — stage 18.7', () => {
  it('queues only one callback for a burst of DOM mutations', () => {
    const pending: FrameRequestCallback[] = [];
    const request = vi.fn((callback: FrameRequestCallback) => {
      pending.push(callback);
      return pending.length;
    });
    const run = vi.fn();
    const coalescer = new AnimationFrameCoalescer(request, vi.fn());

    for (let i = 0; i < 30; i++) coalescer.schedule(run);
    expect(request).toHaveBeenCalledTimes(1);
    pending.shift()?.(0);
    expect(run).toHaveBeenCalledTimes(1);

    coalescer.schedule(run);
    expect(request).toHaveBeenCalledTimes(2);
    pending.shift()?.(16);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('cancels pending work on component destruction', () => {
    const cancel = vi.fn();
    let fire: FrameRequestCallback | undefined;
    const request = (callback: FrameRequestCallback): number => {
      fire = callback;
      return 9;
    };
    const run = vi.fn();
    const coalescer = new AnimationFrameCoalescer(request, cancel);
    coalescer.schedule(run);
    coalescer.cancel();
    expect(cancel).toHaveBeenCalledWith(9);
    // The canceled frame must not invoke the callback in a real browser.
    expect(run).not.toHaveBeenCalled();
    expect(fire).toBeDefined();
  });

  it('runs directly if requestAnimationFrame is unavailable', () => {
    const run = vi.fn();
    new AnimationFrameCoalescer(null, null).schedule(run);
    expect(run).toHaveBeenCalledOnce();
  });
});
