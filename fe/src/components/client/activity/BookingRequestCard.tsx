import { CalendarCheck, Clock3, UserRound } from "lucide-react";
import {
  CLIENT_BOOKING_STATUS,
  type ClientBookingStatus,
} from "../../../constants/status";
import { formatIndonesianDate, parseLocalISODate } from "../../../lib/dateUtils";
import type { ClientBookingSummary } from "../../../features/booking/selectors/clientBookingSelectors";

const STATUS_STYLE: Record<
  ClientBookingStatus,
  { label: string; className: string }
> = {
  [CLIENT_BOOKING_STATUS.PENDING]: {
    label: "Menunggu konfirmasi",
    className: "bg-amber-50 text-amber-700",
  },
  [CLIENT_BOOKING_STATUS.SCHEDULED]: {
    label: "Terjadwal",
    className: "bg-primary-soft text-primary",
  },
  [CLIENT_BOOKING_STATUS.REJECTED]: {
    label: "Ditolak",
    className: "bg-red-50 text-red-700",
  },
  [CLIENT_BOOKING_STATUS.CANCELLED]: {
    label: "Dibatalkan",
    className: "bg-red-50 text-red-700",
  },
  [CLIENT_BOOKING_STATUS.COMPLETED]: {
    label: "Selesai",
    className: "bg-gray-100 text-gray-700",
  },
};

export function BookingRequestCard({
  booking,
}: {
  booking: ClientBookingSummary;
}) {
  const status = STATUS_STYLE[booking.clientStatus];
  const dateLabel = formatIndonesianDate(parseLocalISODate(booking.date), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <CalendarCheck className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{booking.serviceLabel}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-600">
            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{booking.counselorName}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
            <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {dateLabel} · {booking.startTime} WITA
          </p>
        </div>
      </div>
      <span
        className={`inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold ${status.className}`}
      >
        {status.label}
      </span>
    </article>
  );
}
