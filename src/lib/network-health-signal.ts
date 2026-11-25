// Lets axios-client ask for a network re-check without importing the monitor.
let handler: (() => void) | undefined;
export const setNetworkHealthCheckHandler = (next: (() => void) | undefined) => {
  handler = next;
};
export const requestNetworkHealthCheck = () => handler?.();
