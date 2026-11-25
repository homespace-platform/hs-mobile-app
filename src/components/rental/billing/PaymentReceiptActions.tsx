// Web components/payment/PaymentReceiptActions.tsx. "Tải PDF" opens the share sheet.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import PdfViewerModal from '@/components/rental/pdf/PdfViewerModal';
import ActionButton from '@/components/rental/shared/ActionButton';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { discardRentalFile } from '@/services/rental/cache';
import { sharePdf } from '@/services/rental/files';
import {
  paymentReceiptService,
  type PaymentReceipt,
} from '@/services/rental/payment-receipt.service';

import { useActionLock, useAlive, useToast } from './common';
import { receiptFileName, receiptNotReady } from './logic';

export type PaymentReceiptActionsProps = {
  paymentId: string;
  receipt?: PaymentReceipt;
};

const OPEN_FAILED = 'Chưa mở được chứng từ thanh toán. Vui lòng thử lại.';
/** Keyed by payment: a late answer for another payment is dropped with its component. */
export default function PaymentReceiptActions(props: PaymentReceiptActionsProps) {
  return <ReceiptActions key={props.paymentId} {...props} />;
}

function ReceiptActions({ paymentId, receipt }: PaymentReceiptActionsProps) {
  const toast = useToast();
  const isAlive = useAlive();
  const lock = useActionLock();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ id: string; number: string; uri: string } | null>(null);
  // The viewed copy is ours: it goes when the viewer closes or this block leaves (web revokes its URL).
  useEffect(() => {
    if (preview) return () => void discardRentalFile(preview.uri);
  }, [preview]);

  const open = (download: boolean) =>
    void lock.run(async () => {
      setBusy(true);
      try {
        // A prop that is not READY may be stale (the PDF may be ready by now): read it again.
        const source =
          receipt?.pdfStatus === 'READY'
            ? receipt
            : await paymentReceiptService.byPayment(paymentId);
        if (!isAlive()) return;
        if (source.pdfStatus !== 'READY') {
          toast.info(receiptNotReady(source.pdfStatus));
          return;
        }
        // As web, both actions read and check the PDF first: a bad one never opens the viewer.
        const cached = await paymentReceiptService.pdf(source.id);
        if (!isAlive()) return void discardRentalFile(cached);
        if (!download) {
          setPreview({ id: source.id, number: source.receiptNumber, uri: cached });
          return;
        }
        // Named like the web download, next to the cached copy.
        const named = `${cached.slice(0, cached.lastIndexOf('/') + 1)}${encodeURIComponent(receiptFileName(source.receiptNumber))}`;
        try {
          await FileSystem.moveAsync({ from: cached, to: named });
          // Left during the rename: no share sheet over another screen.
          if (!isAlive()) return;
          // Keyed by payment and unmounted with its dialog, so alive covers both.
          await sharePdf(named, isAlive);
        } finally {
          // Removes the folder, under either name; later if the share sheet took the file.
          void discardRentalFile(cached);
        }
      } catch (error) {
        if (isAlive()) toast.error(getApiErrorMessage(error, OPEN_FAILED));
      } finally {
        if (isAlive()) setBusy(false);
      }
    });

  return (
    <View className="flex-row flex-wrap gap-2">
      <ActionButton
        label="Xem hóa đơn PDF"
        icon="eye-outline"
        variant="secondary"
        // As web: this button spins for either action; "Tải PDF" keeps its icon.
        busy={busy}
        onClick={() => open(false)}
        className="grow"
      />
      <ActionButton
        label="Tải PDF"
        icon="download-outline"
        variant="secondary"
        disabled={busy}
        onClick={() => open(true)}
        className="grow"
      />
      {preview ? (
        <PdfViewerModal
          isOpen
          onClose={() => setPreview(null)}
          title="Chứng từ thanh toán"
          subtitle={preview.number}
          label={`Chứng từ ${preview.number}`}
          closeLabel="Đóng bản xem PDF"
          documentKey={preview.id}
          errorText={OPEN_FAILED}
          source={preview.uri}
        />
      ) : null}
    </View>
  );
}
