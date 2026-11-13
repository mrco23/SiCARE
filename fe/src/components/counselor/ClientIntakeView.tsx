import type { ClientIntake, IntakeAnswer } from "../../types/counseling";
import {
  INTAKE_ESSAY_OPTIONS,
  INTAKE_SCALE_OPTIONS,
  INTAKE_TOPICS,
  INTAKE_YESNO_OPTIONS,
} from "../../constants/intakeOptions";

const YN_PILL: Record<IntakeAnswer, string> = {
  Ya: "bg-red-50 text-red-700 ring-red-200",
  Mungkin: "bg-amber-50 text-amber-700 ring-amber-200",
  Tidak: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function IntakeText({
  value,
  emptyText,
}: {
  value?: string | null;
  emptyText: string;
}) {
  const text = value?.trim();
  if (!text) {
    return <p className="text-sm italic text-gray-400">{emptyText}</p>;
  }
  return (
    <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
      {text}
    </p>
  );
}

/**
 * Renders the client's intake form answers submitted when the booking was created.
 * `intake` is `undefined` when the requester isn't the counselor who owns this booking
 * (backend omits the field), and `null` when the client submitted no form (older bookings,
 * or a save that failed non-fatally) — both show the same "not available" message, since
 * neither case has anything to show.
 */
export function ClientIntakeView({
  intake,
  emptyText = "Jawaban form belum tersedia.",
}: {
  intake: ClientIntake | null | undefined;
  emptyText?: string;
}) {
  if (!intake) {
    return <p className="text-sm italic text-gray-400">{emptyText}</p>;
  }

  return (
    <div className="divide-y divide-gray-100">
      <div className="space-y-3 py-4 first:pt-0">
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Pertanyaan ya / tidak
        </h4>
        {INTAKE_YESNO_OPTIONS.map(({ key, label }) => {
          const answer = intake[key];
          return (
            <div key={key} className="flex items-start justify-between gap-3">
              <p className="text-sm text-gray-700">{label}</p>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${YN_PILL[answer]}`}
              >
                {answer}
              </span>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 py-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Skala
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {INTAKE_SCALE_OPTIONS.map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5"
            >
              <span className="text-sm text-gray-700">{label}</span>
              <span className="text-sm font-bold text-gray-900">
                {intake[key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 py-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Topik yang dipilih
        </h4>
        {intake.topics.length === 0 ? (
          <p className="text-sm italic text-gray-400">
            Tidak ada topik dipilih.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {INTAKE_TOPICS.filter((t) => intake.topics.includes(t)).map((t) => (
              <li
                key={t}
                className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary"
              >
                {t}
              </li>
            ))}
          </ul>
        )}
        {intake.other?.trim() && (
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Lainnya: </span>
            {intake.other}
          </p>
        )}
      </div>

      <div className="space-y-5 py-4 last:pb-0">
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Jawaban uraian
        </h4>
        {INTAKE_ESSAY_OPTIONS.map(({ key, label }) => (
          <div key={key}>
            <p className="text-sm font-semibold text-gray-800">{label}</p>
            <div className="mt-1.5">
              <IntakeText value={intake[key]} emptyText="Tidak diisi." />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
