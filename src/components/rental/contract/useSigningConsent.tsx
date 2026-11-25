// Mobile only, stricter than web: a consent belongs to one signer, revision and source file. It stops
// counting when any of them changes, and they are read again right before the request is sent.
// This narrows the gap only; closing it needs the server to accept and check the revision and file.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import { contractService } from '@/services/rental/contract.service';
import type { ContractResponse, SignatureStateResponse } from '@/types/rental/contract.type';

import { signingSource } from './signingLogic';

export const SOURCE_CHANGED =
  'Văn bản ký đã thay đổi. Hãy tải lại hồ sơ, xem lại bản PDF rồi xác nhận đồng ý lại. Chưa gửi yêu cầu.';
export const SOURCE_CHECK_FAILED =
  'Chưa kiểm tra lại được văn bản sẽ ký nên chưa gửi yêu cầu. Hãy thử lại.';

/** The signing source the server holds right now. Throws if unreadable. */
export async function readSigningSource(
  contractId: string,
  mode: SignatureStateResponse['signatureMode'],
  signerId: string
) {
  const [fresh, documents] = await Promise.all([
    contractService.getContract(contractId),
    contractService.getDocuments(contractId),
  ]);
  return signingSource(documents, fresh, mode, signerId);
}

export function useSigningConsent({
  contract,
  signerId,
  mode,
  enabled,
  hasFile,
  version,
}: {
  contract: ContractResponse;
  signerId: string;
  mode: SignatureStateResponse['signatureMode'];
  /** A consent box is on screen. */
  enabled: boolean;
  /** The host's own "a file is ready" flag. */
  hasFile: boolean;
  /** Changes when the host re-read its data. */
  version: unknown;
}) {
  const [read, setRead] = useState<{ turn: string; source: string | null; failed?: boolean }>();
  const [agreed, setAgreed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { id, status, currentRevisionId } = contract;
  const turn = [signerId, id, currentRevisionId, status, mode].join('|');

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    contractService.getDocuments(id).then(
      (documents) => {
        if (!active) return;
        const target = { id, status, currentRevisionId };
        setRead({ turn, source: signingSource(documents, target, mode, signerId) });
      },
      () => {
        if (active) setRead({ turn, source: null, failed: true });
      }
    );
    return () => {
      active = false;
    };
  }, [enabled, turn, id, status, currentRevisionId, mode, signerId, hasFile, version, attempt]);

  const latest = read?.turn === turn ? read : undefined;
  const source = latest?.source ?? null;
  const checked = source !== null && agreed === source;
  const reload = () => setAttempt((n) => n + 1);

  return {
    source,
    checked,
    setChecked: (value: boolean) => setAgreed(value ? source : null),
    /** True only while the server still holds exactly what was agreed to. Throws if unreadable. */
    async stillCurrent(): Promise<boolean> {
      if (!checked) return false;
      if ((await readSigningSource(id, mode, signerId)) === agreed) return true;
      setAgreed(null);
      reload();
      return false;
    },
    note: {
      reload,
      changed: agreed !== null && source !== null && !checked,
      text: !latest
        ? 'Đang xác định văn bản sẽ ký…'
        : latest.failed
          ? 'Chưa xác định được văn bản sẽ ký nên chưa thể đồng ý.'
          : !source && hasFile
            ? 'Chưa tìm thấy tệp đúng phiên bản để ký. Hãy tải lại hồ sơ.'
            : null,
      retry: !!latest && !source && (!!latest.failed || hasFile),
    },
  };
}

export function ConsentSourceNote({
  note,
}: {
  note: ReturnType<typeof useSigningConsent>['note'];
}) {
  const text = note.changed
    ? 'Văn bản ký đã thay đổi. Hãy xem lại bản PDF rồi xác nhận đồng ý lại.'
    : note.text;
  if (!text) return null;
  return (
    <View className="gap-2">
      <Text accessibilityLiveRegion="polite" className="text-xs leading-5 text-warning">
        {text}
      </Text>
      {note.retry ? (
        <ActionButton
          label="Tải lại văn bản sẽ ký"
          icon="refresh"
          variant="secondary"
          onClick={note.reload}
        />
      ) : null}
    </View>
  );
}
