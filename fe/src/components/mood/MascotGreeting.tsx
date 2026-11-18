import AnimatedMascot from "./AnimatedMascot";

/**
 * Maskot SiCARE yang melambai, untuk sapaan di judul beranda (pengganti emoji 👋).
 * Ukuran mengikuti font judul (em). Animasi lambaian dan napas berasal dari AnimatedMascot
 * pose "wave" dan diam untuk `prefers-reduced-motion`.
 */
export default function MascotGreeting({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-block -my-[0.4em] w-[2.6em] align-[-0.85em] ${className}`}>
      <AnimatedMascot pose="wave" />
    </span>
  );
}
