import type { EmitResult, SocketListener } from './socket-manager';

type CallKey = { conversationId: string; callId: string };
export type ChatCall = CallKey & { mode: 'voice' | 'video' };
export type ChatCallSession = {
  phase: 'inviting' | 'ringing' | 'active';
  call: ChatCall;
  participantName: string;
};

const INVITE_ACK_TIMEOUT_MS = 10_000;
const INCOMING_TIMEOUT_MS = 30_000;
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

  function setSession(next: ChatCallSession | null) {
    session = next;
    onChange(next);
  }

  function clearSession() {
    clearTimeout(ringTimer);
    setSession(null);
  }

  function signalEnd({ conversationId, callId }: CallKey) {
    void emitWithAck('chat:call:end', { conversationId, callId });
  }

  function end(call = session?.call) {
    if (!call || !matches(call, session?.call)) return;
    clearSession();
    signalEnd(call);
  }

  const receive: SocketListener = (event, payload) => {
    if (event === 'chat:call:ended' && isCallKey(payload) && matches(payload, session?.call)) {
      clearSession();
    }
    if (event !== 'chat:call:incoming' || !isInvite(payload)) return;

    const { conversationId, callId, mode, callerId } = payload;
    const call = { conversationId, callId, mode };
    if (matches(call, session?.call)) return;
    if (!foreground || session) {
      signalEnd(call);
      return;
    }

    setSession({ phase: 'ringing', call, participantName: UNKNOWN_PARTICIPANT });
    ringTimer = setTimeout(() => end(call), INCOMING_TIMEOUT_MS);
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
      if (!active && session?.phase !== 'active') end();
    },
    accept(call: CallKey) {
      if (!foreground || session?.phase !== 'ringing' || !matches(call, session.call)) return false;
      clearTimeout(ringTimer);
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
      const { ok, ack } = await emitWithAck('chat:call:invite', call, INVITE_ACK_TIMEOUT_MS);
      if (!Object.is(session, pending)) return;
      if (ok && isInvite(ack) && matches(call, ack) && ack.mode === mode) {
        setSession({ ...pending, phase: 'active' });
      } else {
        // The server may have forwarded the invite before the ACK was lost.
        end(call);
        onInviteError('Không thể gửi lời mời cuộc gọi.');
      }
    },
  };
}
