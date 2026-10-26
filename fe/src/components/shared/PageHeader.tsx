import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  backAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actionsClassName?: string;
  children?: ReactNode;
}

export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  backAction,
  className = "",
  titleClassName = "",
  descriptionClassName = "",
  actionsClassName = "",
  children,
}: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}
    >
      <div className="min-w-0 flex-1">
        {backAction && (
          <button
            type="button"
            onClick={backAction.onClick}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {backAction.label}
          </button>
        )}
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-accent">
            {eyebrow}
          </p>
        )}
        <h1
          className={`text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl ${titleClassName}`.trim()}
        >
          {title}
        </h1>
        {description && (
          <p
            className={`mt-1 text-sm text-slate-500 sm:text-base ${descriptionClassName}`.trim()}
          >
            {description}
          </p>
        )}
        {children}
      </div>

      {actions && (
        <div
          className={`flex shrink-0 flex-wrap items-center gap-3 ${actionsClassName}`.trim()}
        >
          {actions}
        </div>
      )}
    </header>
  );
}
