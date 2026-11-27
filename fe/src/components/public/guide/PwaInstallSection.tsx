import { useState, type ReactNode } from "react";
import {
  AppWindow,
  EllipsisVertical,
  RefreshCw,
  Share,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

type Platform = "android" | "ios";

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "android", label: "Android" },
  { id: "ios", label: "iPhone / iPad" },
];

const BENEFITS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Smartphone, title: "Ikon di layar utama", desc: "Buka SiCARE sekali sentuh, seperti aplikasi lain." },
  { icon: AppWindow, title: "Layar penuh", desc: "Tampil di jendela sendiri tanpa bilah alamat browser." },
  { icon: RefreshCw, title: "Selalu terbaru", desc: "Pembaruan terpasang otomatis, tidak perlu update manual." },
];

const Key = ({ children }: { children: ReactNode }) => (
  <span className="mx-0.5 inline-flex items-center rounded bg-white px-1.5 py-0.5 align-middle text-primary shadow-sm">
    {children}
  </span>
);

const STEPS: Record<Platform, ReactNode[]> = {
  android: [
    <>Buka SiCARE di <b>Google Chrome</b>.</>,
    <>Ketuk menu <Key><EllipsisVertical className="h-3.5 w-3.5" /></Key> di pojok kanan atas.</>,
    <>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>, lalu konfirmasi.</>,
  ],
  ios: [
    <>Buka SiCARE di <b>Safari</b>.</>,
    <>Ketuk tombol <b>Bagikan</b> <Key><Share className="h-3.5 w-3.5" /></Key> di bagian bawah layar.</>,
    <>Pilih <b>Tambah ke Layar Utama</b>, lalu ketuk <b>Tambah</b>.</>,
  ],
};

/** Tab awal: iPhone/iPad untuk perangkat Apple, selain itu Android; tetap bisa diganti manual. */
function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "android";
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : "android";
}

/**
 * Penjelasan singkat bahwa SiCARE dapat dipasang sebagai PWA (vite-plugin-pwa, display
 * standalone, registerType autoUpdate). Sengaja tidak menjanjikan mode offline atau
 * notifikasi push karena keduanya belum tersedia.
 */
export function PwaInstallSection() {
  const [platform, setPlatform] = useState<Platform>(detectPlatform);

  return (
    <section
      aria-labelledby="pwa-title"
      className="mx-auto w-[92%] pb-4 pt-32 sm:w-[88%] md:pt-40 lg:w-[86%]"
    >
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
        {/* Ilustrasi perangkat */}
        <div aria-hidden="true" className="relative mx-auto h-[320px] w-full max-w-[440px] sm:h-[380px]">
          <div className="absolute inset-6 rounded-full bg-[#E3F2E7] blur-2xl" />
          <div className="absolute left-1/2 top-0 flex aspect-[9/18] h-[86%] -translate-x-1/2 flex-col rounded-[34px] border-[7px] border-slate-900 bg-gradient-to-b from-white to-[#F3FAF5] shadow-2xl">
            <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-slate-900" />
            <div className="grid flex-1 grid-cols-3 content-start gap-x-3 gap-y-5 px-4 pt-7">
              {[
                "bg-sky-200",
                "bg-rose-200",
                "bg-amber-200",
                "bg-violet-200",
                "app",
                "bg-emerald-200",
                "bg-orange-200",
                "bg-teal-200",
                "bg-indigo-200",
              ].map((tone) =>
                tone === "app" ? (
                  <div key={tone} className="flex flex-col items-center gap-1">
                    <img
                      src="/apple-touch-icon.png"
                      alt=""
                      className="h-9 w-9 rounded-xl bg-white object-contain ring-4 ring-brand-gold/40"
                    />
                    <span className="text-[7px] font-bold text-primary">SiCARE</span>
                  </div>
                ) : (
                  <div key={tone} className="flex flex-col items-center gap-1">
                    <div className={`h-9 w-9 rounded-xl ${tone}`} />
                    <span className="h-1 w-6 rounded-full bg-slate-200" />
                  </div>
                ),
              )}
            </div>
            <div className="mx-auto mb-2.5 h-1 w-14 shrink-0 rounded-full bg-slate-300" />
          </div>
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-primary shadow-md ring-1 ring-[#DCE8DE]">
            Tanpa Play Store / App Store
          </span>
        </div>

        {/* Teks & langkah per platform */}
        <div>
          <span className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#236c44]">
            <span className="h-0.5 w-7 rounded-full bg-brand-gold" />
            Akses Lebih Cepat
          </span>
          <h2
            id="pwa-title"
            className="mt-3 font-[Montserrat] text-2xl font-extrabold leading-tight text-primary md:text-[30px]"
          >
            Pasang SiCARE seperti Aplikasi
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
            SiCARE adalah <b>Progressive Web App (PWA)</b>. Kamu bisa memasangnya di ponsel Android
            maupun iPhone/iPad langsung dari browser, tanpa mengunduh dari toko aplikasi.
          </p>

          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <li
                key={title}
                className="flex items-start gap-3 rounded-2xl border border-[#DCE8DE] bg-white p-3.5 shadow-sm sm:block"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 sm:mt-2">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-3xl border border-[#DCE8DE] bg-[#F6FBF7] p-4 sm:p-5">
            <div
              role="tablist"
              aria-label="Pilih perangkat"
              className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1"
            >
              {PLATFORMS.map((p) => {
                const active = platform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    id={`pwa-tab-${p.id}`}
                    aria-selected={active}
                    aria-controls="pwa-panel"
                    onClick={() => setPlatform(p.id)}
                    className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-primary bg-primary text-white"
                        : "border-[#DCE8DE] bg-white text-slate-700 hover:border-primary/40"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <ol
              id="pwa-panel"
              role="tabpanel"
              aria-labelledby={`pwa-tab-${platform}`}
              className="mt-4 space-y-3"
            >
              {STEPS[platform].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-sm text-slate-700">{step}</p>
                </li>
              ))}
            </ol>

            <p className="mt-4 border-t border-[#DCE8DE] pt-3 text-xs leading-relaxed text-slate-500">
              Tetap butuh koneksi internet saat digunakan. Data konseling tetap tersimpan di server
              kampus, bukan di perangkatmu.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
