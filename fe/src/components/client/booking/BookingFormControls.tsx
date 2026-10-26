import type { ReactNode } from "react";
import { ChevronLeft, Clock } from "lucide-react";

const PILL_BASE =
  "inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-sm font-semibold transition";
const PILL_ON = "border-primary bg-primary text-white";
const PILL_OFF =
  "border-gray-300 bg-white text-gray-700 hover:border-primary";

export function Stepper({
  step,
  steps,
}: {
  step: number;
  steps: readonly string[];
}) {
  return (
    <ol className="mt-6 flex items-start overflow-x-auto pb-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        const last = i === steps.length - 1;
        return (
          <li
            key={label}
            className={`flex min-w-[88px] flex-col items-center ${i === 0 ? "items-start" : ""} ${last ? "flex-none" : "flex-1"}`}
          >
            <div className="flex w-full items-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  active || done
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {done ? "✓" : n}
              </span>
              {!last && (
                <span
                  className={`mt-0 h-0.5 flex-1 ${done ? "bg-primary" : "bg-gray-200"}`}
                />
              )}
            </div>
            <span
              className={`mt-2 text-center text-[11px] font-semibold sm:text-xs ${active ? "text-primary" : "text-gray-500"}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function LayananCard({
  selected,
  onClick,
  title,
  desc,
  art,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  art: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col rounded-2xl border-2 bg-white p-4 text-left transition hover:shadow-md ${
        selected ? "border-primary" : "border-gray-200"
      }`}
    >
      <div className="flex h-32 items-center justify-center rounded-xl bg-primary-tint">
        {art}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="mt-1 text-sm text-gray-600">{desc}</p>
        </div>
        <span
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? "border-primary bg-primary" : "border-gray-300"
          }`}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>
      </div>
      <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
        <Clock className="h-3.5 w-3.5" strokeWidth={2} /> 60 menit
      </span>
    </button>
  );
}

export function ArtIndividu() {
  return (
    <svg
      viewBox="0 0 120 80"
      className="h-24 w-auto"
      fill="none"
      strokeWidth={2}
    >
      <rect
        x="12"
        y="46"
        width="34"
        height="18"
        rx="6"
        fill="#a7e3c7"
        stroke="#2e9a5f"
      />
      <rect
        x="74"
        y="46"
        width="34"
        height="18"
        rx="6"
        fill="#a7e3c7"
        stroke="#2e9a5f"
      />
      <circle cx="38" cy="26" r="9" fill="#fde2c4" stroke="#1e5b3a" />
      <circle cx="86" cy="26" r="9" fill="#dbeafe" stroke="#1d4ed8" />
      <path d="M28 44c0-8 4-12 10-12s10 4 10 12" stroke="#1e5b3a" />
      <path d="M76 44c0-8 4-12 10-12s10 4 10 12" stroke="#1d4ed8" />
    </svg>
  );
}

export function ArtKelompok() {
  return (
    <svg
      viewBox="0 0 120 80"
      className="h-24 w-auto"
      fill="none"
      strokeWidth={2}
    >
      <circle cx="40" cy="28" r="8" fill="#fde2c4" stroke="#1e5b3a" />
      <circle cx="60" cy="24" r="8" fill="#dbeafe" stroke="#1d4ed8" />
      <circle cx="80" cy="28" r="8" fill="#fde2c4" stroke="#1e5b3a" />
      <path
        d="M28 52c0-8 5-12 12-12s12 4 12 12M48 52c0-8 5-12 12-12s12 4 12 12M68 52c0-8 5-12 12-12s12 4 12 12"
        stroke="#2e9a5f"
      />
    </svg>
  );
}

export function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${PILL_BASE} px-4 py-1.5 ${selected ? PILL_ON : PILL_OFF}`}
    >
      {children}
    </button>
  );
}

export function ScalePill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition ${
        selected ? PILL_ON : PILL_OFF
      }`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  error,
  errorText,
  children,
}: {
  label: string;
  error: boolean;
  errorText: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      {children}
      {error && <ErrorText>{errorText}</ErrorText>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs font-semibold text-red-600">{children}</p>;
}

export function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

export function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-gray-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
      <span>{label}</span>
    </label>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
    >
      <ChevronLeft className="h-4 w-4" strokeWidth={2} /> Kembali
    </button>
  );
}

export function NavButton({
  onClick,
  disabled,
  children,
  variant = "outline",
  className = "",
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  variant?: "outline" | "solid";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
  const style =
    variant === "solid"
      ? "bg-primary px-5 py-2.5 text-white shadow-md hover:bg-primary-dark"
      : "border border-primary text-primary hover:bg-primary-soft";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${style} ${className}`}
    >
      {children}
    </button>
  );
}
