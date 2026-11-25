// Lets axios-client ask for a health re-check without importing the monitor (which imports axios-client).
let handler: (() => void) | undefined;
export const setBackendHealthCheckHandler = (next: (() => void) | undefined) => {
  handler = next;
};
export const requestBackendHealthCheck = () => handler?.();
