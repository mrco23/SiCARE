import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Isi tombol aksi: ikon mengikuti ukuran teks tombol. */
export default function IconLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <Icon aria-hidden="true" className="h-[1.15em] w-[1.15em] shrink-0" />
      <span>{children}</span>
    </span>
  );
}
