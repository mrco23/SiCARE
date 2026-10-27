import { FEEDBACK_MODERATION_STATUS, type FeedbackModerationStatus } from "../../../constants/status";
import type { AcademicPeriod } from "../../../lib/academicPeriods";
import { isInPeriod, toISO } from "../../../lib/academicPeriods";

export type FeedbackSortKey = "new" | "high" | "low";
export type FeedbackStatusFilter = "all" | FeedbackModerationStatus;

export interface ModerationFeedbackLike {
  rating: number;
  text: string;
  date: string;
  status: FeedbackModerationStatus;
}

/** Pure period selector shared by Admin feedback counts, tabs, and rows. */
export function selectFeedbackInPeriod<T extends { date: string }>(
  items: readonly T[],
  period: AcademicPeriod | null,
): T[] {
  return items.filter((item) => !period || isInPeriod(toISO(new Date(item.date)), period));
}

export function countModerationStatuses(items: readonly Pick<ModerationFeedbackLike, "status">[]) {
  return {
    total: items.length,
    pending: items.filter((item) => item.status === FEEDBACK_MODERATION_STATUS.PENDING).length,
    shown: items.filter((item) => item.status === FEEDBACK_MODERATION_STATUS.SHOWN).length,
    disabled: items.filter((item) => item.status === FEEDBACK_MODERATION_STATUS.DISABLED).length,
  };
}

export function selectModerationRows<T extends ModerationFeedbackLike>(
  items: readonly T[],
  filters: { status: FeedbackStatusFilter; rating: number; query: string; sort: FeedbackSortKey },
): T[] {
  const query = filters.query.trim().toLowerCase();
  const byDate = (a: T, b: T) => new Date(b.date).getTime() - new Date(a.date).getTime();

  return items
    .filter((item) =>
      (filters.status === "all" || item.status === filters.status) &&
      (!filters.rating || item.rating === filters.rating) &&
      (!query || item.text.toLowerCase().includes(query)),
    )
    .sort((a, b) =>
      filters.sort === "high"
        ? b.rating - a.rating || byDate(a, b)
        : filters.sort === "low"
          ? a.rating - b.rating || byDate(a, b)
          : byDate(a, b),
    );
}
