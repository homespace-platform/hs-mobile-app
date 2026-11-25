// Phase 2 owner D. Web: components/complaint/ComplaintPanel.tsx. Keep the props; replace the body.
import { BlockPlaceholder } from '@/screens/rental/placeholders';

export type ComplaintPanelProps = {
  rentalRequestId: string;
  initialComplaintId?: string;
  attention?: boolean;
  onUpdated?: () => Promise<unknown> | void;
};

export default function ComplaintPanel(_props: ComplaintPanelProps) {
  return <BlockPlaceholder title="Khiếu nại & hỗ trợ từ HomeSpace" />;
}
