/** Focus-only wizard navigation. Opening a details panel never submits a request. */
export function focusWorkflowTarget(target: HTMLElement | null, openDetails = false): boolean {
  if (!target) return false;
  if (openDetails && target instanceof HTMLDetailsElement) target.open = true;
  target.focus();
  return true;
}
