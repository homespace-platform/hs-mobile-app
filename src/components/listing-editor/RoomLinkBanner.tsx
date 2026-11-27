// Web components/RoomLinkBanner.tsx: which room the new listing will be linked to, or why it cannot
// be yet. The web's "open the branch in a new tab" has no phone counterpart (it would drop the form).
import ActionButton from '@/components/rental/shared/ActionButton';
import type { ListingRoom } from '@/lib/listing-room-link';

import { Notice, SelectField } from './ui';

export default function RoomLinkBanner({
  roomId,
  rooms,
  branchApplied,
  onPickRoom,
  onRetry,
  onRemove,
}: {
  roomId: string;
  /** null = still loading. */
  rooms: ListingRoom[] | 'error' | null;
  /** False when the editor could not apply the branch of this room. */
  branchApplied: boolean;
  onPickRoom: (roomId: string) => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const list = Array.isArray(rooms) ? rooms : [];
  const room = list.find((item) => item.id === roomId);

  if (rooms === null || (room && branchApplied))
    return (
      <Notice
        text={
          room
            ? `Tin mới sẽ được gắn vào phòng ${room.label}.`
            : 'Đang tải thông tin phòng sẽ gắn với tin mới...'
        }
      />
    );

  const problem =
    rooms === 'error'
      ? 'Không tải được sơ đồ chi nhánh nên chưa kiểm tra được phòng cần gắn.'
      : !room
        ? 'Phòng đã chọn không còn trong sơ đồ. Vui lòng chọn lại phòng trước khi tạo tin.'
        : 'Chưa áp dụng được chi nhánh của phòng. Vui lòng chọn lại chi nhánh trong mục Thông tin cơ bản trước khi tạo tin.';

  return (
    <Notice tone="warning" text={problem}>
      <>
        {!room && list.length > 0 ? (
          <SelectField
            tall
            ariaLabel="Chọn lại phòng"
            placeholder="Chọn lại phòng"
            value=""
            options={list.map((item) => ({ value: item.id, label: item.label }))}
            onChange={onPickRoom}
          />
        ) : null}
        {rooms === 'error' ? (
          <ActionButton
            label="Thử lại"
            variant="secondary"
            className="min-h-[48px]"
            onClick={onRetry}
          />
        ) : null}
        <ActionButton
          label="Đăng tin không gắn phòng"
          variant="secondary"
          className="min-h-[48px]"
          onClick={onRemove}
        />
      </>
    </Notice>
  );
}
