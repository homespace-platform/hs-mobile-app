import { io, type Socket } from 'socket.io-client';

import { getAccessToken } from '@/features/auth/session';
import { reconnectDelay } from '@/lib/realtime/pure';

export type SocketListener = (event: string, payload?: unknown) => void;
export type EmitResult = { ok: boolean; ack?: unknown };

// One Socket.IO connection that reconnects itself with a FRESH access token each attempt (Socket.IO's own
// reconnection would reuse the old handshake headers). Listeners survive reconnects; 'connect' is forwarded.
export function createManagedSocket(options: {
  url: string;
  path: string;
  tokenInAuth?: boolean;
  transports?: ('polling' | 'websocket')[];
  headers: (token: string) => Record<string, string>;
}) {
  const listeners = new Set<SocketListener>();
  let socket: Socket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let running = false;
  let generation = 0;
  let connected = false;

  const emit: SocketListener = (event, payload) => listeners.forEach((l) => l(event, payload));
  const teardown = () => {
    clearTimeout(timer);
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
    connected = false;
  };
  const retry = () => {
    if (!running) return;
    clearTimeout(timer);
    timer = setTimeout(() => void connect(), reconnectDelay(attempt++));
  };

  async function connect() {
    const run = generation;
    const token = await getAccessToken().catch(() => null);
    if (!running || run !== generation) return;
    // No token: signed out stops this socket via stop(); a failed refresh (network blip) must not leave it
    // dead until the next foreground, so back off and try again.
    if (!token) return retry();
    teardown();
    const next = io(options.url, {
      path: options.path,
      transports: options.transports ?? ['websocket'],
      reconnection: false,
      forceNew: true,
      ...(options.tokenInAuth ? { auth: { token } } : {}),
      extraHeaders: options.headers(token),
    });
    socket = next;
    next.on('connect', () => {
      attempt = 0;
      connected = true;
      emit('connect');
    });
    next.onAny((event: string, payload?: unknown) => emit(event, payload));
    const lost = (reason?: unknown) => {
      if (socket !== next) return;
      // Dev diagnostics only: the reason/message, never the token or headers.
      if (__DEV__)
        console.warn(
          `[realtime] ${options.path} lost:`,
          String((reason as Error)?.message ?? reason ?? '')
        );
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
    isConnected: () => connected,
    // Emits with an ack callback. Never rejects: not connected, timeout or error all resolve { ok: false }.
    emitWithAck(event: string, payload: unknown, timeoutMs = 5_000) {
      const current = socket;
      if (!current || !connected) return Promise.resolve<EmitResult>({ ok: false });
      return new Promise<EmitResult>((resolve) => {
        try {
          current
            .timeout(timeoutMs)
            .emit(event, payload, (error: unknown, ack?: unknown) =>
              resolve(error ? { ok: false } : { ok: true, ack })
            );
        } catch {
          resolve({ ok: false });
        }
      });
    },
    subscribe(listener: SocketListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
