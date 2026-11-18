import { useEffect, useMemo, useState } from "react";
import MascotGreeting from "./MascotGreeting";

export type GreetingSegment = { text: string; className?: string };

const CHAR_MS = 55;

/**
 * Kalimat sapaan beranda yang diketik huruf demi huruf, diikuti maskot yang melambai.
 * Lebar kalimat dipesan sejak awal (teks penuh tak terlihat), sehingga maskot tetap di
 * tempatnya dan pengetikan berhenti tepat sebelum maskot. Untuk `prefers-reduced-motion`
 * kalimat langsung tampil utuh. Pembaca layar menerima kalimat utuh.
 */
export default function TypingGreeting({
  segments,
  ready = true,
}: {
  segments: GreetingSegment[];
  /**
   * false selama data sapaan (mis. nama dan jenis kelamin) masih dimuat: hanya kursor yang
   * berkedip, tanpa mengetik kalimat sementara, sehingga kalimat diketik sekali saja.
   */
  ready?: boolean;
}) {
  const fullText = segments.map((segment) => segment.text).join("");
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const [count, setCount] = useState(0);
  const [prevText, setPrevText] = useState(fullText);

  // Ulangi pengetikan bila kalimat berubah (mis. nama selesai dimuat).
  if (fullText !== prevText) {
    setPrevText(fullText);
    setCount(0);
  }

  const shown = reduceMotion ? fullText.length : count;
  const done = shown >= fullText.length;

  useEffect(() => {
    if (!ready || reduceMotion || count >= fullText.length) return;
    const timer = window.setTimeout(() => setCount((value) => value + 1), CHAR_MS);
    return () => window.clearTimeout(timer);
  }, [count, fullText.length, reduceMotion, ready]);

  const starts = segments.map((_, index) =>
    segments.slice(0, index).reduce((sum, segment) => sum + segment.text.length, 0),
  );
  const typed = segments.map((segment, index) => {
    const part = segment.text.slice(0, Math.max(0, shown - starts[index]));
    return part ? (
      <span key={index} className={segment.className}>
        {part}
      </span>
    ) : null;
  });

  if (!ready) {
    return (
      <span role="status" aria-label="Memuat sapaan">
        <span className="inline-block h-[0.9em] w-[2px] translate-y-[0.1em] animate-pulse bg-current" />
      </span>
    );
  }

  return (
    <>
      <span className="sr-only">{fullText}</span>
      <span aria-hidden="true" className="relative inline-block">
        {/* Pemesan lebar: teks penuh tak terlihat */}
        <span className="invisible">
          {segments.map((segment, index) => (
            <span key={index} className={segment.className}>
              {segment.text}
            </span>
          ))}
        </span>
        <span className="absolute inset-0">
          {typed}
          {!done && (
            <span className="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.1em] animate-pulse bg-current" />
          )}
        </span>
      </span>{" "}
      <MascotGreeting />
    </>
  );
}
