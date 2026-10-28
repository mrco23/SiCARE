import {
  BOOKING_STATUS,
  COUNSELING_REQUEST_STATUS,
} from "../../../constants/status";
import { DEMO_NOTIFICATION_RECIPIENTS, useNotificationStore } from "../../notification/notificationStore";
import { useBookingStore } from "../../booking/store/bookingStore";

export type CounselorRequestDecisionTarget =
  | { kind: "booking"; bookingId: string }
  | { kind: "legacy-request"; requestId: number };

export type CounselorRequestDecisionResult =
  | { ok: true; message: string }
  | { ok: false; reason: "missing-target" | "room-required" };

/** Applies a counselor's decision to the existing domain store and notifies recipients. */
export function decideCounselorRequest(
  target: CounselorRequestDecisionTarget,
  accept: boolean,
  roomInput: string,
): CounselorRequestDecisionResult {
  const room = accept ? roomInput.trim() : "";
  if (accept && !room) return { ok: false, reason: "room-required" };

  const bookingStore = useBookingStore.getState();
  if (target.kind === "booking") {
    const booking = bookingStore.bookings.find(
      (item) => item.id === target.bookingId,
    );
    if (!booking) return { ok: false, reason: "missing-target" };

    bookingStore.updateBookingStatus(
      booking.id,
      accept ? BOOKING_STATUS.CONFIRMED : BOOKING_STATUS.REJECTED,
      room || undefined,
    );

    const addNotification = useNotificationStore.getState().addNotification;
    addNotification({
      recipientId: booking.clientId,
      recipientRole: "client",
      title: accept ? "Booking dikonfirmasi" : "Booking ditolak",
      message: accept
        ? `Booking dengan ${booking.counselorName} telah dikonfirmasi. Ruangan: ${room}.`
        : `Permintaan booking dengan ${booking.counselorName} belum dapat diterima.`,
      href: "/klien/aktivitas",
    });
    addNotification({
      recipientId: DEMO_NOTIFICATION_RECIPIENTS.admin,
      recipientRole: "admin",
      title: accept ? "Booking dikonfirmasi" : "Booking ditolak",
      message: `${booking.clientName}: booking dengan ${booking.counselorName} ${accept ? "dikonfirmasi" : "ditolak"}.`,
      href: "/admin",
    });

    return {
      ok: true,
      message: accept
        ? `Booking diterima. Ruangan ditetapkan: ${room}.`
        : "Booking ditolak.",
    };
  }

  const request = bookingStore.legacyRequests.find(
    (item) => item.id === target.requestId,
  );
  if (!request) return { ok: false, reason: "missing-target" };

  bookingStore.updateLegacyRequest(
    request.id,
    accept
      ? COUNSELING_REQUEST_STATUS.ACCEPTED
      : COUNSELING_REQUEST_STATUS.REJECTED,
    room,
  );

  return {
    ok: true,
    message: accept
      ? `Permintaan diterima. Ruangan ditetapkan: ${room}.`
      : "Permintaan ditolak.",
  };
}
