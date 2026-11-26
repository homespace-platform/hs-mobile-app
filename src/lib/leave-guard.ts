// A screen with unsaved input registers a guard; navigation from outside it goes through leaveThen.
type Guard = (go: () => void) => void;
let guard: Guard | undefined;

/** Returns the function that removes this guard. */
export function setLeaveGuard(next: Guard) {
  guard = next;
  return () => {
    if (guard === next) guard = undefined;
  };
}

export const leaveThen = (go: () => void) => (guard ? guard(go) : go());

/** Press handler of a leave question: a save may have started since it was asked. */
export const unlessBusy = (busy: () => boolean, go: () => void, wait: () => void) => () =>
  busy() ? wait() : go();
