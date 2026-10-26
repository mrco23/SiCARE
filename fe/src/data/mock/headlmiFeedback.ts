import {
  FEEDBACK_REVIEW_STATUS,
  type FeedbackReviewStatus,
} from "../../constants/status";
import type { CounselingFormat } from "../../types/counseling";
import { REPORT_COUNSELORS as COUNSELORS } from "./reportCommon";

/** Aggregate Head LMI feedback fixture; not linked to individual feedback records. */

export type Feedback = {
  id: string;
  date: string;
  counselor: string;
  rating: number;
  category: CounselingFormat;
  comment: string;
  status: FeedbackReviewStatus;
};

const SAMPLE_COMMENTS = [
  "Konselor menjelaskan dengan jelas dan membantu saya memahami langkah berikutnya.",
  "Sesi terasa nyaman dan saya diberi ruang untuk menyampaikan pendapat.",
  "Jadwal perlu lebih fleksibel agar mudah disesuaikan dengan kegiatan kuliah.",
  "Saya berharap tersedia informasi lanjutan setelah sesi selesai.",
  "Pelaksanaan sesi berjalan tertib dan sesuai jadwal.",
  "Durasi sesi terasa kurang untuk membahas kebutuhan saya.",
  "Konselor mendengarkan dengan baik dan tidak menghakimi.",
  "Informasi pendaftaran dan konfirmasi jadwal cukup mudah dipahami.",
];

export const FEEDBACKS: Feedback[] = Array.from({ length: 150 }, (_, index) => {
  const date = new Date(Date.UTC(2024, 7, 25) + index * 3.1 * 864e5);
  const ratings = [5, 4, 5, 4, 3, 5, 2, 4, 5, 1, 4, 5];

  return {
    id: `FB${String(index + 1).padStart(3, "0")}`,
    date: date.toISOString().slice(0, 10),
    counselor: COUNSELORS[index % COUNSELORS.length],
    rating: ratings[index % ratings.length],
    category: index % 4 === 0 ? "Kelompok" : "Individu",
    comment: SAMPLE_COMMENTS[index % SAMPLE_COMMENTS.length],
    status:
      index % 5 === 0
        ? FEEDBACK_REVIEW_STATUS.NEW
        : index % 5 === 1
          ? FEEDBACK_REVIEW_STATUS.REVIEWED
          : FEEDBACK_REVIEW_STATUS.COMPLETED,
  };
});
