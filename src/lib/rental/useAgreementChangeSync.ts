// Port of the pipe inside hs-web-app hooks/useAgreementChangeSync.ts (useNotificationChangeSync, :20-52):
// signals are coalesced (250 ms), a hidden screen only marks dirty and recovers once on return. Callers own
// single-flight/ordering in `refresh`; failures are swallowed. `isVisible` replaces document.visibilityState.
export function createChangeSync(options: { refresh: () => unknown; isVisible: () => boolean }) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hiddenDirty = false;
  let disposed = false;
  const schedule = () => {
    if (disposed) return;
    if (!options.isVisible()) {
      hiddenDirty = true;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (disposed) return;
      if (!options.isVisible()) {
        hiddenDirty = true;
        return;
      }
      void Promise.resolve()
        .then(() => options.refresh())
        .catch(() => {});
    }, 250);
  };
  return {
    schedule,
    onVisible() {
      if (options.isVisible() && hiddenDirty) {
        hiddenDirty = false;
        schedule();
      }
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}
