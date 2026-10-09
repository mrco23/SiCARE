const counselors = [
  {
    name: "Giovanna Yusi, S.Psi., M.Psi.",
    role: "Psikolog",
    image: "/assets/counselor-1.png",
  },

  {
    name: "Rico Kornelius Wahani, S.Psi., M.Psi.",
    role: "Psikolog",
    image: "/assets/counselor-2.png",
  },
];

export default function CounselorSection() {
  return (
    <section
      className="
py-24
bg-[#F4F5F4]
overflow-hidden
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
          Ayo bertemu dengan konselor Anda!
        </h2>

        <p
          className="
text-sm
text-gray-500
mt-3
"
        >
          Lihat bagaimana proses konseling di SiCARE dan temukan langkah yang
          sesuai untukmu.
        </p>

        <div
          className="
flex
justify-center
gap-10
mt-14
flex-wrap
"
        >
          {counselors.map((item, index) => (
            <div
              key={index}
              className="
bg-white
rounded-xl
shadow-lg
w-[250px]
overflow-hidden
"
            >
              <div
                className="
h-[280px]
overflow-hidden
"
              >
                <img
                  src={item.image}
                  className="
w-full
h-full
object-cover
"
                />
              </div>

              <div
                className="
p-5
"
              >
                <h3
                  className="
text-sm
font-semibold
text-[#006B45]
"
                >
                  {item.name}
                </h3>

                <p
                  className="
text-xs
text-gray-500
mt-2
"
                >
                  {item.role}
                </p>

                <p
                  className="
text-[10px]
text-gray-400
mt-3
"
                >
                  Topik keahlian: Lorem ipsum dolor sit amet
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
