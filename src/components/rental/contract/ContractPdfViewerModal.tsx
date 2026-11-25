// Web: components/contract/detail/ContractPdfViewerModal.tsx + ContractPdfViewerContent.tsx.
// Dropped on mobile (approved): rotate, single-page mode, open in a new tab, fullscreen toggle.
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import PdfViewerModal from '@/components/rental/pdf/PdfViewerModal';
import ActionButton from '@/components/rental/shared/ActionButton';
import ModalShell from '@/components/rental/shared/ModalShell';
import { requiresVerifiedContent } from '@/lib/rental/contract-document-history';
import { contractService } from '@/services/rental/contract.service';
import { fileSessionGuard } from '@/services/rental/cache';
import { blobToCacheFile } from '@/services/rental/files';
import type { ContractDocumentResponse } from '@/types/rental/contract.type';

import { documentFileName, downloadUrlToCache, openWithDeviceApps } from './documentFiles';
import { createSingleFlight, freshPreviewUrl, isPdf } from './signingLogic';

export type ContractPdfViewerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  document: ContractDocumentResponse | null;
};

const PURPOSE: Partial<Record<string, string>> = {
  SIGNED_FINAL: 'Đã ký đủ hai bên',
  SIGNED_LANDLORD: 'Chủ nhà đã ký',
  OFFICIAL: 'Chính thức',
};

export default function ContractPdfViewerModal({
  isOpen,
  onClose,
  document: doc,
}: ContractPdfViewerModalProps) {
  if (!isOpen || !doc) return null;
  if (!requiresVerifiedContent(doc) && !isPdf(doc))
    return <ExternalDocument key={doc.id} doc={doc} onClose={onClose} />;
  return <PdfDocument key={`${doc.id}:${doc.revisionId}`} doc={doc} onClose={onClose} />;
}

/** A stored signed URL may have expired: read the metadata again for every open and retry. */
async function readFreshUrl(doc: ContractDocumentResponse) {
  const checkSession = fileSessionGuard();
  const fresh = await contractService.getDocument(doc.id).catch(() => {
    // The transport error is English.
    throw new Error('Không thể tải nội dung tài liệu.');
  });
  checkSession();
  return freshPreviewUrl(doc, fresh);
}

function PdfDocument({ doc, onClose }: { doc: ContractDocumentResponse; onClose: () => void }) {
  const verified = requiresVerifiedContent(doc);
  const [externalUrl, setExternalUrl] = useState<string>();
  const name = documentFileName(doc);
  return (
    <PdfViewerModal
      isOpen
      onClose={onClose}
      label={`Xem hợp đồng: ${doc.fileName || 'PDF'}`}
      title={name}
      documentType={doc.documentType}
      subtitle={PURPOSE[doc.purpose] ?? 'Bản xem trước'}
      documentKey={`${doc.id}:${doc.revisionId}`}
      // A signed final PDF is only ever drawn from the integrity-checked bytes, never from viewUrl.
      source={
        verified
          ? async (signal) =>
              blobToCacheFile(
                await contractService.getDocumentContent(doc.id, false, signal),
                doc.fileName || 'hop-dong-da-ky.pdf'
              )
          : async () => {
              setExternalUrl(undefined);
              const url = await readFreshUrl(doc);
              setExternalUrl(url);
              return downloadUrlToCache(url, doc);
            }
      }
      loadingText={verified ? 'Đang kiểm tra và tải PDF đã ký…' : undefined}
      errorText={verified ? 'Chưa xác thực được tài liệu. Vui lòng thử lại.' : undefined}
      externalUrl={externalUrl}
    />
  );
}

/** A file the app cannot draw (DOCX): download it and open it with the phone's apps. */
function ExternalDocument({
  doc,
  onClose,
}: {
  doc: ContractDocumentResponse;
  onClose: () => void;
}) {
  const showDialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [flight] = useState(createSingleFlight);

  const open = () =>
    flight(async () => {
      setBusy(true);
      try {
        await openWithDeviceApps(await readFreshUrl(doc), doc);
      } catch (error) {
        showDialog('Thông báo', error instanceof Error ? error.message : 'Không mở được tài liệu.');
      } finally {
        setBusy(false);
      }
    });

  return (
    <ModalShell title={documentFileName(doc)} icon="document-text-outline" onClose={onClose}>
      <View accessibilityLabel={`Xem hợp đồng: ${doc.fileName || 'PDF'}`} className="gap-3">
        <Text className="text-sm text-muted-foreground">
          {`${doc.documentType} · ${PURPOSE[doc.purpose] ?? 'Bản xem trước'}`}
        </Text>
        <ActionButton
          label="Tải về"
          icon="download-outline"
          busy={busy}
          onClick={() => void open()}
        />
      </View>
    </ModalShell>
  );
}
