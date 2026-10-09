import { Heart, ShieldCheck, Users } from "lucide-react";

const benefits = [
  {
    title: "Mengurangi beban & temukan solusi",
    icon: <Heart size={20} />,
    desc: "Layanan konseling membantu kamu menemukan solusi dan memahami diri secara lebih baik.",
  },

  {
    title: "Kerahasiaan terjaga",
    icon: <ShieldCheck size={20} />,
    desc: "Seluruh proses konseling dilakukan secara aman dan menjaga privasi.",
  },

  {
    title: "Pendampingan profesional",
    icon: <Users size={20} />,
    desc: "Dibantu konselor yang siap mendengarkan dan memberikan arahan.",
  },
];

export default function BenefitSection() {
  return (
    <section
      className="
bg-[#F5FFF8]
py-24
"
    >
      <div
        className="
max-w-[1150px]
mx-auto
px-8
"
      >
        <div
          className="
grid
md:grid-cols-2
items-center
gap-10
"
        >
          <div>
            <h2
              className="
text-[34px]
font-bold
leading-tight
"
            >
              Kenapa Layanan
              <br />
              Konseling
              <span
                className="
text-[#006B45]
"
              >
                Hadir
              </span>
              <br />
              <span
                className="
text-[#006B45]
"
              >
                Untuk Anda?
              </span>
            </h2>

            <p
              className="
mt-4
text-sm
text-gray-600
max-w-sm
"
            >
              Lorem ipsum dolor sit amet consectetur adipiscing elit odio esse
              temporibus ut sit non possimus facilis aliquip libero officia
              occaecat et.
            </p>
          </div>

          <div
            className="
flex
justify-center
"
          >
            <div
              className="
w-44
h-44
rounded-full
bg-white
shadow-sm
flex
items-center
justify-center
text-7xl
"
            >
              💬
            </div>
          </div>
        </div>

        {/* CARDS */}

        <div
          className="
grid
md:grid-cols-3
gap-8
mt-16
"
        >
          {benefits.map((item, index) => (
            <div
              key={index}
              className="
bg-white
border
border-gray-200
rounded-xl
p-6
hover:shadow-lg
transition
"
            >
              <div
                className="
w-10
h-10
rounded-lg
bg-[#E9F7F0]
text-[#006B45]
flex
items-center
justify-center
mb-4
"
              >
                {item.icon}
              </div>

              <h3
                className="
font-semibold
text-sm
"
              >
                {item.title}
              </h3>

              <p
                className="
text-xs
text-gray-500
mt-3
leading-relaxed
"
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
