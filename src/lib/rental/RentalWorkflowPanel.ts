// Port of the helpers in hs-web-app components/rental-request/RentalWorkflowPanel.tsx:19-26.
// workflowTitles/Statuses/Actions/Obligations live in @/types/rental/rental-workflow.type.
import { numberVi, vnDateTime } from '@/lib/rental/format';
import type { RentalWorkflow } from '@/types/rental/rental-workflow.type';

export const date = (s?: string) => (s ? vnDateTime(s) : '—');
export const money = (n?: number | null) => (n == null ? 'Chưa ghi nhận' : numberVi(n) + ' đ');
export const calendarDate = (value: string) => value.split('-').reverse().join('/');
export const dateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
export const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};
export const keyOf = (w: Pick<RentalWorkflow, 'revision' | 'status'>) =>
  `${w.revision}:${w.status}`;
