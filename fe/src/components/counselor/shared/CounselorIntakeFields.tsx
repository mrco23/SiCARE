import type { ReactNode } from "react";

export function CounselorBadge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export function CounselorScaleView({
  value,
  fallbackLabel,
}: {
  value: number;
  fallbackLabel?: string;
}) {
  const labels: Record<number, string> = {
    1: "Sangat buruk",
    2: "Buruk",
    3: "Cukup",
    4: "Baik",
    5: "Sangat baik",
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((number) => (
          <span
            key={number}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
              number === value
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {number}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Dipilih:{" "}
        <span className="font-semibold text-gray-800">
          {value} · {labels[value] ?? fallbackLabel}
        </span>
      </p>
    </div>
  );
}

export function CounselorAnswerRow({
  question,
  answer,
  variant = "activity",
}: {
  question: string;
  answer: string;
  variant?: "activity" | "request";
}) {
  const style =
    answer === "Ya"
      ? "bg-red-100 text-red-800"
      : answer === "Mungkin"
        ? "bg-amber-100 text-amber-800"
        : variant === "request"
          ? "bg-primary-soft text-primary"
          : "bg-gray-100 text-gray-700";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 py-3 last:border-0">
      <p className="text-sm text-gray-700">{question}</p>
      <CounselorBadge className={style}>{answer}</CounselorBadge>
    </div>
  );
}

export function CounselorEssayCard({
  title,
  children,
  variant = "activity",
}: {
  title: string;
  children?: ReactNode;
  variant?: "activity" | "request";
}) {
  if (variant === "request") {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-800">
          {children || "-"}
        </p>
      </section>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-800">
        {children || "-"}
      </p>
    </div>
  );
}
