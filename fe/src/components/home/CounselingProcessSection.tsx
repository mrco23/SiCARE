import { ClipboardList, UserRound, CalendarDays, FileText } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "MEMILIH LAYANAN KONSELING",
    desc: "Pilih layanan konseling sesuai kebutuhanmu.",
    icon: <ClipboardList size={18} />,
  },

  {
    number: "02",
    title: "MEMILIH KONSELOR",
    desc: "Temukan konselor yang sesuai dengan kebutuhanmu.",
    icon: <UserRound size={18} />,
  },

  {
    number: "03",
    title: "MEMILIH JADWAL TERSEDIA",
    desc: "Tentukan waktu konseling yang nyaman.",
    icon: <CalendarDays size={18} />,
  },

  {
    number: "04",
    title: "MENGISI INFORMASI",
    desc: "Lengkapi data untuk memulai sesi konseling.",
    icon: <FileText size={18} />,
  },
];

export default function CounselingProcessSection() {
  return (
    <section
      className="
py-24
bg-white
"
    >
      <div
        className="
max-w-[1150px]
mx-auto
px-8
text-center
"
      >
        <h2
          className="
text-[34px]
font-bold
"
        >
          Semua Dimulai dari Sini
        </h2>

        <p
          className="
text-sm
text-gray-500
mt-3
"
        >
          Lihat bagaimana proses booking konseling di SiCARE dan temukan langkah
          yang sesuai untukmu.
        </p>

        <div
          className="
grid
grid-cols-2
md:grid-cols-4
gap-8
mt-16
"
        >
          {steps.map((step, index) => (
            <div
              key={index}
              className="
relative
"
            >
              {/* BIG NUMBER */}

              <div
                className="
absolute
-top-12
left-1/2
-translate-x-1/2
text-[90px]
font-bold
text-[#D8EFE5]
z-0
"
              >
                {step.number}
              </div>

              <div
                className="
relative
z-10
bg-white
border
border-gray-100
shadow-sm
rounded-lg
px-5
py-7
min-h-[150px]
"
              >
                <h3
                  className="
text-[11px]
font-bold
leading-tight
"
                >
                  {step.title}
                </h3>

                <p
                  className="
text-xs
text-gray-500
mt-4
"
                >
                  {step.desc}
                </p>

                <div
                  className="
mt-5
text-[#006B45]
flex
justify-center
"
                >
                  {step.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          className="
mt-14
px-7
py-3
rounded-full
bg-white
shadow-md
text-xs
"
        >
          Lihat Selengkapnya →
        </button>
      </div>
    </section>
  );
}
