import type { ComponentProps } from "react";
import { Check, X } from "lucide-react";
import {
  CAMPUS_EMAIL_DOMAIN,
  PHONE_COUNTRY_PREFIX,
  getPasswordRuleChecks,
  nationalDigitsFromStored,
  nationalDigitsFromTyped,
  sanitizeEmailLocalPart,
} from "../../lib/accountRules";

const wrapperBase =
  "flex w-full min-w-0 items-stretch overflow-hidden rounded-xl border bg-white text-sm transition focus-within:ring-4";

function wrapperState(invalid: boolean, disabled: boolean) {
  const state = invalid
    ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-100"
    : "border-gray-200 focus-within:border-primary focus-within:ring-primary/15";
  return `${state} ${disabled ? "bg-gray-50 opacity-80" : ""}`;
}

const addonClass =
  "flex shrink-0 select-none items-center bg-gray-50 px-3 text-sm font-medium text-gray-500";

const innerInputClass =
  "w-full min-w-0 flex-1 bg-transparent px-3.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed read-only:cursor-not-allowed read-only:text-gray-500";

type BaseInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "className"> & {
  invalid?: boolean;
  /** Kelas tambahan untuk pembungkus (mis. tinggi/padding mengikuti halaman). */
  className?: string;
  /** Kelas padding vertikal input dalam. */
  inputClassName?: string;
};

/* ---------- Nomor telepon dengan awalan +62 tetap ---------- */

type PhoneE164InputProps = BaseInputProps & {
  /** Nilai dalam format apa pun (E.164, 08..., 62...). */
  value: string;
  /** Selalu dipanggil dengan format E.164 (`+62...`) atau string kosong. */
  onChange: (e164: string) => void;
};

export function PhoneE164Input({
  value,
  onChange,
  invalid = false,
  disabled = false,
  className = "",
  inputClassName = "py-2.5",
  placeholder = "81234567890",
  ...props
}: PhoneE164InputProps) {
  return (
    <div className={`${wrapperBase} ${wrapperState(invalid, Boolean(disabled))} ${className}`}>
      <span className={`${addonClass} border-r border-gray-200`} aria-hidden="true">
        {PHONE_COUNTRY_PREFIX}
      </span>
      <input
        {...props}
        type="tel"
        inputMode="numeric"
        autoComplete={props.autoComplete ?? "tel-national"}
        aria-invalid={invalid}
        disabled={disabled}
        placeholder={placeholder}
        value={nationalDigitsFromStored(value)}
        onChange={(event) => {
          const digits = nationalDigitsFromTyped(event.target.value);
          onChange(digits ? `${PHONE_COUNTRY_PREFIX}${digits}` : "");
        }}
        className={`${innerInputClass} ${inputClassName}`}
      />
    </div>
  );
}

/* ---------- Email dengan akhiran domain kampus tetap ---------- */

type CampusEmailInputProps = BaseInputProps & {
  /** Bagian sebelum "@". */
  value: string;
  onChange: (localPart: string) => void;
};

export function CampusEmailInput({
  value,
  onChange,
  invalid = false,
  disabled = false,
  readOnly = false,
  className = "",
  inputClassName = "py-2.5",
  placeholder = "nama.anda",
  ...props
}: CampusEmailInputProps) {
  return (
    <div className={`${wrapperBase} ${wrapperState(invalid, Boolean(disabled || readOnly))} ${className}`}>
      <input
        {...props}
        type="text"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        autoComplete={props.autoComplete ?? "username"}
        aria-invalid={invalid}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(sanitizeEmailLocalPart(event.target.value))}
        className={`${innerInputClass} ${inputClassName}`}
      />
      <span className={`${addonClass} border-l border-gray-200`} aria-hidden="true">
        @{CAMPUS_EMAIL_DOMAIN}
      </span>
    </div>
  );
}

/* ---------- Daftar syarat kata sandi ---------- */

export function PasswordRuleList({ password, className = "" }: { password: string; className?: string }) {
  const checks = getPasswordRuleChecks(password);
  return (
    <ul className={`grid gap-1 text-xs ${className}`} aria-label="Syarat kata sandi">
      {checks.map((rule) => (
        <li
          key={rule.id}
          className={`flex items-center gap-1.5 ${rule.ok ? "text-primary" : "text-gray-500"}`}
        >
          {rule.ok ? (
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
          )}
          <span>
            {rule.label}
            <span className="sr-only">{rule.ok ? " (terpenuhi)" : " (belum terpenuhi)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
