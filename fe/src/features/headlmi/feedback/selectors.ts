import { FEEDBACK_REVIEW_STATUS } from "../../../constants/status";
import type { Feedback } from "../../../data/mock/headlmiFeedback";
import type { AcademicPeriod } from "../../../lib/academicPeriods";
import { isInPeriod, toISO } from "../../../lib/academicPeriods";

export type FeedbackRatingFilter = "Semua" | "Positif" | "Netral" | "Negatif";
export type FeedbackCategoryFilter = "Semua" | "Individu" | "Kelompok";

export function selectHeadLmiFeedbackInPeriod(
  records: readonly Feedback[],
  period: AcademicPeriod | null,
): Feedback[] {
  return records.filter((feedback) =>
    !period || isInPeriod(toISO(new Date(`${feedback.date}T00:00:00`)), period),
  );
}

export function selectHeadLmiFeedback(
  records: readonly Feedback[],
  filters: { rating: FeedbackRatingFilter; category: FeedbackCategoryFilter; search: string },
): Feedback[] {
  const query = filters.search.trim().toLowerCase();
  return records.filter((feedback) => {
    const matchesRating =
      filters.rating === "Semua" ||
      (filters.rating === "Positif" && feedback.rating >= 4) ||
      (filters.rating === "Netral" && feedback.rating === 3) ||
      (filters.rating === "Negatif" && feedback.rating <= 2);
    const matchesCategory = filters.category === "Semua" || feedback.category === filters.category;
    const matchesSearch = !query ||
      feedback.id.toLowerCase().includes(query) ||
      feedback.counselor.toLowerCase().includes(query) ||
      feedback.comment.toLowerCase().includes(query);
    return matchesRating && matchesCategory && matchesSearch;
  });
}

export function summarizeHeadLmiFeedback(records: readonly Feedback[]) {
  const total = records.length;
  const ratingSum = records.reduce((sum, feedback) => sum + feedback.rating, 0);
  return {
    total,
    averageRating: total ? ratingSum / total : 0,
    positive: records.filter((feedback) => feedback.rating >= 4).length,
    neutral: records.filter((feedback) => feedback.rating === 3).length,
    negative: records.filter((feedback) => feedback.rating <= 2).length,
    pendingReview: records.filter((feedback) => feedback.status !== FEEDBACK_REVIEW_STATUS.COMPLETED).length,
    distribution: [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: records.filter((feedback) => feedback.rating === rating).length,
    })),
  };
}

export function groupHeadLmiFeedbackByMonth(records: readonly Feedback[]) {
  const grouped = new Map<string, { total: number; ratingSum: number }>();
  for (const feedback of records) {
    const key = feedback.date.slice(0, 7);
    const current = grouped.get(key) ?? { total: 0, ratingSum: 0 };
    current.total += 1;
    current.ratingSum += feedback.rating;
    grouped.set(key, current);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
    key, total: value.total, average: value.total ? value.ratingSum / value.total : 0,
  }));
}

export function summarizeFeedbackByCounselor(records: readonly Feedback[], counselors: readonly string[]) {
  return counselors.map((counselor) => {
    const matching = records.filter((feedback) => feedback.counselor === counselor);
    const count = matching.length;
    return {
      counselor,
      count,
      average: count ? matching.reduce((sum, feedback) => sum + feedback.rating, 0) / count : 0,
      positive: matching.filter((feedback) => feedback.rating >= 4).length,
      negative: matching.filter((feedback) => feedback.rating <= 2).length,
    };
  }).filter((item) => item.count > 0);
}
