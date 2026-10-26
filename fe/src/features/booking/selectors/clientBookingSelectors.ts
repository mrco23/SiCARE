import {
  BOOKING_STATUS,
  CLIENT_BOOKING_STATUS,
  type BookingStatus,
  type ClientBookingStatus,
} from "../../../constants/status";
import { CLIENT_COUNSELOR_IDENTITIES, type ClientCounselorKey } from "../../../data/mock/clientCounselors";
import type { BookingRecord } from "../../../types/booking";

/**
 * Read-only projection for client-facing screens. The underlying booking record
 * remains the canonical runtime record shared with counselor/admin screens.
 */
export interface ClientBookingSummary extends BookingRecord {
  clientStatus: ClientBookingStatus;
  counselorKey: ClientCounselorKey | null;
  serviceLabel: string;
}

const COUNSELOR_KEY_BY_ID = new Map<string, ClientCounselorKey>(
  Object.values(CLIENT_COUNSELOR_IDENTITIES).map(
    ({ entityId, key }) => [entityId, key] as const,
  ),
);

export function toClientBookingStatus(status: BookingStatus): ClientBookingStatus {
  switch (status) {
    case BOOKING_STATUS.CONFIRMED:
      return CLIENT_BOOKING_STATUS.SCHEDULED;
    case BOOKING_STATUS.REJECTED:
      return CLIENT_BOOKING_STATUS.REJECTED;
    case BOOKING_STATUS.CANCELLED:
      return CLIENT_BOOKING_STATUS.CANCELLED;
    case BOOKING_STATUS.COMPLETED:
      return CLIENT_BOOKING_STATUS.COMPLETED;
    case BOOKING_STATUS.RESCHEDULE_REQUESTED:
    case BOOKING_STATUS.WAITING_CONFIRMATION:
    default:
      return CLIENT_BOOKING_STATUS.PENDING;
  }
}

export function selectClientBookings(
  bookings: readonly BookingRecord[],
  clientId: string,
): ClientBookingSummary[] {
  return bookings
    .filter((booking) => booking.clientId === clientId)
    .map((booking) => ({
      ...booking,
      clientStatus: toClientBookingStatus(booking.status),
      counselorKey: COUNSELOR_KEY_BY_ID.get(booking.counselorId) ?? null,
      serviceLabel:
        booking.serviceType === "GROUP"
          ? "Konseling Kelompok"
          : "Konseling Individu",
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function selectLatestClientBooking(
  bookings: readonly BookingRecord[],
  clientId: string,
): ClientBookingSummary | null {
  return selectClientBookings(bookings, clientId)[0] ?? null;
}
