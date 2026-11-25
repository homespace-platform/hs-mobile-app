import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, Text, TurboModuleRegistry, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IRtcEngine, IRtcEngineEventHandler, RtcSurfaceView } from 'react-native-agora';
import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import { getChatCallToken } from '@/services/chatCallApi';
import type { ChatCallRoomProps } from './ChatCallRoom';

const WAIT_FOR_PARTICIPANT_MS = 45_000;

function checkAgora(result: number, message: string) {
  if (result < 0) throw new Error(`${message} (${result}).`);
}

export default function ChatCallRoom({ call, participantName, onEnd }: ChatCallRoomProps) {
  const { conversationId, callId, mode } = call;
  const video = mode === 'video';
  const showDialog = useDialog();
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const engineRef = useRef<IRtcEngine | null>(null);
  const [joined, setJoined] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(video);
  const [speakerOn, setSpeakerOn] = useState(video);
  const [VideoSurface, setVideoSurface] = useState<typeof RtcSurfaceView | null>(null);

  useEffect(() => {
    let closed = false;
    let peer: number | null = null;
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    let engine: IRtcEngine | undefined;
    let handler: IRtcEngineEventHandler | undefined;
    let refreshingToken = false;

    function end(message?: string) {
      if (closed) return;
      closed = true;
      onEndRef.current();
      if (message) showDialog('Cuộc gọi HomeSpace', message);
    }

    function waitForParticipant() {
      clearTimeout(waitTimer);
      waitTimer = setTimeout(() => end('Cuộc gọi chưa kết nối được. Vui lòng gọi lại.'), WAIT_FOR_PARTICIPANT_MS);
    }

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background' && engine) end();
    });

    async function join() {
      if (!TurboModuleRegistry.get('AgoraRtcNg')) {
        throw new Error('Hãy cài bản HomeSpace mới để gọi thoại hoặc video.');
      }
      // Load calling modules on demand so an older APK can still open chat.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Camera } = require('expo-camera') as typeof import('expo-camera');
      const microphone = await Camera.getMicrophonePermissionsAsync();
      if (closed) return;
      if (!microphone.granted && !(await Camera.requestMicrophonePermissionsAsync()).granted) {
        throw new Error('Bạn cần cấp quyền micrô để gọi điện.');
      }
      if (closed) return;
      if (video) {
        const camera = await Camera.getCameraPermissionsAsync();
        if (closed) return;
        if (!camera.granted && !(await Camera.requestCameraPermissionsAsync()).granted) {
          throw new Error('Bạn cần cấp quyền camera để gọi video.');
        }
      }
      if (closed) return;

      const access = await getChatCallToken(conversationId, callId);
      if (closed) return;
      if (AppState.currentState === 'background') {
        end();
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sdk = require('react-native-agora') as typeof import('react-native-agora');
      const { ChannelProfileType, ConnectionStateType, UserOfflineReasonType, VideoCodecType } = sdk;
      const channelProfile = ChannelProfileType.ChannelProfileCommunication;
      const rtc = sdk.createAgoraRtcEngine();
      engine = rtc;
      engineRef.current = rtc;
      checkAgora(rtc.initialize({ appId: access.appId, channelProfile }), 'Không khởi tạo được cuộc gọi');

      async function renewToken() {
        if (closed || refreshingToken) return;
        refreshingToken = true;
        try {
          const next = await getChatCallToken(conversationId, callId);
          if (closed) return;
          if (next.appId !== access.appId || next.channel !== access.channel || next.uid !== access.uid) {
            throw new Error('Thông tin phòng gọi đã thay đổi.');
          }
          checkAgora(rtc.renewToken(next.token), 'Không làm mới được kết nối cuộc gọi');
        } catch {
          end('Phiên gọi đã hết hạn. Vui lòng gọi lại.');
        } finally {
          refreshingToken = false;
        }
      }

      handler = {
        onJoinChannelSuccess: () => {
          if (!closed) setJoined(true);
        },
        onUserJoined: (_connection, uid) => {
          if (closed) return;
          clearTimeout(waitTimer);
          peer = uid;
          setRemoteUid(uid);
        },
        onUserOffline: (_connection, uid, reason) => {
          if (closed || uid !== peer) return;
          if (reason === UserOfflineReasonType.UserOfflineQuit) {
            end();
            return;
          }
          peer = null;
          setRemoteUid(null);
          waitForParticipant();
        },
        onConnectionStateChanged: (_connection, state) => {
          if (closed) return;
          if (state === ConnectionStateType.ConnectionStateFailed) {
            end('Mất kết nối cuộc gọi. Vui lòng thử lại.');
            return;
          }
          const interrupted = state === ConnectionStateType.ConnectionStateReconnecting;
          setReconnecting(interrupted);
          if (interrupted) waitForParticipant();
          else if (state === ConnectionStateType.ConnectionStateConnected && peer !== null) clearTimeout(waitTimer);
        },
        onPermissionError: () => end('Hãy cấp quyền micrô và camera cần thiết cho cuộc gọi.'),
        onTokenPrivilegeWillExpire: () => void renewToken(),
        onRequestToken: () => void renewToken(),
        onError: (code) => end(`Không thể tiếp tục cuộc gọi (${code}).`),
      };
      rtc.registerEventHandler(handler);
      checkAgora(rtc.enableAudio(), 'Không bật được micrô');
      rtc.setDefaultAudioRouteToSpeakerphone(video);
      if (video) {
        setVideoSurface(() => sdk.RtcSurfaceView);
        // Prefer the browser room's VP8 when the device supports it; Agora can negotiate its default codec.
        rtc.setVideoEncoderConfiguration({ codecType: VideoCodecType.VideoCodecVp8 });
        checkAgora(rtc.enableVideo(), 'Không bật được camera');
        checkAgora(rtc.startPreview(), 'Không bật được xem trước camera');
      }
      waitForParticipant();
      // Chat Service signs the token for the same string account used by the web Agora SDK.
      checkAgora(rtc.joinChannelWithUserAccount(access.token, access.channel, access.uid, {
        channelProfile,
        publishMicrophoneTrack: true,
        publishCameraTrack: video,
        autoSubscribeAudio: true,
        autoSubscribeVideo: video,
      }), 'Không vào được phòng gọi');
    }

    void join().catch((cause) => end(apiError(cause)));
    return () => {
      closed = true;
      clearTimeout(waitTimer);
      appState.remove();
      engineRef.current = null;
      if (engine) {
        if (handler) engine.unregisterEventHandler(handler);
        if (video) engine.stopPreview();
        engine.leaveChannel();
        engine.release();
      }
    };
  }, [callId, conversationId, showDialog, video]);

  function toggleMic() {
    if (engineRef.current?.muteLocalAudioStream(!micMuted) === 0) setMicMuted(!micMuted);
  }

  function toggleSpeaker() {
    if (engineRef.current?.setEnableSpeakerphone(!speakerOn) === 0) setSpeakerOn(!speakerOn);
  }

  function toggleCamera() {
    const rtc = engineRef.current;
    if (rtc?.enableLocalVideo(!cameraOn) !== 0) return;
    setCameraOn(!cameraOn);
  }

  const status = reconnecting
    ? 'Đang kết nối lại…'
    : remoteUid !== null
      ? 'Đang trong cuộc gọi'
      : joined ? 'Đang chờ người bên kia…' : 'Đang kết nối…';

  return (
    <Modal animationType="slide" onRequestClose={onEnd}>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <ScreenHeader title={video ? 'Cuộc gọi video' : 'Cuộc gọi thoại'} onBack={onEnd} />
        <View className="flex-1 gap-4 p-5">
          <View className="items-center gap-1">
            <Text accessibilityRole="header" className="text-xl font-bold text-foreground">{participantName}</Text>
            <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">{status}</Text>
          </View>
          <View className="flex-1 items-center justify-center overflow-hidden rounded-3xl bg-muted">
            {VideoSurface && remoteUid !== null ? (
              <VideoSurface key={remoteUid} canvas={{ uid: remoteUid }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Icon name={video ? 'videocam-outline' : 'call-outline'} size={54} className="text-primary" />
            )}
            {VideoSurface && joined && cameraOn ? (
              <View className="absolute bottom-3 right-3 h-32 w-24 overflow-hidden rounded-xl border border-border bg-surface">
                <VideoSurface canvas={{ uid: 0 }} zOrderMediaOverlay style={{ flex: 1 }} />
              </View>
            ) : null}
          </View>
          <View className="flex-row flex-wrap items-center justify-center gap-3">
            <Pressable accessibilityRole="button" accessibilityLabel={micMuted ? 'Bật micrô' : 'Tắt micrô'} disabled={!joined} onPress={toggleMic} className="h-12 w-12 items-center justify-center rounded-full bg-muted disabled:opacity-50">
              <Icon name={micMuted ? 'mic-off-outline' : 'mic-outline'} size={22} className="text-foreground" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={speakerOn ? 'Tắt loa ngoài' : 'Bật loa ngoài'} disabled={!joined} onPress={toggleSpeaker} className="h-12 w-12 items-center justify-center rounded-full bg-muted disabled:opacity-50">
              <Icon name={speakerOn ? 'volume-high-outline' : 'volume-low-outline'} size={22} className="text-foreground" />
            </Pressable>
            {video ? (
              <Pressable accessibilityRole="button" accessibilityLabel={cameraOn ? 'Tắt camera' : 'Bật camera'} disabled={!joined} onPress={toggleCamera} className="h-12 w-12 items-center justify-center rounded-full bg-muted disabled:opacity-50">
                <Icon name={cameraOn ? 'videocam-outline' : 'videocam-off-outline'} size={22} className="text-foreground" />
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={onEnd} className="min-h-12 flex-row items-center gap-2 rounded-full bg-danger-soft px-4">
              <Icon name="call-outline" size={18} className="text-danger" />
              <Text className="font-bold text-danger">Kết thúc</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
