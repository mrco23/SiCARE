import { useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";

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

/* ---------- Dropdown ---------- */

type SelectInputProps = ComponentProps<"select"> & {
  error?: string;
  options: readonly string[];
  placeholder: string;
};

export function SelectInput({
  error,
  options,
  placeholder,
  className = "",
  ...props
}: SelectInputProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={Boolean(error)}
        className={`${controlBase} appearance-none pr-10 ${controlState(Boolean(error))} ${className} ${
          props.value ? "text-text-base" : "text-gray-400"
        }`}
        {...props}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt} className="text-text-base">
            {opt}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
    </div>
  );
}

/* ---------- Textarea ---------- */

type TextAreaProps = ComponentProps<"textarea"> & { error?: string };

export function TextArea({ error, className = "", ...props }: TextAreaProps) {
  return (
    <textarea
      rows={3}
      aria-invalid={Boolean(error)}
      className={`${controlBase} resize-none ${controlState(Boolean(error))} ${className}`}
      {...props}
    />
  );
}

/* ---------- Pilihan tunggal (radio) yang tampil sebagai kartu ---------- */

interface RadioGroupProps {
  name: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function RadioGroup({ name, options, value, onChange, error }: RadioGroupProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((opt) => {
        const checked = value === opt;
        return (
          <label
            key={opt}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              checked
                ? "border-primary bg-secondary text-primary"
                : error
                  ? "border-red-400 text-text-base"
                  : "border-gray-200 bg-white text-text-base hover:border-primary-light"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt}
              checked={checked}
              onChange={() => onChange(opt)}
              className="h-4 w-4 accent-primary"
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
}
