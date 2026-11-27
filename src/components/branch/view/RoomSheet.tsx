// Everything about one cell: its state on the current layer, one row per thing to open, then the
// room's links and marks (agent E, passed as children).
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import EntryList from '@/components/branch/view/EntryList';
import type { CellContent } from '@/components/branch/view/FloorBoard';
import StatusTag from '@/components/branch/StatusTag';
import ModalShell from '@/components/rental/shared/ModalShell';
import { LAYER_LABEL, type OverviewLayer, type OverviewTarget } from '@/lib/branch-overview';
import type { ViewEntry } from '@/lib/branch-view';

const NOTHING: Record<OverviewLayer, string> = {
  rooms: 'Không có trang nào cần mở cho tình trạng này.',
  payments: 'Không có khoản thu nào cần xem.',
  meters: 'Không có kỳ ghi chỉ số cần xem.',
  contracts: 'Không có hợp đồng nào đang chiếm phòng.',
};

type Props = {
  title: string;
  layer: OverviewLayer;
  cell: CellContent;
  /** null = no status for this room (loading, failed, or the layer has no data). */
  entries: ViewEntry[] | null;
  /** Set when the status on screen may be old. */
  stale: string;
  onOpen: (target: OverviewTarget) => void;
  onClose: () => void;
  children: ReactNode;
};

export default function RoomSheet({
  title,
  layer,
  cell,
  entries,
  stale,
  onOpen,
  onClose,
  children,
}: Props) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-xs font-semibold text-muted-foreground">
            Lớp {LAYER_LABEL[layer]}
          </Text>
          <StatusTag look={cell.look} label={cell.label} />
          {stale ? (
            <Text accessibilityRole="alert" className="text-sm leading-5 text-warning">
              {stale}
            </Text>
          ) : null}
        </View>
        {entries === null ? null : entries.length > 0 ? (
          <EntryList entries={entries} onOpen={onOpen} />
        ) : (
          <View className="gap-1 rounded-2xl border border-dashed border-border-strong bg-surface p-4">
            {/* A room can have a tenant or a next stay without a page to open. */}
            {cell.lines.map((line, index) => (
              <Text key={index} className="text-sm leading-6 text-foreground">
                {line}
              </Text>
            ))}
            <Text className="text-sm leading-6 text-muted-foreground">{NOTHING[layer]}</Text>
          </View>
        )}
        <View className="border-t border-border pt-4">{children}</View>
      </View>
    </ModalShell>
  );
}
