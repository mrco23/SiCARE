import { useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

const controlBase =
  "w-full rounded-xl border bg-white px-4 py-3 text-sm text-text-base placeholder:text-gray-400 outline-none transition focus:ring-4";

const controlState = (hasError: boolean) =>
  hasError
    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
    : "border-gray-200 focus:border-primary-light focus:ring-secondary";

/* ---------- Field wrapper: label + kontrol + pesan error/hint ---------- */

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  error,
  required,
  hint,
  className = "",
  children,
}: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-text-base">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------- Input teks ---------- */

type TextInputProps = ComponentProps<"input"> & { error?: string };

export function TextInput({ error, className = "", ...props }: TextInputProps) {
  return (
    <input
      aria-invalid={Boolean(error)}
      className={`${controlBase} ${controlState(Boolean(error))} ${className}`}
      {...props}
    />
  );
}

/* ---------- Input kata sandi dengan toggle tampilkan ---------- */

export function PasswordInput({ error, className = "", ...props }: TextInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        aria-invalid={Boolean(error)}
        className={`${controlBase} pr-12 ${controlState(Boolean(error))} ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-text-muted transition hover:text-primary"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

