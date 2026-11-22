import type {
  BookingRecordBaseDto,
  PublicAcademicPeriodDto,
  SessionListItemDto,
} from "../../../types/api";
import { formatWitaTime } from "../../../lib/witaTime";

export function getCounselorInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  if (!cleaned) return "KL";
  return cleaned
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatBookingClientTitle(
  booking?: BookingRecordBaseDto | null,
  fallbackClientId?: string | null,
): string {
  if (booking?.service_type === "group") {
    return booking.group_name?.trim()
      ? `Kelompok ${booking.group_name.trim()}`
      : "Konseling Kelompok";
  }
  const clientId = booking?.client_id ?? fallbackClientId ?? "";
  if (clientId) {
    return `Klien Individu · #${clientId.slice(0, 8).toUpperCase()}`;
  }
  return "Klien Individu";
}

export function formatBookingRepresentative(
  booking?: BookingRecordBaseDto | null,
): string | null {
  if (!booking || booking.service_type !== "group") return null;
  const participants = booking.booking_participants ?? [];
  const rep =
    participants.find((p) => p.is_representative) ?? participants[0] ?? null;
  return rep ? rep.display_name : null;
}

export function formatIsoDateId(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatIsoShortDateId(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatIsoTimeRangeWita(
  startsAt: string,
  endsAt: string,
): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "—";
  }
  const fmt = (d: Date) =>
    formatWitaTime(d);
  return `${fmt(start)} – ${fmt(end)} WITA`;
}

export function toLocalDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatSessionFormatLabel(
  format?: SessionListItemDto["format"] | null,
): "Tatap Muka" {
  void format;
  return "Tatap Muka";
}

export function formatAcademicPeriodLabel(
  period: PublicAcademicPeriodDto,
): string {
  return `TA ${period.academic_year} · ${period.semester}`;
}
