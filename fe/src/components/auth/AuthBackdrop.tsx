/* Dekorasi animasi untuk panel brand (desktop). Murni CSS, tanpa library tambahan. */

const BUBBLES = [
  { size: 56, left: "6%", delay: "0s", duration: "22s", tone: "white" },
  { size: 28, left: "18%", delay: "4s", duration: "16s", tone: "gold" },
  { size: 84, left: "32%", delay: "9s", duration: "28s", tone: "white" },
  { size: 36, left: "46%", delay: "2s", duration: "19s", tone: "gold" },
  { size: 64, left: "60%", delay: "12s", duration: "25s", tone: "white" },
  { size: 22, left: "74%", delay: "7s", duration: "14s", tone: "gold" },
  { size: 48, left: "86%", delay: "15s", duration: "21s", tone: "white" },
] as const;

const STARS = [
  { top: "10%", left: "22%", size: 4, delay: "0s", duration: "3.2s" },
  { top: "18%", left: "70%", size: 3, delay: "1.1s", duration: "4.1s" },
  { top: "32%", left: "12%", size: 3, delay: "2.3s", duration: "3.6s" },
  { top: "41%", left: "84%", size: 5, delay: "0.6s", duration: "4.8s" },
  { top: "56%", left: "40%", size: 3, delay: "1.8s", duration: "3.9s" },
  { top: "66%", left: "24%", size: 4, delay: "2.9s", duration: "4.4s" },
  { top: "74%", left: "66%", size: 3, delay: "0.4s", duration: "3.4s" },
  { top: "86%", left: "50%", size: 4, delay: "3.5s", duration: "5s" },
] as const;

export default function AuthBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {BUBBLES.map((b, i) => (
        <span
          key={`bubble-${i}`}
          className={`auth-bubble absolute bottom-0 rounded-full ring-1 ${
            b.tone === "gold"
              ? "bg-[#c9a54a]/15 ring-[#c9a54a]/25"
              : "bg-white/10 ring-white/15"
          }`}
          style={{
            width: b.size,
            height: b.size,
            left: b.left,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        />
      ))}

      {STARS.map((s, i) => (
        <span
          key={`star-${i}`}
          className="auth-star absolute rounded-full bg-white"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}
    </div>
  );
}
