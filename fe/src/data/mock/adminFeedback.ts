import {
  FEEDBACK_MODERATION_STATUS,
  type FeedbackModerationStatus,
} from "../../constants/status";

/** Admin moderation seed. This dataset is not inferred to match public or counselor feedback fixtures. */

export type Feedback = {
  id: number;
  rating: number;
  text: string;
  psikolog: string;
  date: string; // ISO datetime
  status: FeedbackModerationStatus;
  disabledReason?: string;
};

export const PSIKOLOG = ["Ma'am Giovanna Yudi, M.Psi", "Dr. Budi Santoso, Psikolog"];

export const DATA: Feedback[] = [
  {
    id: 1,
    rating: 5,
    text: "Sesinya membantu, saya merasa didengarkan.",
    psikolog: PSIKOLOG[0],
    date: "2025-08-27T10:15:00",
    status: FEEDBACK_MODERATION_STATUS.SHOWN,
  },
  {
    id: 2,
    rating: 4,
    text: "Penjelasannya jelas dan mudah dipahami.",
    psikolog: PSIKOLOG[1],
    date: "2025-09-12T14:00:00",
    status: FEEDBACK_MODERATION_STATUS.SHOWN,
  },
  {
    id: 3,
    rating: 5,
    text: "Psikolognya ramah dan tidak menghakimi.",
    psikolog: PSIKOLOG[0],
    date: "2025-10-03T09:30:00",
    status: FEEDBACK_MODERATION_STATUS.SHOWN,
  },
  {
    id: 4,
    rating: 3,
    text: "Sesi lumayan, tapi sempat mulai terlambat.",
    psikolog: PSIKOLOG[1],
    date: "2025-11-18T13:00:00",
    status: FEEDBACK_MODERATION_STATUS.SHOWN,
  },
  {
    id: 5,
    rating: 2,
    text: "Saran yang diberikan terasa terlalu umum.",
    psikolog: PSIKOLOG[1],
    date: "2025-12-09T11:20:00",
    status: FEEDBACK_MODERATION_STATUS.SHOWN,
  },
  {
    id: 6,
    rating: 5,
    text: "Saya punya langkah konkret untuk kecemasan presentasi.",
    psikolog: PSIKOLOG[0],
    date: "2026-01-22T15:40:00",
    status: FEEDBACK_MODERATION_STATUS.SHOWN,
  },
  {
    id: 7,
    rating: 4,
    text: "Nyaman dan aman untuk bercerita.",
    psikolog: PSIKOLOG[0],
    date: "2026-02-17T10:00:00",
    status: FEEDBACK_MODERATION_STATUS.SHOWN,
  },
  {
    id: 8,
    rating: 1,
    text: "Link sesi online bermasalah, waktu terbuang.",
    psikolog: PSIKOLOG[1],
    date: "2026-03-05T16:10:00",
    status: FEEDBACK_MODERATION_STATUS.SHOWN,
  },
  {
    id: 9,
    rating: 5,
    text: "Recommended! Sangat profesional.",
    psikolog: PSIKOLOG[1],
    date: "2026-04-14T09:00:00",
    status: FEEDBACK_MODERATION_STATUS.SHOWN,
  },
  {
    id: 10,
    rating: 4,
    text: "Cukup puas, ingin lanjut sesi berikutnya.",
    psikolog: PSIKOLOG[0],
    date: "2026-05-27T13:30:00",
    status: FEEDBACK_MODERATION_STATUS.SHOWN,
  },
  {
    id: 11,
    rating: 3,
    text: "Biasa saja, tapi suasana sesinya tenang.",
    psikolog: PSIKOLOG[0],
    date: "2026-06-22T10:45:00",
    status: FEEDBACK_MODERATION_STATUS.SHOWN,
  },
  {
    id: 12,
    rating: 5,
    text: "Terbantu sekali, sesinya terstruktur dan hangat.",
    psikolog: PSIKOLOG[1],
    date: "2026-07-18T14:20:00",
    status: FEEDBACK_MODERATION_STATUS.PENDING,
  },
  {
    id: 13,
    rating: 4,
    text: "Sesi pertama yang menyenangkan.",
    psikolog: PSIKOLOG[0],
    date: "2026-08-26T10:00:00",
    status: FEEDBACK_MODERATION_STATUS.PENDING,
  },
  {
    id: 14,
    rating: 5,
    text: "Jadwalnya mudah dan konselornya responsif.",
    psikolog: PSIKOLOG[1],
    date: "2026-09-30T15:00:00",
    status: FEEDBACK_MODERATION_STATUS.PENDING,
  },
];
