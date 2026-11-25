// Web components/complaint/ComplaintHistory.tsx.
import { Text, View } from 'react-native';

import Accordion from '@/components/rental/shared/Accordion';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { deviceDateTime, numberVi, vnDateTime } from '@/lib/rental/format';
import {
  complaintActions,
  complaintEventContext,
  type ComplaintCase,
  type ComplaintWorkflowSource,
} from '@/types/rental/complaint.type';

import { LinkButton, Notice } from './common';

export type ProofDocument = NonNullable<ComplaintWorkflowSource['documents']>[number];
export type OpenProof = (id: string, label: string, document?: ProofDocument) => void;

const actor = (role: string) =>
  (
    ({
      ADMIN: 'HomeSpace',
      SYSTEM: 'Hệ thống',
      TENANT: 'Người thuê',
      LANDLORD: 'Chủ nhà',
    }) as Record<string, string>
  )[role] ?? 'Người thực hiện';

const Body = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-sm leading-6 text-foreground">{children}</Text>
);

export default function ComplaintHistory({
  complaint,
  onProof,
  expanded = false,
}: {
  complaint: ComplaintCase;
  expanded?: boolean;
  onProof: OpenProof;
}) {
  return (
    <View className="gap-3">
      <ComplaintSources complaint={complaint} onProof={onProof} />
      <Accordion title={`Lịch sử khiếu nại (${complaint.events.length})`} defaultOpen={expanded}>
        <View className="gap-2">
          {complaint.events.map((event) => {
            const context = complaintEventContext(event.metadataJson);
            return (
              <View key={event.revision} className="gap-1 rounded-xl border border-border p-3">
                <Text className="text-sm font-bold text-foreground">
                  {complaintActions[event.action] ?? event.action} · {actor(event.actorRole)}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {vnDateTime(event.occurredAt)}
                </Text>
                <Body>{event.reason}</Body>
                {context.agreement ? (
                  <Body>Thỏa thuận được phản hồi: {context.agreement}</Body>
                ) : null}
                {context.deduction != null ? (
                  <Body>
                    Đề xuất khấu trừ: {numberVi(context.deduction)} đ · Phiên bản{' '}
                    {context.version ?? '—'}
                  </Body>
                ) : null}
                {context.evidenceIds.map((id, index) => {
                  const label = `Chứng cứ của phản hồi này ${index + 1}`;
                  return <LinkButton key={id} label={label} onPress={() => onProof(id, label)} />;
                })}
              </View>
            );
          })}
        </View>
      </Accordion>
    </View>
  );
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');

function ComplaintSources({
  complaint,
  onProof,
}: {
  complaint: ComplaintCase;
  onProof: OpenProof;
}) {
  return (
    <>
      {complaint.sources?.map((source, index) => {
        const proposal = source.proposal;
        const title =
          (
            {
              CANCELLATION: 'Đề nghị xử lý trước thuê',
              EARLY_EXIT: 'Thỏa thuận chấm dứt sớm',
            } as Record<string, string>
          )[source.kind] ?? 'Hồ sơ nguồn';
        const rent = source.rentCalculation;
        return (
          <View
            key={`${source.workflowId}:${source.revision}:${index}`}
            className="gap-2 rounded-2xl border border-border bg-muted p-3">
            <Text className="text-sm font-bold text-foreground">
              Căn cứ: {title} · Bản {source.revision}
            </Text>
            <PolicyNotice
              tone="neutral"
              title="Dữ liệu tại thời điểm chụp"
              summary="Nội dung này giữ nguyên khi hồ sơ nguồn được chỉnh sau đó.">
              <Notice>
                Chụp lúc {vnDateTime(source.capturedAt)}. Nội dung này giữ nguyên khi hồ sơ nguồn
                được chỉnh sau đó.
              </Notice>
            </PolicyNotice>
            {text(proposal.reason) ? <Body>{text(proposal.reason)}</Body> : null}
            {typeof proposal.endExclusive === 'string' ? (
              <Body>Ngày kết thúc (không tính ngày này): {proposal.endExclusive}</Body>
            ) : null}
            {typeof proposal.handoverTerms === 'string' ? (
              <Body>Bàn giao: {proposal.handoverTerms}</Body>
            ) : null}
            {rent &&
            typeof rent.agreedFinalRent === 'number' &&
            typeof rent.requiredRefund === 'number' ? (
              <Body>
                Cách tính tiền thuê: {rent.policy === 'DAILY_PRORATED' ? 'Theo ngày' : 'Trọn kỳ'} ·{' '}
                {rent.usedDays}/{rent.periodDays} ngày · Tiền thuê kỳ cuối{' '}
                {numberVi(rent.agreedFinalRent)} đ · Khoản hoàn tối thiểu{' '}
                {numberVi(rent.requiredRefund)} đ
              </Body>
            ) : null}
            {source.documents?.map((document, i) => {
              const label = `PDF căn cứ ${i + 1} · ${document.purpose === 'SIGNED_FINAL' ? 'đã ký đủ' : document.purpose === 'SIGNED_LANDLORD' ? 'chủ nhà đã ký' : 'bản nguồn'} · Bản ${document.sourceRevision}`;
              return (
                <LinkButton
                  key={document.storageObjectId}
                  label={label}
                  onPress={() => onProof(document.storageObjectId, label, document)}
                />
              );
            })}
            <Body>
              Chủ nhà xác nhận:{' '}
              {source.ownerConfirmedAt ? deviceDateTime(source.ownerConfirmedAt) : 'chưa xác nhận'}{' '}
              · Người thuê:{' '}
              {source.tenantConfirmedAt
                ? deviceDateTime(source.tenantConfirmedAt)
                : 'chưa xác nhận'}
            </Body>
            {source.evidenceIds.map((id, i) => {
              const label = `Bằng chứng nguồn ${i + 1}`;
              return <LinkButton key={id} label={label} onPress={() => onProof(id, label)} />;
            })}
            <View className="gap-2 border-t border-border pt-2">
              <Text className="text-sm font-bold text-foreground">
                Lịch sử nguồn ({source.history.length})
              </Text>
              {source.history.map((event) => (
                <Body key={event.revision}>
                  {deviceDateTime(event.at)} · {actor(event.role)}: {event.reason}
                </Body>
              ))}
            </View>
          </View>
        );
      })}
    </>
  );
}
