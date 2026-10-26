import type { HTMLAttributes, ReactNode } from "react";

export type PageRole = "admin" | "client" | "counselor" | "headlmi";

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  role?: PageRole;
  maxWidth?: "5xl" | "6xl" | "7xl" | "full";
  spacing?: "default" | "none";
  className?: string;
}

const roleMaxWidthMap: Record<PageRole, string> = {
  admin: "max-w-7xl",
  client: "max-w-7xl",
  counselor: "max-w-6xl",
  headlmi: "max-w-7xl",
};

const maxWidthMap = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

export default function PageContainer({
  children,
  role,
  maxWidth,
  spacing = "default",
  className = "",
  ...rest
}: PageContainerProps) {
  const resolvedMaxWidth = maxWidth
    ? maxWidthMap[maxWidth]
    : role
      ? roleMaxWidthMap[role]
      : "max-w-7xl";

  return (
    <div
      className={`mx-auto w-full ${resolvedMaxWidth} ${spacing === "default" ? "space-y-6" : ""} font-[Inter] text-slate-800 ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
