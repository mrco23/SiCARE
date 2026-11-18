import { MessageSquareText } from "lucide-react";

/**
 * Logo + nama SiCARE yang sama dengan navbar publik, dipakai ulang di navbar dashboard
 * agar tampilan merek konsisten.
 */
export default function BrandMark() {
  return (
    <>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-brand-gold bg-white sm:h-13 sm:w-13">
        <img
          src="/icon-512x512.png"
          alt="Logo Universitas Katolik De La Salle Manado"
          className="h-8 w-8 rounded-full object-contain sm:h-10.5 sm:w-10.5"
        />
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-start text-lg font-semibold leading-none tracking-tight">
          <span className="text-primary">Si</span>
          <span className="text-blue-900">CARE</span>
          <MessageSquareText className="ml-2 -mt-1 h-3.5 w-3.5 text-blue-900" strokeWidth={2.5} />
        </div>
        <span className="mt-1 truncate text-[10px] font-semibold text-[#2b2b2b] sm:text-[11px] md:text-[10px]">
          Universitas Katolik De La Salle Manado
        </span>
      </div>
    </>
  );
}
