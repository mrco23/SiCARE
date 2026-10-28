import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string | number;
  note: string;
  icon: LucideIcon;
  tone?: "green" | "red" | "blue" | "gold";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-700",
    gold: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold leading-5 text-slate-500">{label}</p>
        <span className={`rounded-xl p-2 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}
