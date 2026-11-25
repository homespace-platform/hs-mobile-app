import { io, type Socket } from 'socket.io-client';

import { getAccessToken } from '@/features/auth/session';
import { reconnectDelay } from '@/lib/realtime/pure';

export type SocketListener = (event: string, payload?: unknown) => void;

// One Socket.IO connection that reconnects itself with a FRESH access token each attempt (Socket.IO's own
// reconnection would reuse the old handshake headers). Listeners survive reconnects; 'connect' is forwarded.
export function createManagedSocket(options: {
  url: string;
  path: string;
  tokenInAuth?: boolean;
  headers: (token: string) => Record<string, string>;
}) {
  const listeners = new Set<SocketListener>();
  let socket: Socket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let running = false;
  let generation = 0;

  const emit: SocketListener = (event, payload) => listeners.forEach((l) => l(event, payload));
  const teardown = () => {
    clearTimeout(timer);
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
  };
  const retry = () => {
    if (!running) return;
    clearTimeout(timer);
    timer = setTimeout(() => void connect(), reconnectDelay(attempt++));
  };

  async function connect() {
    const run = generation;
    const token = await getAccessToken().catch(() => null);
    // No token means signed out (or refresh failed): stay disconnected.
    if (!running || run !== generation || !token) return;
    teardown();
    const next = io(options.url, {
      path: options.path,
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      ...(options.tokenInAuth ? { auth: { token } } : {}),
      extraHeaders: options.headers(token),
    });
    socket = next;
    next.on('connect', () => {
      attempt = 0;
      emit('connect');
    });
    next.onAny((event: string, payload?: unknown) => emit(event, payload));
    const lost = () => {
      if (socket !== next) return;
      teardown();
      retry();
    };
    next.on('disconnect', lost);
    next.on('connect_error', lost);
  }

  return {
    start() {
      if (running) return;
      running = true;
      attempt = 0;
      void connect();
    },
    stop() {
      running = false;
      generation++;
      teardown();
    },
    subscribe(listener: SocketListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
