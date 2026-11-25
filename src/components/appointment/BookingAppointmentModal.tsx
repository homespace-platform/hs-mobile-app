// Mobile port of hs-web-app components/appointment/BookingAppointmentModal.tsx.
// Behaviour: docs/appointment-parity.md, section A.
import { useEffect, useRef, useState } from 'react';
import { Modal } from 'react-native';

import { DialogProvider, useDialog } from '@/components/AppDialog';
import { createBookingFlow } from '@/components/appointment/booking/booking-flow';
import BookingSheet, { type SheetDialog } from '@/components/appointment/booking/BookingSheet';
import * as appointmentApi from '@/services/appointmentApi';
import { getUserProfileApi } from '@/services/userApi';

export interface BookingAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  listingAddress?: string;
  /** Monthly rent in VND. */
  listingPrice?: number;
  listingThumbnail?: string | null;
  ownerId?: string;
  /**
   * Mobile only, in place of web router.push('/dashboard/viewing-schedules/my-bookings'). Called
   * right after onClose() on booking/reschedule success and on "Xem tất cả lịch hẹn của bạn".
   * Omit it when the caller already is that screen.
   */
  onViewMyBookings?: () => void;
}

// shortcut: fixed wait for the sheet to be dismissed before the app dialog is presented (iOS drops a
// Modal presented during a dismissal); switch to Modal onDismiss if a device shows it is too short.
const DISMISS_MS = 500;

// Web has no reschedule or success props: the modal loads the renter's active booking by listingId
// and switches into reschedule mode itself.
export default function BookingAppointmentModal(props: BookingAppointmentModalProps) {
  // The key resets every piece of state for another listing.
  return <ListingBooking key={props.listingId} {...props} />;
}

function ListingBooking(props: BookingAppointmentModalProps) {
  const { isOpen, listingId } = props;
  const showAppDialog = useDialog();
  const [flow] = useState(() =>
    createBookingFlow(listingId, { api: appointmentApi, getProfile: () => getUserProfileApi() })
  );
  // The dialog host inside the sheet; null while the sheet is not on screen.
  const sheetDialog: SheetDialog = useRef(null);
  const latestProps = useRef(props);
  latestProps.current = props;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !listingId) return;
    flow.open();
    return () => flow.close();
  }, [flow, isOpen, listingId]);

  const showError = (message: string) =>
    (sheetDialog.current ?? showAppDialog)('Thông báo', message);

  function leaveToMyBookings() {
    latestProps.current.onClose();
    if (mounted.current) latestProps.current.onViewMyBookings?.();
  }

  async function submit() {
    const result = await flow.submit();
    if (!result) return;
    if (!result.ok) return showError(result.message);
    leaveToMyBookings();
    setTimeout(() => showAppDialog('Thông báo', result.message, undefined, 'success'), DISMISS_MS);
  }

  async function cancel() {
    const result = await flow.cancel();
    if (!result) return;
    if (!result.ok) return showError(result.message);
    (sheetDialog.current ?? showAppDialog)('Thông báo', result.message, undefined, 'success');
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={props.onClose}>
      {/* A dialog host inside this Modal: iOS cannot show the app-level one on top of it. */}
      <DialogProvider>
        <BookingSheet
          {...props}
          flow={flow}
          dialogRef={sheetDialog}
          onSubmit={() => void submit()}
          onCancelBooking={() => void cancel()}
          onViewAll={leaveToMyBookings}
        />
      </DialogProvider>
    </Modal>
  );
}
