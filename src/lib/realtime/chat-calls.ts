import type { EmitResult, SocketListener } from './socket-manager';

type CallKey = { conversationId: string; callId: string };
export type ChatCall = CallKey & { mode: 'voice' | 'video'; historyVersion?: 1 };
export type CallEndReason = 'declined' | 'failed';
export type ChatCallSession = {
  phase: 'inviting' | 'ringing' | 'active';
  call: ChatCall;
  participantName: string;
};

const INVITE_ACK_TIMEOUT_MS = 10_000;
const INCOMING_TIMEOUT_MS = 30_000;
const TRACKED_INCOMING_TIMEOUT_MS = 45_000;
const UNKNOWN_PARTICIPANT = 'Người dùng HomeSpace';

function isCallKey(payload: unknown): payload is CallKey {
  const call = payload as Partial<CallKey> | undefined;
  return (
    typeof call?.conversationId === 'string' &&
    /^[a-f\d]{24}$/i.test(call.conversationId) &&
    typeof call.callId === 'string' &&
    /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(call.callId)
  );
}

function isInvite(payload: unknown): payload is ChatCall & { callerId: string } {
  return (
    isCallKey(payload) &&
    'mode' in payload &&
    (payload.mode === 'voice' || payload.mode === 'video') &&
    'callerId' in payload &&
    typeof payload.callerId === 'string' &&
    payload.callerId.length > 0
  );
}

function matches(call: CallKey, other?: CallKey) {
  return call.callId === other?.callId && call.conversationId === other.conversationId;
}

export function createChatCalls({
  emitWithAck,
  isConnected,
  newCallId,
  lookupParticipantName,
  onChange,
  onInviteError,
}: {
  emitWithAck: (event: string, payload: unknown, timeoutMs?: number) => Promise<EmitResult>;
  isConnected: () => boolean;
  newCallId: () => string;
  lookupParticipantName: (conversationId: string, callerId: string) => Promise<string | undefined>;
  onChange: (session: ChatCallSession | null) => void;
  onInviteError: (message: string) => void;
}) {
  let foreground = false;
  let session: ChatCallSession | null = null;
  let ringTimer: ReturnType<typeof setTimeout> | undefined;
  let historyReady: Promise<boolean> | undefined;

  function setSession(next: ChatCallSession | null) {
    session = next;
    onChange(next);
  }

  function clearSession() {
    clearTimeout(ringTimer);
    setSession(null);
  }

  function signalEnd({ conversationId, callId, historyVersion }: ChatCall, reason?: CallEndReason) {
    void emitWithAck('chat:call:end', {
      conversationId,
      callId,
      ...(historyVersion === 1 && reason ? { reason } : {}),
    });
  }

  function end(call: CallKey | undefined = session?.call, reason?: CallEndReason) {
    if (!call || !session || !matches(call, session.call)) return;
    const current = session.call;
    clearSession();
    signalEnd(current, reason);
  }

  const receive: SocketListener = (event, payload) => {
    if (event === 'connect') {
      historyReady = emitWithAck('chat:call:history-ready', {}).then(
        ({ ok, ack }) => ok && (ack as { ok?: unknown } | undefined)?.ok === true
      );
      return;
    }
    if (event === 'chat:call:ended' && isCallKey(payload) && matches(payload, session?.call)) {
      clearSession();
    }
    if (event !== 'chat:call:incoming' || !isInvite(payload)) return;

    const { conversationId, callId, mode, callerId, historyVersion } = payload;
    const tracked = historyVersion === 1;
    const call: ChatCall = { conversationId, callId, mode, ...(tracked ? { historyVersion } : {}) };
    if (matches(call, session?.call)) return;
    if (!foreground || session) {
      if (!tracked) signalEnd(call);
      return;
    }

    setSession({ phase: 'ringing', call, participantName: UNKNOWN_PARTICIPANT });
    ringTimer = setTimeout(
      () => (tracked ? clearSession() : end(call)),
      tracked ? TRACKED_INCOMING_TIMEOUT_MS : INCOMING_TIMEOUT_MS
    );
    void lookupParticipantName(conversationId, callerId)
      .then((participantName) => {
        if (participantName && session?.call === call) setSession({ ...session, participantName });
      })
      .catch(() => {});
  };

  return {
    receive,
    end,
    setForeground(active: boolean) {
      foreground = active;
      if (!active && session?.phase !== 'active') {
        if (session?.phase === 'ringing' && session.call.historyVersion === 1) clearSession();
        else end();
      }
    },
    accept(call: CallKey) {
      if (!foreground || session?.phase !== 'ringing' || !matches(call, session.call)) return false;
      clearTimeout(ringTimer);
      const { conversationId, callId } = call;
      void emitWithAck('chat:call:accept', { conversationId, callId });
      setSession({ ...session, phase: 'active' });
      return true;
    },
    async start(conversationId: string, mode: ChatCall['mode'], participantName: string) {
      if (!foreground || session) return;
      if (!isConnected()) {
        onInviteError('Kết nối chat chưa sẵn sàng.');
        return;
      }

      const call = { conversationId, callId: newCallId(), mode };
      const pending: ChatCallSession = { phase: 'inviting', call, participantName };
      setSession(pending);
      const ready = historyReady;
      const supported = ready ? await ready : false;
      if (!Object.is(session, pending)) return;
      const tracked = supported && ready === historyReady;
      const { ok, ack } = await emitWithAck(
        'chat:call:invite',
        tracked ? { ...call, historyVersion: 1 } : call,
        INVITE_ACK_TIMEOUT_MS
      );
      if (!Object.is(session, pending)) return;
      if (ok && isInvite(ack) && matches(call, ack) && ack.mode === mode) {
        setSession({
          ...pending,
          phase: 'active',
          call: ack.historyVersion === 1 ? { ...call, historyVersion: 1 } : call,
        });
      } else {
        // The server may have forwarded the invite before the ACK was lost.
        clearSession();
        signalEnd(tracked ? { ...call, historyVersion: 1 } : call, 'failed');
        onInviteError('Không thể gửi lời mời cuộc gọi.');
      }
    },
  };
}
