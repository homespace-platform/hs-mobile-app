import axiosClient from '@/lib/axios-client';
import {
  buildRegisterBody,
  buildUnregisterBody,
  type PushIdentity,
  type PushPlatform,
} from '@/lib/push/pure';

// hs-notification-service via Gateway. The server takes the user from the Gateway, never from the body.
const BASE = '/api/v1/notifications/devices';

export async function putPushDevice(identity: PushIdentity, platform: PushPlatform, fid: string) {
  await axiosClient.put(BASE, buildRegisterBody(identity, platform, fid));
}

export async function deletePushDevice(identity: PushIdentity, timeout = 3000) {
  await axiosClient.delete(`${BASE}/${encodeURIComponent(identity.installationId)}`, {
    data: buildUnregisterBody(identity),
    timeout,
  });
}
