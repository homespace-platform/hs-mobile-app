// Web details/FurnishingAssetsSection: catalog chips plus one card per handover asset.
import { Text, View } from 'react-native';

import { Anchor } from '@/components/rental/contract/anchors';
import ActionButton from '@/components/rental/shared/ActionButton';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { HANDOVER_CONDITIONS } from '@/lib/listing-fields';
import {
  emptyFurnishingRow,
  isFurnishingRequired,
  toggleCatalogFurnishing,
  type FurnishingAssetRow,
} from '@/lib/listing-form';
import type { ListingCatalog } from '@/services/listingCreateApi';

import {
  Chip,
  ErrorText,
  FieldLabel,
  IntegerField,
  RemoveButton,
  SelectField,
  TextField,
  type SectionProps,
} from './ui';

export default function FurnishingAssets({
  state,
  update,
  errors,
  options,
}: SectionProps & { options: ListingCatalog['furnishings'] }) {
  const rows = state.furnishingAssets;
  const setRows = (change: (rows: FurnishingAssetRow[]) => FurnishingAssetRow[]) =>
    update((s) => ({ ...s, furnishingAssets: change(s.furnishingAssets) }));
  const setRow = (index: number, patch: Partial<FurnishingAssetRow>) =>
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <Anchor id="furnishingAssets" className="gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <FieldLabel
            text={`Nội thất & trang thiết bị bàn giao${isFurnishingRequired(state) ? ' *' : ''}`}
          />
        </View>
        <Text className="text-xs text-muted-foreground">{rows.length} tài sản</Text>
      </View>
      {options.length ? (
        <View className="flex-row flex-wrap gap-2">
          {options.map((item) => (
            <Chip
              key={item.code}
              label={item.name}
              selected={rows.some((row) => row.itemCode === item.code)}
              onPress={() => setRows((list) => toggleCatalogFurnishing(list, item))}
            />
          ))}
        </View>
      ) : null}
      {rows.map((row, index) => (
        <View
          key={`${row.itemCode ?? 'custom'}-${index}`}
          className="gap-3 rounded-xl border border-border bg-background p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-foreground">Tài sản {index + 1}</Text>
            <RemoveButton
              label={`Xóa tài sản dòng ${index + 1}`}
              onPress={() => setRows((list) => list.filter((_, i) => i !== index))}
            />
          </View>
          <Anchor id={`furnishingAssets.${index}.assetName`}>
            <TextField
              label="Tên tài sản / Trang thiết bị *"
              value={row.assetName}
              onChangeText={(assetName) => setRow(index, { assetName })}
              placeholder="Ví dụ: Máy lạnh Daikin Inverter 1.5 HP"
              error={errors[`furnishingAssets.${index}.assetName`]}
            />
          </Anchor>
          <Anchor id={`furnishingAssets.${index}.quantity`}>
            <IntegerField
              label="Số lượng *"
              value={row.quantity}
              onValueChange={(quantity) => setRow(index, { quantity })}
              error={errors[`furnishingAssets.${index}.quantity`]}
            />
          </Anchor>
          <SelectField
            label="Hiện trạng bàn giao *"
            value={row.handoverCondition}
            options={HANDOVER_CONDITIONS}
            onChange={(handoverCondition) => setRow(index, { handoverCondition })}
          />
          <TextField
            label="Ghi chú"
            value={row.conditionNote ?? ''}
            onChangeText={(conditionNote) => setRow(index, { conditionNote })}
            placeholder="Ví dụ: làm lạnh nhanh, còn bảo hành"
          />
        </View>
      ))}
      <ActionButton
        label="Thêm tài sản khác"
        icon="add"
        variant="secondary"
        onClick={() => setRows((list) => [...list, emptyFurnishingRow()])}
      />
      <ErrorText message={errors.furnishingAssets} />
      <PolicyNotice
        title="Biên bản bàn giao"
        summary="Danh mục dùng làm biên bản bàn giao."
        text="Danh mục này được dùng làm biên bản bàn giao trong hợp đồng thuê."
      />
    </Anchor>
  );
}
