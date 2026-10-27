import type { Role, Review } from "../../../data/mock/publicFeedback";

export type PublicReviewSortMode = "terbaru" | "tertinggi" | "terendah";

/** Only records supplied by the approved public-review selector/store are accepted here. */
export function selectPublicReviews(
  reviews: readonly Review[],
  role: Role | "semua",
  sortMode: PublicReviewSortMode,
): Review[] {
  const selected = reviews.filter((review) => role === "semua" || review.role === role);
  return [...selected].sort((a, b) => {
    if (sortMode === "tertinggi") return b.rating - a.rating || a.days - b.days;
    if (sortMode === "terendah") return a.rating - b.rating || a.days - b.days;
    return a.days - b.days;
  });
}
