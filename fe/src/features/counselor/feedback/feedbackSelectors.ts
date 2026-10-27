export interface CounselorFeedbackEntry {
  id: number;
  konselorId: string;
  rating: number;
  text: string;
  date: string;
}

export type CounselorFeedbackSort = "new" | "high" | "low";

export interface FeedbackDateRange {
  start: Date;
  end: Date;
}

export function startOfFeedbackDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseFeedbackDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatFeedbackShortDate(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export function anonymousFeedbackName(id: number): string {
  return `Klien Anonim #${((id * 2654435761) >>> 0).toString(16).slice(-4).toUpperCase()}`;
}

export function selectCounselorFeedbackForPeriod<T extends CounselorFeedbackEntry>(
  feedback: readonly T[],
  range: FeedbackDateRange,
): T[] {
  return feedback.filter((entry) => {
    const date = new Date(entry.date);
    return date >= range.start && date < range.end;
  });
}

export function selectVisibleCounselorFeedback<T extends CounselorFeedbackEntry>(
  feedback: readonly T[],
  options: {
    search: string;
    starFilter: number;
    sort: CounselorFeedbackSort;
  },
): T[] {
  const normalizedSearch = options.search.trim().toLocaleLowerCase("id-ID");
  const rows = feedback.filter(
    (entry) =>
      (!options.starFilter || entry.rating === options.starFilter) &&
      entry.text.toLocaleLowerCase("id-ID").includes(normalizedSearch),
  );

  rows.sort((a, b) => {
    if (options.sort === "high") {
      return (
        b.rating - a.rating ||
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }
    if (options.sort === "low") {
      return (
        a.rating - b.rating ||
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  return rows;
}

export function averageCounselorFeedbackRating(
  feedback: readonly CounselorFeedbackEntry[],
): number {
  return feedback.length
    ? feedback.reduce((sum, entry) => sum + entry.rating, 0) / feedback.length
    : 0;
}
