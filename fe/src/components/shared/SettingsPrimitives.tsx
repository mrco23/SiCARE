import type { ReactNode } from "react";

/** Shared visual primitives for role-specific settings pages. */
export function SettingsPanel({
  icon,
  title,
  description,
  action,
  className = "",
  compactHeader = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  compactHeader?: boolean;
  children: ReactNode;
}) {
  const heading = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">{icon}</span>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{description}</p>
      </div>
    </>
  );

  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      {compactHeader ? (
        <div className="mb-5 flex items-start gap-3">{heading}</div>
      ) : (
        <div className={`mb-5 flex items-start gap-3 ${action ? "justify-between" : ""}`}>
          <div className="flex min-w-0 items-start gap-3">{heading}</div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function SettingsField({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-medium text-gray-800">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
