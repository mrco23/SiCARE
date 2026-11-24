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

/** Opsi "Masalah yang ingin dibahas" mengikuti Google Form LMI (pilih satu, atau "Yang lain"). */
export const INTAKE_TOPICS = [
  "Relasi keluarga",
  "Relasi bersama pasangan",
  "Relasi di lingkungan sosial (teman, rekan kerja)",
  "Emosi, mood, kepribadian",
  "Karir, pendidikan, dan pekerjaan",
  "Motivasi",
] as const;

/** Pilihan jawaban per pertanyaan; pertanyaan bunuh diri hanya Ya/Tidak (Google Form LMI). */
export const INTAKE_YESNO_OPTIONS: {
  key: IntakeAnswerKey;
  label: string;
  choices: readonly ("Ya" | "Mungkin" | "Tidak")[];
}[] = [
  { key: "selfHarm", label: "Apakah Anda sedang merasa ingin bunuh diri?", choices: ["Ya", "Tidak"] },
  {
    key: "distress",
    label:
      "Apakah Anda sedang merasakan kesedihan, kehilangan, atau depresi yang luar biasa?",
    choices: ["Ya", "Mungkin", "Tidak"],
  },
  {
    key: "abuse",
    label:
      "Apakah Anda pernah mengalami pelecehan? (fisik, seksual, dan/atau emosional)",
    choices: ["Ya", "Mungkin", "Tidak"],
  },
  {
    key: "substance",
    label: "Apakah saat ini Anda sedang menggunakan obat-obatan?",
    choices: ["Ya", "Mungkin", "Tidak"],
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
  {
    key: "strengths",
    label: "Apa kelebihan diri Anda?",
  },
  {
    key: "weaknesses",
    label: "Apa kekurangan diri Anda?",
  },
];

