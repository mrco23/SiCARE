import { z } from "zod";

const count = z.number().int().min(0).max(1_000_000);
const label = (max = 160) => z.string().trim().max(max);

/**
 * Isi laporan agregat untuk PDF. Peran dan penanda tangan tidak diterima dari klien:
 * peran berasal dari rute, penanda tangan dari profil Kepala LMI yang masuk.
 */
export const reportPdfSchema = z
  .object({
    periodLabel: label(120).min(1),
    periodRange: label(120),
    dataLimited: z.boolean(),
    totals: z.object({ sessions: count, done: count, cancelled: count }).strict(),
    individual: z.object({ done: count, cancelled: count }).strict(),
    group: z.object({ done: count, cancelled: count }).strict(),
    months: z.array(z.object({ label: label(40), done: count, cancelled: count }).strict()).max(24),
    counselors: z
      .array(
        z
          .object({
            counselor: label(),
            individualDone: count,
            groupDone: count,
            totalCancelled: count,
            totalSessions: count,
          })
          .strict(),
      )
      .max(200),
    cancellations: z.array(z.object({ category: label(120), count }).strict()).max(50),
    rating: z
      .object({
        average: z.number().min(0).max(5),
        total: count,
        distribution: z
          .array(z.object({ star: z.number().int().min(1).max(5), count }).strict())
          .max(5),
      })
      .strict(),
    sessions: z
      .array(
        z
          .object({
            id: label(64),
            shortId: label(32),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            format: label(60),
            counselor: label(),
            outcome: label(60),
          })
          .strict(),
      )
      .max(5000),
    conclusion: z.string().max(5000),
  })
  .strict();
