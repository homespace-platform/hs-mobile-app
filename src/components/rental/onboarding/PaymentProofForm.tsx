// The "Khai báo chứng từ chuyển khoản" form of web RentalPaymentModal.tsx:797-1182 (LOCAL source only, Q2).
import { Image, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import EvidencePicker from '@/components/rental/shared/EvidencePicker';
import { formatFileSize, PROOF_MAX_BYTES, proofFileError } from '@/lib/rental/RentalPaymentModal';
import type { LocalFile } from '@/services/storageApi';

import type { ProofState } from './logic';

const TYPE_ERROR = proofFileError({ type: '', size: 0 })!;
const SIZE_ERROR = proofFileError({ type: 'application/pdf', size: PROOF_MAX_BYTES + 1 })!;
const MESSAGES = { type: TYPE_ERROR, size: SIZE_ERROR, count: TYPE_ERROR };

function FileStatus({ proof }: { proof: ProofState }) {
  if (proof.status === 'IDLE') return null;
  const look = {
    UPLOADING: {
      icon: 'cloud-upload-outline',
      tone: 'text-primary',
      text: 'Đang tải tệp lên storage...',
    },
    SUCCESS: {
      icon: 'checkmark-circle',
      tone: 'text-success',
      text: 'Tệp đã tải lên & sẵn sàng',
    },
    ERROR: {
      icon: 'warning-outline',
      tone: 'text-danger',
      text: proof.error || 'Tải lên thất bại',
    },
  } as const;
  const { icon, tone, text } = look[proof.status];
  return (
    <View accessibilityLiveRegion="polite" className="flex-row items-start gap-1.5">
      <Icon name={icon} size={15} className={tone} />
      <Text className={`flex-1 text-xs font-semibold leading-5 ${tone}`}>{text}</Text>
    </View>
  );
}

export default function PaymentProofForm({
  recipient,
  proof,
  onPick,
  onRefused,
  onPickFailed,
  onPickingChange,
  onRemove,
  onCancel,
  onSubmit,
}: {
  recipient: string;
  proof: ProofState;
  onPick: (file: LocalFile) => void;
  /** Wrong type or too large. */
  onRefused: (message: string) => void;
  /** The device picker itself failed. */
  onPickFailed: (message: string) => void;
  onPickingChange: (picking: boolean) => void;
  onRemove: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const { file, submitting } = proof;
  const uploading = proof.status === 'UPLOADING';

  return (
    <View className="gap-4 rounded-2xl border-2 border-primary-border bg-surface p-4">
      <View className="gap-1 border-b border-border pb-3">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          Khai báo chứng từ chuyển khoản
        </Text>
        <Text className="text-sm leading-6 text-muted-foreground">
          Chứng từ của bạn sẽ được gửi trực tiếp cho {recipient} để kiểm tra với tài khoản ngân
          hàng.
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-bold text-foreground">
          Chứng từ chuyển khoản <Text className="text-danger">* (Bắt buộc)</Text>
        </Text>
        {file ? (
          <View className="gap-3 rounded-2xl border border-border bg-background p-3">
            <View className="flex-row items-center gap-3">
              {file.contentType.startsWith('image/') ? (
                <Image
                  source={{ uri: file.uri }}
                  accessibilityLabel="Xem trước chứng từ"
                  className="h-20 w-20 rounded-xl bg-muted"
                />
              ) : (
                <View className="h-20 w-20 items-center justify-center rounded-xl bg-primary-soft">
                  <Icon name="document-text-outline" size={28} className="text-primary" />
                  <Text className="text-xs font-bold text-primary">PDF</Text>
                </View>
              )}
              <View className="flex-1 gap-1">
                <Text numberOfLines={2} className="text-sm font-semibold text-foreground">
                  {file.fileName}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {formatFileSize(file.sizeBytes)}
                </Text>
                <FileStatus proof={proof} />
              </View>
            </View>
            <ActionButton
              label="Xóa"
              icon="trash-outline"
              variant="secondary"
              disabled={submitting}
              onClick={onRemove}
            />
          </View>
        ) : (
          <View className="gap-0.5">
            <Text className="text-sm font-semibold text-foreground">
              Đính kèm ảnh biên lai hoặc tệp PDF từ thiết bị này
            </Text>
            <Text className="text-xs text-muted-foreground">
              Hỗ trợ JPG, PNG, WebP, PDF (tối đa 15MB).
            </Text>
          </View>
        )}
        {/* Always at this position, so its own error line survives the file being dropped. */}
        <EvidencePicker
          value={[]}
          onChange={(files) => files[0] && onPick(files[0])}
          messages={MESSAGES}
          maxBytes={PROOF_MAX_BYTES}
          camera
          libraryLabel={file ? 'Chọn tệp khác' : 'Chọn từ thư viện'}
          documentLabel="Chọn tệp (PDF)"
          cameraLabel="Chụp ảnh"
          ariaLabel="Chứng từ chuyển khoản"
          disabled={submitting}
          onPickingChange={onPickingChange}
          onError={(message) =>
            message === TYPE_ERROR || message === SIZE_ERROR
              ? onRefused(message)
              : onPickFailed(message)
          }
        />
      </View>

      <View className="gap-2 border-t border-border pt-3">
        <Text className="text-xs italic leading-5 text-muted-foreground">
          * Chủ nhà sẽ kiểm tra chứng từ và đối chiếu với tài khoản ngân hàng trước khi xác nhận.
        </Text>
        <ActionButton
          label={
            submitting
              ? 'Đang gửi chứng từ...'
              : uploading
                ? 'Đang tải tệp lên...'
                : 'Gửi chứng từ cho bên nhận xác nhận'
          }
          busy={submitting || uploading}
          disabled={proof.picking || (!file && !proof.storageId)}
          onClick={onSubmit}
        />
        <ActionButton label="Hủy" variant="secondary" disabled={submitting} onClick={onCancel} />
      </View>
    </View>
  );
}
