export type IntakeAnswerKey = "selfHarm" | "distress" | "abuse" | "substance";
export type IntakeScaleKey = "sleep" | "finance";
export type IntakeEssayKey =
  | "complaint"
  | "history"
  | "reason"
  | "efforts"
  | "goal"
  | "strengths"
  | "weaknesses";

export const INTAKE_TOPICS = [
  "Karir, pendidikan, dan pekerjaan",
  "Motivasi",
  "Stres atau tekanan kerja",
  "Emosi, mood, kepribadian",
  "Kecemasan",
  "Hubungan dan keluarga",
  "Pengembangan diri",
  "Kesehatan dan kebiasaan sehari-hari",
] as const;

export const INTAKE_YESNO_OPTIONS: { key: IntakeAnswerKey; label: string }[] = [
  { key: "selfHarm", label: "Apakah Anda sedang merasa ingin bunuh diri?" },
  {
    key: "distress",
    label:
      "Apakah Anda sedang merasakan kesedihan, kehilangan, atau depresi yang luar biasa?",
  },
  {
    key: "abuse",
    label:
      "Apakah Anda pernah mengalami pelecehan? (fisik, seksual, dan/atau emosional)",
  },
  {
    key: "substance",
    label: "Apakah saat ini Anda sedang menggunakan obat-obatan?",
  },
];

export const INTAKE_SCALE_OPTIONS: { key: IntakeScaleKey; label: string }[] = [
  { key: "sleep", label: "Kualitas tidur" },
  { key: "finance", label: "Keadaan finansial" },
];

export const INTAKE_ESSAY_OPTIONS: { key: IntakeEssayKey; label: string }[] = [
  { key: "complaint", label: "Deskripsikan keluhan yang Anda rasakan" },
  {
    key: "history",
    label: "Deskripsikan riwayat terjadinya keluhan secara jelas dan rinci",
  },
  { key: "reason", label: "Keluhan dan alasan ingin memulai konseling" },
  {
    key: "efforts",
    label: "Apa yang sudah dilakukan untuk menangani masalah ini?",
  },
  {
    key: "goal",
    label: "Solusi apa yang diinginkan dari bantuan yang diterima?",
  },
  { key: "strengths", label: "Apa kelebihan diri Anda?" },
  { key: "weaknesses", label: "Apa kekurangan diri Anda?" },
];
