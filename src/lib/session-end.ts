// Per-account data held in module memory registers here; `clearSession` runs it on every sign-out.
// No imports, so any module can register without an import cycle.
const cleanups = new Set<() => void>();
let generation = 0;

export const sessionGeneration = () => generation;

export function onSessionEnd(cleanup: () => void) {
  cleanups.add(cleanup);
  return () => {
    cleanups.delete(cleanup);
  };
}

export function runSessionEndCleanups() {
  generation++;
  cleanups.forEach((cleanup) => {
    try {
      cleanup();
    } catch {
      // One failing cleanup must not stop the others or the sign-out.
    }
  });
}
