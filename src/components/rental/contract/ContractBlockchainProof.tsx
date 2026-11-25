// Web: components/contract/detail/ContractBlockchainProof.tsx.
import { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import Icon from '@/components/Icon';
import { openUrl } from '@/components/rental/onboarding/common';
import Accordion from '@/components/rental/shared/Accordion';
import ActionButton from '@/components/rental/shared/ActionButton';
import InfoRow from '@/components/rental/shared/InfoRow';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import {
  blockchainProofPending,
  blockchainTransactionUrl,
  hashPdfForProof,
} from '@/lib/rental/contract-blockchain-proof';
import { documentTime } from '@/lib/rental/contract-document-history';
import { isAppVisible } from '@/lib/rental-sync/hooks';
import { discardPickedCopy, withFileLease } from '@/services/rental/cache';
import { contractBlockchainService } from '@/services/rental/contract-blockchain.service';
import type {
  ContractBlockchainProofResponse,
  DocumentIntegrityResponse,
} from '@/types/rental/blockchain.type';
import type { ContractDocumentResponse } from '@/types/rental/contract.type';

import { checkVerification, createSingleFlight, verificationFailureMessage } from './signingLogic';

export type ContractBlockchainProofProps = {
  document: ContractDocumentResponse;
};

export default function ContractBlockchainProof({ document: doc }: ContractBlockchainProofProps) {
  if (doc.documentType !== 'PDF' || doc.purpose !== 'SIGNED_FINAL' || doc.status !== 'READY')
    return null;
  return <ProofForDocument key={`${doc.id}:${doc.revisionId}`} document={doc} />;
}

type Verification = {
  status: 'idle' | 'busy' | 'match' | 'mismatch' | 'missing' | 'error';
  fileName?: string;
  message?: string;
};

const labels = {
  NOT_AVAILABLE: 'Chưa có bằng chứng blockchain',
  PENDING: 'Đang chờ ghi nhận blockchain',
  SUBMITTED: 'Đang chờ xác nhận blockchain',
  CONFIRMED: 'Đã ghi nhận trên blockchain',
  FAILED: 'Ghi nhận blockchain chưa thành công',
};

const integrityLabels: Record<DocumentIntegrityResponse['status'], string> = {
  MATCH: 'PDF đang lưu khớp bản đã ghi nhận trên blockchain.',
  MISMATCH: 'PDF đang lưu không khớp bản đã ký. Tệp này bị chặn xem/tải để đối soát.',
  PENDING: 'PDF khớp bản đã ký. Đang chờ xác nhận cuối cùng từ blockchain.',
  NOT_AVAILABLE: 'Chưa có dữ liệu đối chiếu cho PDF cũ. Tài liệu chưa được xác thực blockchain.',
  UNAVAILABLE: 'Tạm thời chưa xác thực được PDF. Lỗi kết nối không có nghĩa file bị sửa.',
  MISSING: 'Không tìm thấy PDF đang lưu. Hệ thống cần kiểm tra hoặc khôi phục tài liệu.',
};

const documentKinds: Record<number, string> = {
  1: 'Hợp đồng cọc',
  2: 'Hợp đồng thuê',
  3: 'Phụ lục',
};

const VERIFY_RESULTS = {
  match: 'Tệp khớp với hash đã ghi nhận trên blockchain.',
  mismatch: 'Tệp không khớp với hash đã ghi nhận. Hãy kiểm tra bạn đã chọn đúng PDF cuối đã ký.',
  missing: 'Chưa tìm thấy proof trên blockchain. Hãy làm mới bằng chứng trước khi đối chiếu lại.',
};

function ProofForDocument({ document: doc }: { document: ContractDocumentResponse }) {
  const [proof, setProof] = useState<ContractBlockchainProofResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [verification, setVerification] = useState<Verification>({ status: 'idle' });
  const [integrity, setIntegrity] = useState<DocumentIntegrityResponse | null>(null);
  const [integrityLoading, setIntegrityLoading] = useState(true);
  const [integrityError, setIntegrityError] = useState('');
  const [pickFlight] = useState(createSingleFlight);
  const verifyRequest = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let lastStatus: ContractBlockchainProofResponse['status'] | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    const schedule = () => {
      if (!disposed && isAppVisible() && blockchainProofPending(lastStatus))
        timer = setTimeout(() => void load(), 8000);
    };
    async function load() {
      if (disposed || inFlight || !isAppVisible()) return;
      clearTimeout(timer);
      inFlight = true;
      request = new AbortController();
      setLoading(true);
      try {
        const next = await contractBlockchainService.getProof(doc.id, request.signal);
        if (disposed) return;
        if (
          next.documentId !== doc.id ||
          next.contractId !== doc.contractId ||
          next.revisionId !== doc.revisionId
        )
          throw new Error('PROOF_DOCUMENT_MISMATCH');
        lastStatus = next.status;
        setProof(next);
        setLoadError('');
      } catch {
        if (!disposed)
          setLoadError(
            'Chưa tải được bằng chứng blockchain. Lỗi kết nối không có nghĩa PDF đã ký bị sai.'
          );
      } finally {
        inFlight = false;
        if (!disposed) {
          setLoading(false);
          schedule();
        }
      }
    }
    const visibility = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      if (state === 'active' && (lastStatus === null || blockchainProofPending(lastStatus)))
        void load();
    });
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
      request?.abort();
      verifyRequest.current?.abort();
      visibility.remove();
    };
  }, [doc.id, doc.contractId, doc.revisionId, refresh]);

  const readyToCheck = !!proof || !!loadError;
  const confirmed = proof?.status === 'CONFIRMED';
  useEffect(() => {
    if (!readyToCheck) return;
    const request = new AbortController();
    async function check() {
      setIntegrityLoading(true);
      setIntegrity(null);
      try {
        const result = await contractBlockchainService.checkIntegrity(doc.id, request.signal);
        if (request.signal.aborted) return;
        if (result.documentId !== doc.id) throw new Error('INTEGRITY_DOCUMENT_MISMATCH');
        setIntegrity(result);
        setIntegrityError('');
      } catch {
        if (!request.signal.aborted)
          setIntegrityError(
            'Chưa kiểm tra được PDF đang lưu. Hãy thử lại; lỗi kết nối không có nghĩa file không khớp.'
          );
      } finally {
        if (!request.signal.aborted) setIntegrityLoading(false);
      }
    }
    void check();
    return () => request.abort();
  }, [doc.id, doc.revisionId, readyToCheck, confirmed, refresh]);

  const verifyFile = () =>
    pickFlight(async () => {
      if (!proof || proof.status !== 'CONFIRMED' || loading || loadError) return;
      let uri: string | undefined;
      let fileName: string | undefined;
      let request: AbortController | undefined;
      try {
        const picked = await DocumentPicker.getDocumentAsync({
          type: 'application/pdf',
          copyToCacheDirectory: true,
        });
        const asset = picked.canceled ? undefined : picked.assets[0];
        // Noted before the mounted check: the copy exists even if the record was left meanwhile.
        uri = asset?.uri;
        if (!asset || !alive.current) return;
        fileName = asset.name;
        verifyRequest.current?.abort();
        request = new AbortController();
        verifyRequest.current = request;
        setVerification({ status: 'busy', fileName });
        const file = new File(asset.uri);
        // The size is checked before any byte is read.
        const hash = await withFileLease([asset.uri], () =>
          hashPdfForProof({
            size: asset.size ?? file.size ?? 0,
            arrayBuffer: () =>
              file.arrayBuffer().catch(() => {
                throw new Error(verificationFailureMessage(null));
              }),
          })
        );
        if (request.signal.aborted) return;
        const result = await contractBlockchainService.verify(doc.id, hash, request.signal);
        if (request.signal.aborted) return;
        setVerification({ status: checkVerification(doc.id, proof, result), fileName });
      } catch (failure) {
        if (alive.current && !request?.signal.aborted)
          setVerification({
            status: 'error',
            fileName,
            // A picker error is a native English one: show the generic message.
            message: verificationFailureMessage(request ? failure : null),
          });
      } finally {
        // The picker's private copy of the user's file is not kept.
        if (uri) void discardPickedCopy(uri);
      }
    });

  const explorer = blockchainTransactionUrl(proof?.chainId, proof?.transactionHash);
  const verifying = verification.status === 'busy';

  return (
    <View
      accessibilityLabel="Bằng chứng blockchain của PDF đã ký"
      className="gap-3 rounded-2xl border border-border bg-surface p-3">
      <View className="flex-row items-start gap-2">
        <Icon name="shield-checkmark-outline" size={20} className="text-primary" />
        <View className="flex-1 gap-1">
          <Text accessibilityRole="header" className="text-sm font-bold text-foreground">
            Bằng chứng blockchain
          </Text>
          <Text accessibilityLiveRegion="polite" className="text-sm leading-5 text-secondary">
            {proof
              ? labels[proof.status]
              : loading
                ? 'Đang tải bằng chứng…'
                : 'Chưa kiểm tra được bằng chứng'}
          </Text>
        </View>
      </View>
      <ActionButton
        label="Kiểm tra lại"
        icon="refresh"
        variant="secondary"
        disabled={loading || verifying || integrityLoading}
        onClick={() => {
          setVerification({ status: 'idle' });
          setRefresh((n) => n + 1);
        }}
      />
      <PolicyNotice
        tone="neutral"
        title="Ghi nhận blockchain"
        summary="Ghi nhận hash của đúng PDF đã ký đủ hai bên để đối chiếu về sau.">
        <Text className="text-sm leading-6 text-secondary">
          Ghi nhận hash của đúng PDF đã ký đủ hai bên để đối chiếu về sau. Tệp PDF được giữ riêng
          tư.
        </Text>
      </PolicyNotice>
      {loadError ? (
        <Text accessibilityRole="alert" className="text-sm leading-5 text-warning">
          {loadError}
        </Text>
      ) : null}
      <View
        accessibilityLabel="Tính toàn vẹn của PDF đang lưu"
        className="gap-1 border-t border-border pt-3">
        <Text className="text-sm font-semibold text-foreground">PDF đang lưu</Text>
        {integrityLoading ? (
          <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">
            Đang kiểm tra tài liệu…
          </Text>
        ) : integrityError ? (
          <Text accessibilityRole="alert" className="text-sm leading-5 text-warning">
            {integrityError}
          </Text>
        ) : integrity ? (
          <>
            <Text
              accessibilityRole={
                integrity.status === 'MISMATCH' || integrity.status === 'MISSING'
                  ? 'alert'
                  : undefined
              }
              className={`text-sm leading-5 ${integrity.status === 'MATCH' ? 'text-success' : 'text-warning'}`}>
              {integrityLabels[integrity.status]}
            </Text>
            <Text className="text-xs text-muted-foreground">
              Kiểm tra lúc: {documentTime(integrity.checkedAt)}
            </Text>
          </>
        ) : null}
      </View>
      {proof?.status === 'NOT_AVAILABLE' ? (
        <Text className="text-sm leading-5 text-muted-foreground">
          Tài liệu này chưa có proof. PDF đã ký vẫn xem và tải bình thường.
        </Text>
      ) : null}
      {proof?.status === 'FAILED' ? (
        <Text className="text-sm leading-5 text-warning">
          PDF đã ký vẫn được lưu. Hệ thống cần kiểm tra việc ghi nhận blockchain; bạn không cần ký
          hay thanh toán lại.
        </Text>
      ) : null}
      {proof && proof.status !== 'NOT_AVAILABLE' ? (
        <View className="gap-2">
          <Text className="text-sm text-foreground">
            Mạng: {proof.chainId === 11155111 ? 'Ethereum Sepolia (testnet)' : 'Chưa xác định'}
          </Text>
          {proof.status === 'CONFIRMED' ? (
            <Text className="text-sm text-foreground">
              Ghi nhận lúc: {documentTime(proof.registeredAt)}
            </Text>
          ) : null}
          {explorer ? (
            <ActionButton
              label="Xem giao dịch trên Etherscan"
              icon="open-outline"
              variant="secondary"
              onClick={() => void openUrl(explorer).catch(() => {})}
            />
          ) : null}
          {proof.documentHash ? (
            <Accordion title="Thông tin đối chiếu">
              <InfoRow stacked label="SHA-256 của PDF đã ký" value={proof.documentHash} />
              {proof.onChainDocumentId ? (
                <InfoRow
                  stacked
                  label="ID tài liệu trên blockchain"
                  value={proof.onChainDocumentId}
                />
              ) : null}
              {proof.status === 'CONFIRMED' && proof.caseId ? (
                <InfoRow stacked label="Mã hồ sơ liên kết các văn bản" value={proof.caseId} />
              ) : null}
              {proof.status === 'CONFIRMED' && proof.documentKind ? (
                <InfoRow
                  label="Loại văn bản"
                  value={documentKinds[proof.documentKind] ?? 'Chưa xác định'}
                />
              ) : null}
              {proof.transactionHash ? (
                <InfoRow stacked label="Mã giao dịch" value={proof.transactionHash} />
              ) : null}
              {proof.blockNumber != null ? (
                <InfoRow label="Block ghi nhận" value={String(proof.blockNumber)} />
              ) : null}
            </Accordion>
          ) : null}
        </View>
      ) : null}
      {proof?.status === 'CONFIRMED' ? (
        <Accordion title="Đối chiếu PDF từ bên ngoài">
          <View className="gap-3">
            <PolicyNotice
              tone="neutral"
              title="Đối chiếu PDF từ bên ngoài"
              summary="Dùng cho bản hợp đồng nhận qua email, Zalo hoặc lưu trên máy.">
              <Text className="text-sm leading-6 text-secondary">
                Dùng cho bản hợp đồng nhận qua email, Zalo hoặc lưu trên máy. PDF đang lưu trên hệ
                thống được kiểm tra tự động ở trên.
              </Text>
            </PolicyNotice>
            <ActionButton
              label={verifying ? 'Đang đối chiếu…' : 'Chọn PDF để đối chiếu'}
              icon="document-attach-outline"
              variant="secondary"
              busy={verifying}
              disabled={loading || !!loadError}
              onClick={() => void verifyFile()}
            />
            <PolicyNotice
              tone="neutral"
              title="Đối chiếu PDF"
              summary="Tính hash ngay trên máy bạn và chỉ gửi hash, không upload PDF.">
              <Text className="text-sm leading-6 text-secondary">
                Tính hash ngay trên máy bạn và chỉ gửi hash để đối chiếu, không upload PDF. Tối đa
                20 MB.
              </Text>
            </PolicyNotice>
            {verification.fileName ? (
              <Text className="text-xs text-muted-foreground">Tệp: {verification.fileName}</Text>
            ) : null}
            {verification.status === 'match' ||
            verification.status === 'mismatch' ||
            verification.status === 'missing' ? (
              <Text
                accessibilityLiveRegion="polite"
                className={`text-sm leading-5 ${verification.status === 'match' ? 'text-success' : 'text-warning'}`}>
                {VERIFY_RESULTS[verification.status]}
              </Text>
            ) : null}
            {verification.status === 'error' ? (
              <Text accessibilityRole="alert" className="text-sm leading-5 text-warning">
                {verification.message}
              </Text>
            ) : null}
          </View>
        </Accordion>
      ) : null}
    </View>
  );
}
