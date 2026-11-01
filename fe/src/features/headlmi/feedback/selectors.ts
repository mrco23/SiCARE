import type { AdminFeedbackDto, FeedbackReviewStatusApi } from "../../../types/api";

export type FeedbackRatingFilter = "Semua" | "Positif" | "Netral" | "Negatif";
export type FeedbackReviewFilter = "Semua" | FeedbackReviewStatusApi;

export function selectHeadLmiFeedback(
  records: readonly AdminFeedbackDto[],
  counselorNameMap: Map<string, string>,
  filters: { rating: FeedbackRatingFilter; review: FeedbackReviewFilter; search: string },
): AdminFeedbackDto[] {
  const query = filters.search.trim().toLowerCase();
  return records.filter((feedback) => {
    const matchesRating =
      filters.rating === "Semua" ||
      (filters.rating === "Positif" && feedback.rating >= 4) ||
      (filters.rating === "Netral" && feedback.rating === 3) ||
      (filters.rating === "Negatif" && feedback.rating <= 2);
    const matchesReview = filters.review === "Semua" || feedback.review_status === filters.review;
    const counselorName = counselorNameMap.get(feedback.counselor_id) ?? "";
    const matchesSearch =
      !query ||
      feedback.id.toLowerCase().includes(query) ||
      counselorName.toLowerCase().includes(query) ||
      (feedback.comment && feedback.comment.toLowerCase().includes(query));
    return matchesRating && matchesReview && matchesSearch;
  });
}

export function summarizeHeadLmiFeedback(records: readonly AdminFeedbackDto[]) {
  const total = records.length;
  const ratingSum = records.reduce((sum, feedback) => sum + feedback.rating, 0);
  return {
    total,
    averageRating: total ? ratingSum / total : 0,
    positive: records.filter((feedback) => feedback.rating >= 4).length,
    neutral: records.filter((feedback) => feedback.rating === 3).length,
    negative: records.filter((feedback) => feedback.rating <= 2).length,
    pendingReview: records.filter((feedback) => feedback.review_status !== "resolved").length,
    distribution: [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: records.filter((feedback) => feedback.rating === rating).length,
    })),
  };
}

export function groupHeadLmiFeedbackByMonth(records: readonly AdminFeedbackDto[]) {
  const grouped = new Map<string, { total: number; ratingSum: number }>();
  for (const feedback of records) {
    const key = feedback.created_at.slice(0, 7);
    const current = grouped.get(key) ?? { total: 0, ratingSum: 0 };
    current.total += 1;
    current.ratingSum += feedback.rating;
    grouped.set(key, current);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      total: value.total,
      average: value.total ? value.ratingSum / value.total : 0,
    }));
}

export function summarizeFeedbackByCounselor(
  records: readonly AdminFeedbackDto[],
  counselorNameMap: Map<string, string>,
) {
  const grouped = new Map<
    string,
    { counselorId: string; count: number; ratingSum: number; positive: number; negative: number }
  >();
  for (const feedback of records) {
    const id = feedback.counselor_id;
    const current = grouped.get(id) ?? { counselorId: id, count: 0, ratingSum: 0, positive: 0, negative: 0 };
    current.count += 1;
    current.ratingSum += feedback.rating;
    if (feedback.rating >= 4) current.positive += 1;
    if (feedback.rating <= 2) current.negative += 1;
    grouped.set(id, current);
  }
  return [...grouped.values()]
    .map((item) => ({
      counselorId: item.counselorId,
      counselor:
        counselorNameMap.get(item.counselorId) ??
        `Konselor #${item.counselorId.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
      count: item.count,
      average: item.count ? item.ratingSum / item.count : 0,
      positive: item.positive,
      negative: item.negative,
    }))
    .sort((a, b) => b.count - a.count);
}
