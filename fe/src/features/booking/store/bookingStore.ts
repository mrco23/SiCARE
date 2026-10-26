import { create } from "zustand";
import { BOOKING_STATUS, type BookingStatus, type CounselingRequestStatus } from "../../../constants/status";
import type { BookingRecord, CreateBookingInput } from "../../../types/booking";
export type { BookingRecord, CreateBookingInput };
import { initialRequests, type CounselingRequest } from "../../../data/mock/counselorRequests";

/** Booking records intentionally remain in memory; intake answers are never stored here. */
interface BookingStore {
  bookings: BookingRecord[];
  /** Existing request fixtures stay in their original schema until they have canonical booking IDs. */
  legacyRequests: CounselingRequest[];
  createBooking: (input: CreateBookingInput) => BookingRecord;
  updateLegacyRequest: (
    id: number,
    status: CounselingRequestStatus,
    room?: string,
  ) => void;
  updateBookingStatus: (
    id: string,
    status: BookingStatus,
    room?: string,
  ) => void;
  resetBookings: () => void;
}

export const useBookingStore = create<BookingStore>((set) => ({
  bookings: [],
  legacyRequests: initialRequests.map((request) => ({ ...request })),
  createBooking: (input) => {
    const booking: BookingRecord = {
      ...input,
      id: `booking-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: BOOKING_STATUS.WAITING_CONFIRMATION,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ bookings: [booking, ...state.bookings] }));
    return booking;
  },
  updateLegacyRequest: (id, status, room) =>
    set((state) => ({
      legacyRequests: state.legacyRequests.map((request) =>
        request.id === id
          ? { ...request, status, room: room || undefined }
          : request,
      ),
    })),
  updateBookingStatus: (id, status, room) =>
    set((state) => ({
      bookings: state.bookings.map((booking) =>
        booking.id === id
          ? {
              ...booking,
              status,
              ...(room !== undefined ? { room } : {}),
            }
          : booking,
      ),
    })),
  resetBookings: () => set({ bookings: [] }),
}));
