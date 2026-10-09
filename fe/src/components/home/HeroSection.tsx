import { ArrowRight } from "lucide-react";

export default function HeroSection() {
  return (
    <section
      className="
relative
min-h-[520px]
pt-28
overflow-hidden
"
    >
      {/* BACKGROUND */}

      <div
        className="
absolute
inset-0
bg-cover
bg-center
"
        style={{
          backgroundImage: "url('/assets/hero-counseling.png')",
        }}
      />

      {/* LEFT WHITE FADE */}

      <div
        className="
absolute
inset-0
bg-gradient-to-r
from-white
via-white/80
to-transparent
"
      />

      <div
        className="
relative
max-w-[1150px]
mx-auto
px-8
flex
items-center
h-[520px]
"
      >
        {/* TEXT */}

        <div
          className="
max-w-[480px]
"
        >
          <h1
            className="
text-[42px]
leading-[1.1]
font-bold
text-black
"
          >
            Lorem ipsum dolor sit
            <br />
            <span
              className="
text-[#006B45]
"
            >
              amet, consectetur
            </span>
            <br />
            <span
              className="
text-[#006B45]
"
            >
              adipiscing elit.
            </span>
          </h1>

          <p
            className="
mt-5
text-gray-600
text-sm
leading-relaxed
"
          >
            Lorem ipsum dolor sit amet consectetur adipiscing elit odio esse
            temporibus ut sit non possimus facilis aliquid libero officia
            occaecat et quae non atque adipiscing excepturi deserunt ipsum qui.
          </p>

          <button
            className="
mt-7
bg-[#006B45]
text-white
px-7
py-3
rounded-lg
text-sm
flex
items-center
gap-2
shadow-md
"
          >
            Mulai Konseling
            <ArrowRight size={16} />
          </button>
        </div>

        {/* FLOAT IMAGE CARD */}

        <div
          className="
absolute
right-16
bottom-20
hidden
lg:block
"
        >
          <div
            className="
bg-white
p-3
rounded-xl
shadow-xl
rotate-6
"
          >
            <img
              src="/assets/counseling-card.png"
              className="w-[230px]
rounded-lg
"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
