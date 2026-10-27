import {
  BOOKING_STATUS,
  COUNSELING_REQUEST_STATUS,
} from "../../../constants/status";
import type { BookingRecord } from "../../../types/booking";
import type { CounselingRequest } from "../../../data/mock/counselorRequests";

export function selectPendingCounselorBookings(
  bookings: readonly BookingRecord[],
  counselorId: string,
): BookingRecord[] {
  return bookings.filter(
    (booking) =>
      booking.counselorId === counselorId &&
      booking.status === BOOKING_STATUS.WAITING_CONFIRMATION,
  );
}

export function selectPendingCounselorRequests(
  requests: readonly CounselingRequest[],
  options: { formatFilter: string; sortMode: string; search: string },
): CounselingRequest[] {
  const query = options.search.trim().toLowerCase();
  return requests
    .filter((request) => request.status === COUNSELING_REQUEST_STATUS.PENDING)
    .filter(
      (request) =>
        options.formatFilter === "Semua" ||
        request.format === options.formatFilter,
    )
    .filter((request) => !query || request.name.toLowerCase().includes(query))
    .sort((a, b) =>
      options.sortMode === "terlama"
        ? b.waitMin - a.waitMin
        : a.waitMin - b.waitMin,
    );
}

export function countPendingCounselorRequests(
  requests: readonly CounselingRequest[],
  bookings: readonly BookingRecord[],
  counselorId: string,
) {
  const pendingRequests = requests.filter(
    (request) => request.status === COUNSELING_REQUEST_STATUS.PENDING,
  );
  const pendingBookings = selectPendingCounselorBookings(bookings, counselorId);

  return {
    total: pendingRequests.length + pendingBookings.length,
    individual:
      pendingRequests.filter((request) => request.format === "Individu").length +
      pendingBookings.filter((booking) => booking.serviceType === "INDIVIDUAL")
        .length,
    group:
      pendingRequests.filter((request) => request.format === "Kelompok").length +
      pendingBookings.filter((booking) => booking.serviceType === "GROUP").length,
  };
}
