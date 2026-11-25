// Web: components/contract/detail/ContractPartiesSection.tsx.
import { Text, View } from 'react-native';

import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { useContractDraftEditor } from '@/lib/rental/ContractDraftEditor';
import type { TermRow } from '@/types/rental/contract-amendment.type';

import { Anchor } from './anchors';
import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { Chip, FieldRow, Section } from './fields';
import InlineAmendmentFields, { ContractTermFields, type TermField } from './InlineAmendmentFields';

const EDIT_FIELDS: readonly TermField[] = [
  ['fullName', 'Họ và tên', true, 'Theo KYC đã xác thực'],
  ['idNumber', 'Số CCCD / Định danh', true],
  ['birthDate', 'Ngày sinh', true],
  ['gender', 'Giới tính', true],
  ['permanentAddress', 'Nơi thường trú', true],
  ['issueDate', 'Ngày cấp CCCD', true],
  ['expirationDate', 'Ngày hết hạn CCCD', true],
  ['issuePlace', 'Nơi cấp CCCD', true],
  ['phone', 'Số điện thoại'],
  ['email', 'Email liên hệ'],
  ['bankName', 'Ngân hàng'],
  ['bankAccountNumber', 'Số tài khoản'],
  ['bankAccountHolder', 'Chủ tài khoản'],
];
const RESIDENT_FIELDS: readonly TermField[] = [
  ['occupantCount', 'Số người cư trú'],
  ['motorbikeCount', 'Xe máy đăng ký'],
  ['carCount', 'Ô tô đăng ký'],
];

const SIDES = [
  {
    group: 'landlord',
    title: 'Bên A — Bên cho thuê',
    chip: 'Chủ nhà',
    account: 'Tài khoản nhận thanh toán',
  },
  {
    group: 'tenant',
    title: 'Bên B — Bên thuê',
    chip: 'Người thuê',
    account: 'Tài khoản nhận hoàn trả / hoàn cọc',
  },
] as const;

export default function ContractPartiesSection({
  landlord: originalLandlord,
  tenant: originalTenant,
}: {
  landlord: TermRow;
  tenant: TermRow;
}) {
  const w = useAmendmentWorkspace();
  const draft = useContractDraftEditor();
  const parties = {
    landlord: w?.data?.currentTerms.landlord ?? originalLandlord,
    tenant: w?.data?.currentTerms.tenant ?? originalTenant,
  };

  if (w?.editing || draft)
    return (
      <Anchor id={draft ? 'contract-parties' : 'amendment-residents'} className="gap-3">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          Chủ thể giao kết hợp đồng
        </Text>
        {SIDES.map(({ group, title }) => (
          <Section key={group} title={title}>
            <ContractTermFields group={group} fields={EDIT_FIELDS} />
            <PolicyNotice
              tone="neutral"
              title="Thông tin các bên"
              text={
                draft
                  ? 'Danh tính lấy từ KYC đã xác thực và không được nhập sửa. Thông tin liên hệ dùng trên văn bản không thay tài khoản thu/hoàn tiền trong Settings. Phí theo người/xe được tính lại khi lưu; khoản đã thanh toán giữ lịch sử.'
                  : 'Danh tính KYC giữ nguyên theo snapshot hợp đồng. Bạn có thể sửa thông tin liên hệ và điều khoản được phép. QR thanh toán dùng tài khoản ngân hàng đã đăng ký trong hồ sơ thanh toán.'
              }
            />
            {group === 'tenant' ? (
              draft ? (
                <ContractTermFields group="tenant" fields={RESIDENT_FIELDS} />
              ) : (
                <InlineAmendmentFields group="residents" />
              )
            ) : null}
          </Section>
        ))}
      </Anchor>
    );

  const { occupantCount, motorbikeCount, carCount } = parties.tenant;
  return (
    <Anchor id="amendment-residents" className="gap-3">
      <View>
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          Chủ thể giao kết hợp đồng
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          Thông tin trong điều khoản đang áp dụng
        </Text>
      </View>
      {SIDES.map(({ group, title, chip, account }) => {
        const party = parties[group];
        return (
          <Section
            key={group}
            icon={group === 'landlord' ? 'person-outline' : 'shield-checkmark-outline'}
            title={title}
            badge={chip}>
            <View>
              <FieldRow label="Họ và tên" value={party.fullName} highlight />
              <FieldRow label="Số CCCD / Định danh" value={party.idNumber} />
              <FieldRow label="Nơi thường trú" value={party.permanentAddress} />
              <FieldRow label="Ngày sinh" value={party.birthDate} />
              <FieldRow label="Giới tính" value={party.gender} />
              <FieldRow label="Ngày cấp CCCD" value={party.issueDate} />
              <FieldRow label="Ngày hết hạn CCCD" value={party.expirationDate} />
              <FieldRow label="Nơi cấp CCCD" value={party.issuePlace} />
              <FieldRow editable label="Số điện thoại" value={party.phone} />
              <FieldRow editable label="Email liên hệ" value={party.email} />
            </View>
            <View>
              <Chip>{account}</Chip>
              <FieldRow editable label="Ngân hàng" value={party.bankName} />
              <FieldRow editable label="Số tài khoản" value={party.bankAccountNumber} />
              <FieldRow editable label="Chủ tài khoản" value={party.bankAccountHolder} />
            </View>
            {group !== 'tenant' ? null : w?.editing ? (
              <InlineAmendmentFields group="residents" />
            ) : (
              <View>
                <FieldRow
                  editable
                  label="Số người ở chính thức"
                  value={occupantCount ? `${occupantCount} người` : undefined}
                />
                <FieldRow
                  editable
                  label="Xe máy đăng ký"
                  value={
                    motorbikeCount != null && Number(motorbikeCount) > 0
                      ? `${motorbikeCount} xe`
                      : 'Không đăng ký xe máy'
                  }
                />
                <FieldRow
                  editable
                  label="Ô tô đăng ký"
                  value={
                    carCount != null && Number(carCount) > 0
                      ? `${carCount} xe`
                      : 'Không đăng ký ô tô'
                  }
                />
              </View>
            )}
          </Section>
        );
      })}
    </Anchor>
  );
}
