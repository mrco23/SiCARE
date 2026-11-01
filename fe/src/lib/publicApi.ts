import { apiRequest } from "./api";
import { buildQueryString } from "./apiQuery";
import type {
  PublicAcademicPeriodDto,
  PublicAvailabilitySlotDto,
  PublicCounselorDto,
  PublicFeedbackDto,
  PublicHeroMotivationDto,
} from "../types/api";

// Backward-compatible exports for existing pages. The canonical definitions live in types/api.ts.
export type PublicCounselor = PublicCounselorDto;
export type PublicAcademicPeriod = PublicAcademicPeriodDto;
export type PublicAvailabilitySlot = PublicAvailabilitySlotDto;
export type PublicFeedback = PublicFeedbackDto;
export type PublicHeroMotivation = PublicHeroMotivationDto;

export function getPublicCounselors(signal?: AbortSignal): Promise<PublicCounselorDto[]> {
  return apiRequest<PublicCounselorDto[]>("/public/counselors", { signal });
}

export function getPublicAcademicPeriods(signal?: AbortSignal): Promise<PublicAcademicPeriodDto[]> {
  return apiRequest<PublicAcademicPeriodDto[]>("/public/periods", { signal });
}

export function getPublicAvailability(options: {
  counselorId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  signal?: AbortSignal;
} = {}): Promise<PublicAvailabilitySlotDto[]> {
  const now = new Date();
  const from = options.from ?? now;
  const to = options.to ?? new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);
  const query = buildQueryString({
    from: from.toISOString(),
    to: to.toISOString(),
    limit: options.limit ?? 100,
    counselor_id: options.counselorId,
  });
  return apiRequest<PublicAvailabilitySlotDto[]>(`/public/availability${query}`, {
    signal: options.signal,
  });
}

export function getPublicFeedback(limit = 20, signal?: AbortSignal): Promise<PublicFeedbackDto[]> {
  return apiRequest<PublicFeedbackDto[]>(`/public/feedback${buildQueryString({ limit })}`, { signal });
}

export function getPublicHeroMotivations(signal?: AbortSignal): Promise<PublicHeroMotivationDto[]> {
  return apiRequest<PublicHeroMotivationDto[]>("/public/hero-motivations", { signal });
}

/** Only absolute URLs and app-root paths are safe to render as image sources. */
export function getPublicPhotoUrl(photoPath: string | null | undefined): string | null {
  if (!photoPath) return null;
  const value = photoPath.trim();
  if (value.startsWith("/") || value.startsWith("data:image/")) return value;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}
