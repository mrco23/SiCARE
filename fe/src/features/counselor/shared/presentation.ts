import type {
  BookingRecordBaseDto,
  PublicAcademicPeriodDto,
  SessionListItemDto,
} from "../../../types/api";

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

export function formatCounselorTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}.${String(minutes % 60).padStart(2, "0")}`;
}

export function getCurrentLocalMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
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
    `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  return `${fmt(start)} – ${fmt(end)} WITA`;
}

export function toLocalDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getMinutesFromIso(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

export function formatSessionFormatLabel(
  format?: SessionListItemDto["format"] | null,
): "Tatap Muka" | "Online" {
  return format === "online" ? "Online" : "Tatap Muka";
}

export function formatAcademicPeriodLabel(
  period: PublicAcademicPeriodDto,
): string {
  return `TA ${period.academic_year} · ${period.semester}`;
}
