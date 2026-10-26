import { create } from "zustand";
import {
  FEEDBACK_MODERATION_STATUS,
  type FeedbackModerationStatus,
} from "../../../constants/status";
import {
  DATA as initialModerationFeedback,
  type Feedback as ModerationFeedback,
} from "../../../data/mock/adminFeedback";
import {
  reviews as initialPublicReviews,
  type Format,
  type Review,
} from "../../../data/mock/publicFeedback";

export interface ManagedFeedback extends ModerationFeedback {
  /** Demo-only owner/counselor references; no intake or session notes are stored here. */
  clientId?: string;
  /** Local client-activity fixture ID; not a canonical session ID shared across roles. */
  clientActivitySessionId?: number;
  counselorId?: string;
  publicReview?: Review;
}

export interface SubmitClientFeedbackInput {
  clientId: string;
  /** Optional local activity fixture reference used to prevent duplicate ratings. */
  clientActivitySessionId?: number;
  counselorId: string;
  counselorName: string;
  rating: number;
  text: string;
  format: Format;
}

interface FeedbackStore {
  items: ManagedFeedback[];
  publicReviews: Review[];
  addClientFeedback: (input: SubmitClientFeedbackInput) => ManagedFeedback;
  setModerationStatus: (
    id: number,
    status: FeedbackModerationStatus,
    reason?: string,
  ) => void;
}

const initialItems: ManagedFeedback[] = initialModerationFeedback.map((item) => ({
  ...item,
}));

export const useFeedbackStore = create<FeedbackStore>((set, get) => ({
  items: initialItems,
  // Existing anonymous public reviews remain their own approved seed records.
  // They are not linked to admin fixtures without a stable shared ID.
  publicReviews: initialPublicReviews.map((review) => ({ ...review })),

  addClientFeedback: (input) => {
    if (input.clientActivitySessionId !== undefined) {
      const existing = get().items.find(
        (item) =>
          item.clientId === input.clientId &&
          item.clientActivitySessionId === input.clientActivitySessionId,
      );
      if (existing) return existing;
    }

    const trimmedText = input.text.trim();
    const now = new Date();
    const id = Math.max(
      Date.now(),
      ...get().items.map((item) => item.id + 1),
    );
    const publicReview: Review | undefined = trimmedText
      ? {
          id,
          rating: input.rating,
          days: 0,
          role: "Klien",
          name: `Klien Anonim #${String(id).slice(-4)}`,
          topic: "Sesi konseling",
          format: input.format,
          text: trimmedText,
        }
      : undefined;

    const item: ManagedFeedback = {
      id,
      rating: input.rating,
      text: trimmedText || "Penilaian tanpa komentar tertulis.",
      psikolog: input.counselorName,
      date: now.toISOString(),
      status: FEEDBACK_MODERATION_STATUS.PENDING,
      clientId: input.clientId,
      ...(input.clientActivitySessionId !== undefined
        ? { clientActivitySessionId: input.clientActivitySessionId }
        : {}),
      counselorId: input.counselorId,
      ...(publicReview ? { publicReview } : {}),
    };

    set((state) => ({ items: [item, ...state.items] }));
    return item;
  },

  setModerationStatus: (id, status, reason = "") =>
    set((state) => {
      const target = state.items.find((item) => item.id === id);
      if (!target) return state;

      const items = state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              disabledReason:
                status === FEEDBACK_MODERATION_STATUS.DISABLED
                  ? reason.trim()
                  : undefined,
            }
          : item,
      );

      if (!target.publicReview) return { items };

      const publicReviews = state.publicReviews.filter(
        (review) => review.id !== target.publicReview?.id,
      );
      if (status === FEEDBACK_MODERATION_STATUS.SHOWN) {
        publicReviews.unshift(target.publicReview);
      }

      return { items, publicReviews };
    }),
}));
