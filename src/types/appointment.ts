// Port of hs-web-app types/appointment.type.ts. Dates are "yyyy-MM-dd", times "HH:mm" or "HH:mm:ss".
export type AppointmentStatus =
  'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED';

export type ViewingSlot = 'MORNING' | 'AFTERNOON' | 'EVENING';

export type AppointmentCancelledBy = 'RENTER' | 'OWNER' | 'SYSTEM';

export type AppointmentViewRole = 'OWNER' | 'RENTER';

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
  slotType: ViewingSlot;
  status: 'AVAILABLE' | 'LOCKED' | 'PENDING_YOU' | 'CONFIRMED_YOU' | 'UNAVAILABLE';
  bookingCount?: number;
}

export interface ListingAvailabilityResponse {
  listingId: string;
  date: string;
  dayOfWeek: string;
  isDayAvailable: boolean;
  allowedViewingDays: string[];
  allowedViewingSlots: ViewingSlot[];
  slots: AvailabilitySlot[];
  hasExistingActiveBooking: boolean;
  existingBookingId: string | null;
}

export interface AppointmentResponse {
  id: string;
  listingId: string;
  listingTitle: string;
  listingAddress: string;
  listingThumbnail: string | null;
  listingPrice: number | null;
  ownerId: string;
  renterId: string;
  renterName: string;
  renterPhone: string;
  renterEmail: string | null;
  visitorCount: number;
  renterNote: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  slotType: ViewingSlot;
  status: AppointmentStatus;
  ownerNote: string | null;
  rejectReason: string | null;
  cancelledBy: AppointmentCancelledBy | null;
  cancelReason: string | null;
  rescheduleRequested: boolean;
  proposedDate: string | null;
  proposedStartTime: string | null;
  proposedEndTime: string | null;
  proposedSlotType: ViewingSlot | null;
  rescheduleReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentRequest {
  listingId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  renterName: string;
  renterPhone: string;
  visitorCount?: number;
  renterNote?: string;
}

export interface RescheduleAppointmentRequest {
  proposedDate: string;
  proposedStartTime: string;
  proposedEndTime: string;
  rescheduleReason?: string;
}
