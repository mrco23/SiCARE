import { CalendarDays, MessageSquareText, Smile } from "lucide-react";

const MOOD_LEVELS = 5;
const ACTIVE_MOOD = 3; // indeks mood yang dipilih sebagai contoh

/*
 * Pratinjau antarmuka SiCARE untuk panel brand halaman auth.
 * Hanya dekorasi, tidak berinteraksi dengan data.
 */
export default function CounselingPreview() {
  return (
    <div aria-hidden="true" className="space-y-3">
      {/* Kartu percakapan */}
      <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-white/75">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gold text-primary">
            <MessageSquareText className="h-4 w-4" />
          </span>
          Percakapan dengan konselor
        </div>
        <div className="space-y-2 text-sm">
          <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-text-base">
            Saya ingin bercerita tentang kuliah minggu ini.
          </div>
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-gold px-3 py-2 text-primary">
            Tentu, saya siap mendengarkan.
          </div>
        </div>
      </div>

      {/* Kartu suasana hati */}
      <div className="ml-6 flex items-center justify-between gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
            <Smile className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">
              Suasana hati hari ini
            </p>
            <p className="text-xs text-white/65">Check-in singkat</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: MOOD_LEVELS }, (_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full ${
                i === ACTIVE_MOOD ? "bg-brand-gold" : "bg-white/25"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Kartu jadwal */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Jadwal konseling</p>
          <p className="text-xs text-white/65">Senin, 10.00 WITA</p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-medium text-emerald-200">
          Terkonfirmasi
        </span>
      </div>
    </div>
  );
}
