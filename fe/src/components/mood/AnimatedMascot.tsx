import { useEffect, useRef, type ReactNode } from "react";

/*
 * Maskot SiCARE (karakter Psi/trisula) versi SVG berlapis dengan animasi prosedural.
 * Mengikuti maskot di landing page: kepala berbentuk cawan (cabang tengah trisula) menyempit
 * menjadi leher, badan berupa pilinan DNA emas-hijau dengan anak tangga ungu, kaki keluar dari
 * bawah DNA, dua sayap trisula navy bergaris emas tumbuh dari belakang leher ke atas, lengan kecil
 * bersarung tangan putih keluar dari sisi DNA, dan bintang ber-buku di atas kepala.
 *
 * Setiap pose punya susunan lengan, ekspresi wajah, efek tambahan, dan gerakan sendiri. Semua
 * gerakan dijalankan satu loop requestAnimationFrame (napas, kedip, sayap, bintang, dan gerak
 * khas pose), berhenti saat tidak terlihat, dan diam untuk `prefers-reduced-motion`.
 *
 * Komponen ini sengaja mandiri supaya nanti bisa ditukar dengan animasi Rive (.riv).
 */

export type MascotMood = "ceria" | "tenang" | "tegang" | "lelah" | "seimbang";
export type MascotPose = "wave" | "thinking" | MascotMood;

type LeftArm = "wave" | "chin" | "rest" | "chest" | "out";
type RightArm = "hip" | "rest" | "chest" | "out";
type Eyes = "open" | "happy" | "closed" | "half" | "wide";
type Brows = "normal" | "furrowed" | "worried" | "droopy" | "raised";
type Mouth = "grin" | "bigGrin" | "smile" | "hmm" | "wavy" | "yawn";
type Extra = "sparkles" | "sweat" | "zzz";

type PoseConfig = { left: LeftArm; right: RightArm; eyes: Eyes; brows: Brows; mouth: Mouth; extras: Extra[] };

const POSES: Record<MascotPose, PoseConfig> = {
  wave: { left: "wave", right: "hip", eyes: "open", brows: "normal", mouth: "grin", extras: [] },
  thinking: { left: "chin", right: "hip", eyes: "open", brows: "furrowed", mouth: "hmm", extras: [] },
  ceria: { left: "wave", right: "hip", eyes: "happy", brows: "raised", mouth: "bigGrin", extras: ["sparkles"] },
  tenang: { left: "rest", right: "rest", eyes: "closed", brows: "normal", mouth: "smile", extras: [] },
  tegang: { left: "chest", right: "chest", eyes: "wide", brows: "worried", mouth: "wavy", extras: ["sweat"] },
  lelah: { left: "rest", right: "rest", eyes: "half", brows: "droopy", mouth: "yawn", extras: ["zzz"] },
  seimbang: { left: "out", right: "out", eyes: "open", brows: "normal", mouth: "smile", extras: [] },
};

const C = {
  navy: "#183A80",
  navyLight: "#2C56A8",
  ink: "#0D1F48",
  gold: "#F4B73E",
  goldDeep: "#B8862A",
  green: "#13723F",
  purple: "#6A2C8F",
  pink: "#F07A86",
  tongue: "#E2566A",
  cheek: "#F58C93",
  pupil: "#0B1530",
  sky: "#6EC1E4",
  white: "#FFFFFF",
};

const CX = 130;

function starPoints(cx: number, cy: number, outer: number, inner: number, n = 5) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((-90 + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** Cerminkan path SVG terhadap sumbu tengah (x → 2·CX − x). Hanya untuk path ber-koordinat absolut. */
function mirror(d: string) {
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${2 * CX - Number(x)},${y}`);
}

/** Pegas teredam sederhana untuk gerak yang mengejar target dengan halus. */
function springStep(state: { x: number; v: number }, target: number, dt: number, stiffness = 60, damping = 12) {
  const force = (target - state.x) * stiffness - state.v * damping;
  state.v += force * dt;
  state.x += state.v * dt;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/* ---------- Bentuk statis ---------- */

// Kepala berbentuk cawan (cabang tengah trisula) yang menyempit menjadi leher.
const HEAD =
  "M76,80 C94,66 166,66 184,80 C184,88 174,93 166,95 C166,118 162,138 152,154 C144,162 116,162 108,154 C98,138 94,118 94,95 C86,93 76,88 76,80 Z";

// Badan adalah pilinan DNA: dua pita yang bersilang tiga kali.
const DNA_GOLD = "M108,150 C108,158 156,168 156,178 C156,188 104,196 104,206 C104,216 152,224 150,236";
const DNA_GREEN = "M152,150 C152,158 104,168 104,178 C104,188 156,196 156,206 C156,216 108,224 110,236";

// Kaki keluar dari bawah DNA.
const LEG_LEFT = "M108,228 L127,230 L125,262 L103,262 Z";

// Sayap trisula kiri: tumbuh dari belakang leher, melengkung ke luar lalu ke atas.
const PRONG_LEFT =
  "M114,170 C76,168 40,150 28,112 C20,86 12,62 -2,38 C30,34 58,52 70,82 C80,110 96,132 114,140 Z";
const PRONG_LEFT_GOLD =
  "M114,156 C96,152 82,136 74,110 C66,84 54,62 22,40 C48,44 64,64 72,90 C80,116 96,134 114,140 Z";
const PRONG_LEFT_SHINE = "M32,108 C26,86 20,70 10,52";

// Lengan kiri (dari sisi DNA). Lengan kanan memakai cermin bila bentuknya simetris.
const ARM_LEFT: Record<LeftArm, string> = {
  wave: "M108,186 C88,184 76,168 72,152",
  chin: "M108,186 C80,190 78,166 98,160",
  rest: "M108,186 C96,192 92,206 94,220",
  chest: "M108,186 C98,184 102,172 114,170",
  out: "M108,186 C94,184 80,180 64,178",
};
const HAND_LEFT: Record<"rest" | "chest" | "out", [number, number]> = {
  rest: [94, 228],
  chest: [120, 169],
  out: [56, 178],
};

const SPARKLES: [number, number][] = [
  [40, 150],
  [222, 132],
  [206, 30],
  [58, 34],
];

const ZZZ: [number, number, number][] = [
  [178, 70, 16],
  [190, 58, 12],
];

type Props = {
  /**
   * "wave": melambai menyapa (pembuka Mood Tracker).
   * "thinking": menopang dagu (home page, mengikuti thinking.png).
   * "ceria" | "tenang" | "tegang" | "lelah" | "seimbang": ekspresi hasil Mood Tracker.
   */
  pose?: MascotPose;
  /** Hanya untuk pose "wave": lambaian lebih cepat dan melompat kecil, mis. saat tombol disorot. */
  excited?: boolean;
  className?: string;
};

export default function AnimatedMascot({ pose = "wave", excited = false, className = "" }: Props) {
  const cfg = POSES[pose];

  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<SVGGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const prongLeftRef = useRef<SVGGElement>(null);
  const prongRightRef = useRef<SVGGElement>(null);
  const leftArmRef = useRef<SVGGElement>(null);
  const leftHandRef = useRef<SVGGElement>(null);
  const rightArmRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const pupilsRef = useRef<SVGGElement>(null);
  const browsRef = useRef<SVGGElement>(null);
  const starRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const sparkleRefs = useRef<(SVGPolygonElement | null)[]>([]);
  const sweatRef = useRef<SVGGElement>(null);
  const zzzRefs = useRef<(SVGTextElement | null)[]>([]);
  const excitedRef = useRef(excited);

  useEffect(() => {
    excitedRef.current = excited;
  }, [excited]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    const pc = POSES[pose];

    const pointer = { x: 0, y: 0, active: false };
    const lean = { x: 0, v: 0 };
    const eyeX = { x: 0, v: 0 };
    const eyeY = { x: 0, v: 0 };
    const hop = { x: 0, v: 0 };
    const brow = { x: 0, v: 0 };

    const blinks = pc.eyes !== "closed" && pc.eyes !== "happy";
    let nextBlinkAt = 1.5 + Math.random() * 2;
    let blinkStart = -1;
    let doubleBlink = false;
    let nextWaveAt = 0.6;
    let waveStart = -1;
    const WAVE_DURATION = 2.6;

    let visible = true;
    let frame = 0;
    let last = performance.now();
    const t0 = last;

    const onPointerMove = (event: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.42;
      pointer.x = Math.max(-1, Math.min(1, (event.clientX - cx) / (window.innerWidth / 2)));
      pointer.y = Math.max(-1, Math.min(1, (event.clientY - cy) / (window.innerHeight / 2)));
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };

    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
          })
        : null;
    observer?.observe(svg);

    const set = (el: Element | null, transform: string) => {
      if (el) el.setAttribute("transform", transform);
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      const t = (now - t0) / 1000;
      const isExcited = pose === "ceria" || (pose === "wave" && excitedRef.current);
      const followsPointer = pose === "wave" || pose === "seimbang";

      // Napas: lebih pelan dan dalam saat tenang/lelah.
      const breathPeriod = pose === "tenang" ? 4.6 : pose === "lelah" ? 4.2 : 3.2;
      const breathAmp = pose === "tenang" ? 0.022 : 0.014;
      const breath = 1 + breathAmp * Math.sin((2 * Math.PI * t) / breathPeriod);

      // Lompatan kecil saat bersemangat.
      springStep(hop, isExcited ? -7 * Math.abs(Math.sin(2 * Math.PI * t * 1.4)) : 0, dt, 90, 14);

      // Condong, arah pandang, alis — khas tiap pose.
      let jitterX = 0;
      const idleDrift = Math.sin(t * 0.7) * 0.25;
      if (pose === "thinking") {
        springStep(lean, 3 * Math.sin(t * 0.55), dt, 30, 9);
        springStep(eyeX, 3.4 * Math.tanh(4 * Math.sin(t * 0.45)), dt, 50, 11);
        springStep(eyeY, -3.4 + 0.6 * Math.sin(t * 1.3), dt, 50, 11);
        springStep(brow, 1.2 * Math.sin(t * 0.9), dt, 60, 11);
      } else if (pose === "tenang") {
        springStep(lean, 2 * Math.sin(t * 0.5), dt, 20, 8);
        springStep(brow, 0, dt, 60, 11);
      } else if (pose === "tegang") {
        jitterX = 0.7 * Math.sin(t * 42);
        springStep(lean, 0.8 * Math.sin(t * 1.7), dt, 40, 10);
        springStep(eyeX, 2.6 * Math.sign(Math.sin(t * 2.3)), dt, 120, 14);
        springStep(eyeY, 0.6 * Math.sin(t * 3.1), dt, 80, 12);
        springStep(brow, 0.6 * Math.sin(t * 5), dt, 80, 12);
      } else if (pose === "lelah") {
        springStep(lean, 4 + 1.5 * Math.sin(t * 0.4), dt, 15, 7);
        springStep(eyeX, 0, dt, 40, 10);
        springStep(eyeY, 1.5, dt, 40, 10);
        springStep(brow, 1, dt, 40, 10);
      } else if (pose === "seimbang") {
        // Menjungkit seperti menjaga keseimbangan.
        springStep(lean, 5 * Math.sin(t * 0.9), dt, 25, 8);
        springStep(brow, 0, dt, 60, 11);
      } else {
        springStep(lean, pointer.active ? pointer.x * 4 : idleDrift * 2, dt, 30, 9);
        springStep(brow, isExcited ? -2.5 : 0, dt, 80, 12);
      }
      if (followsPointer) {
        springStep(eyeX, pointer.active ? pointer.x * 3.6 : idleDrift * 2, dt, 70, 13);
        springStep(eyeY, pointer.active ? pointer.y * 2.6 : 0, dt, 70, 13);
      }

      set(rootRef.current, `translate(${jitterX.toFixed(2)} ${hop.x.toFixed(2)}) rotate(${lean.x.toFixed(2)} ${CX} 282)`);
      set(bodyRef.current, `translate(${CX} 272) scale(${(2 - breath).toFixed(4)} ${breath.toFixed(4)}) translate(${-CX} -272)`);
      set(shadowRef.current, `translate(${CX} 286) scale(${(1 + hop.x / 40).toFixed(3)} 1) translate(${-CX} -286)`);
      set(pupilsRef.current, `translate(${eyeX.x.toFixed(2)} ${eyeY.x.toFixed(2)})`);
      set(browsRef.current, `translate(0 ${brow.x.toFixed(2)})`);

      // Sayap trisula: terkulai saat lelah, bergetar saat tegang, lebar saat bersemangat.
      let prongL: number;
      let prongR: number;
      if (pose === "lelah") {
        prongL = -9 - 1.5 * Math.sin(t * 0.6);
        prongR = 9 + 1.5 * Math.sin(t * 0.6 + 0.5);
      } else if (pose === "tegang") {
        prongL = 1.2 * Math.sin(t * 30);
        prongR = -1.2 * Math.sin(t * 30 + 1);
      } else {
        const amp = isExcited ? 5 : pose === "tenang" ? 1.6 : 2.2;
        const phase = (2 * Math.PI * t) / (isExcited ? 0.9 : pose === "tenang" ? 5 : 3.4);
        prongL = -amp * Math.sin(phase);
        prongR = amp * Math.sin(phase + 0.4);
      }
      set(prongLeftRef.current, `rotate(${prongL.toFixed(2)} 112 152)`);
      set(prongRightRef.current, `rotate(${prongR.toFixed(2)} 148 152)`);

      // Kedip acak (kadang dua kali) untuk mata yang terbuka.
      let lid = 1;
      if (blinks) {
        if (blinkStart < 0 && t >= nextBlinkAt) {
          blinkStart = t;
          doubleBlink = Math.random() < 0.25;
        }
        if (blinkStart >= 0) {
          const total = doubleBlink ? 0.42 : 0.16;
          const p = (t - blinkStart) / total;
          if (p >= 1) {
            blinkStart = -1;
            nextBlinkAt = t + (pose === "lelah" ? 1.6 : 2.2) + Math.random() * 3.8;
          } else {
            const local = doubleBlink ? (p * 2) % 1 : p;
            lid = Math.max(0.08, Math.abs(1 - 2 * local));
          }
        }
      }
      set(eyesRef.current, `translate(0 113) scale(1 ${lid.toFixed(3)}) translate(0 -113)`);

      // Lengan kiri.
      let mouthScale = 1;
      if (pc.left === "wave") {
        if (!isExcited && waveStart < 0 && t >= nextWaveAt) waveStart = t;
        let envelope = 0;
        if (isExcited) envelope = 1;
        else if (waveStart >= 0) {
          const p = (t - waveStart) / WAVE_DURATION;
          if (p >= 1) {
            waveStart = -1;
            nextWaveAt = t + 3.5 + Math.random() * 3.5;
          } else {
            envelope = easeInOut(Math.min(1, p * 4)) * easeInOut(Math.min(1, (1 - p) * 4));
          }
        }
        const phase = 2 * Math.PI * (isExcited ? 2.6 : 1.7) * t;
        const restSway = 2.5 * Math.sin((2 * Math.PI * t) / 3.6);
        const armAngle = restSway * (1 - envelope) + envelope * (isExcited ? 14 : 10) * Math.sin(phase) - envelope * 4;
        // Pergelangan tertinggal dari lengan: gerak susulan.
        const handAngle = envelope * (isExcited ? 28 : 22) * Math.sin(phase - 0.9);
        set(leftArmRef.current, `rotate(${armAngle.toFixed(2)} 108 186)`);
        set(leftHandRef.current, `rotate(${handAngle.toFixed(2)} 72 148)`);
        mouthScale = 1 + 0.18 * Math.max(envelope, isExcited ? 1 : 0);
      } else if (pc.left === "chin") {
        const tapping = t % 3.4 < 0.7 ? 6 * Math.abs(Math.sin(t * 14)) : 0;
        set(leftArmRef.current, `rotate(${(1.5 * Math.sin((2 * Math.PI * t) / 3.4)).toFixed(2)} 108 186)`);
        set(leftHandRef.current, `rotate(${(-tapping).toFixed(2)} 102 160)`);
      } else if (pc.left === "out") {
        // Lengan terentang mengimbangi jungkitan badan.
        set(leftArmRef.current, `rotate(${(-lean.x * 1.6).toFixed(2)} 108 186)`);
      } else if (pc.left === "chest") {
        set(leftArmRef.current, `rotate(${(0.8 * Math.sin(t * 36)).toFixed(2)} 108 186)`);
      } else {
        set(leftArmRef.current, `rotate(${(2 * Math.sin((2 * Math.PI * t) / 4.2)).toFixed(2)} 108 186)`);
      }

      // Lengan kanan.
      if (pc.right === "out") {
        set(rightArmRef.current, `rotate(${(-lean.x * 1.6).toFixed(2)} 152 186)`);
      } else if (pc.right === "chest") {
        set(rightArmRef.current, `rotate(${(-0.8 * Math.sin(t * 36 + 1)).toFixed(2)} 152 186)`);
      } else {
        const sway = pc.right === "rest"
          ? -2 * Math.sin((2 * Math.PI * t) / 4.2 + 0.6)
          : 2.5 * Math.sin((2 * Math.PI * t) / 2.9 + 1);
        set(rightArmRef.current, `rotate(${(sway - (isExcited ? 4 : 0)).toFixed(2)} 152 186)`);
      }

      // Menguap sesekali saat lelah.
      if (pc.mouth === "yawn") {
        const p = (t % 6) / 1.6;
        mouthScale = p < 1 ? 1 + 1.1 * Math.sin(Math.PI * p) : 1;
      }
      set(mouthRef.current, `translate(${CX} 136) scale(1 ${mouthScale.toFixed(3)}) translate(${-CX} -136)`);

      // Bintang berkilau.
      const starRot = 6 * Math.sin((2 * Math.PI * t) / 4.2);
      const starScale = 1 + 0.05 * Math.sin((2 * Math.PI * t) / 1.9);
      set(starRef.current, `rotate(${starRot.toFixed(2)} ${CX} 46) translate(${CX} 46) scale(${starScale.toFixed(3)}) translate(${-CX} -46)`);

      // Efek tambahan.
      sparkleRefs.current.forEach((el, i) => {
        if (!el) return;
        const s = Math.max(0, Math.sin(t * 3 + i * 2.1));
        const [x, y] = SPARKLES[i];
        el.setAttribute("transform", `translate(${x} ${y}) scale(${s.toFixed(3)}) rotate(${(t * 60 + i * 40).toFixed(1)}) translate(${-x} ${-y})`);
      });
      if (sweatRef.current) {
        const p = (t % 1.8) / 1.8;
        sweatRef.current.setAttribute("transform", `translate(0 ${(p * 14).toFixed(2)})`);
        sweatRef.current.setAttribute("opacity", (p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25).toFixed(2));
      }
      zzzRefs.current.forEach((el, i) => {
        if (!el) return;
        const p = ((t + i * 1.1) % 3.3) / 3.3;
        el.setAttribute("transform", `translate(${(p * 10).toFixed(2)} ${(-p * 26).toFixed(2)})`);
        el.setAttribute("opacity", Math.sin(Math.PI * p).toFixed(2));
      });
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      observer?.disconnect();
    };
  }, [pose]);

  /* ---------- Bagian-bagian ---------- */

  const prong = (d: string, gold: string, shine: string) => (
    <g>
      <path d={d} fill={C.navy} stroke={C.ink} strokeWidth={2.6} strokeLinejoin="round" />
      <path d={gold} fill={C.gold} />
      <path d={shine} stroke={C.navyLight} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.7} />
    </g>
  );

  const arm = (d: string) => (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={C.ink} strokeWidth={17} />
      <path d={d} stroke={C.navy} strokeWidth={13} />
    </g>
  );

  const gloveUp = (cx: number, cy: number) => (
    <g stroke={C.ink} strokeWidth={2.2} strokeLinejoin="round" fill={C.white}>
      <rect x={cx - 11} y={cy - 22} width={6} height={15} rx={3} />
      <rect x={cx - 4.5} y={cy - 26} width={6} height={19} rx={3} />
      <rect x={cx + 2} y={cy - 24} width={6} height={17} rx={3} />
      <rect x={cx + 8.5} y={cy - 19} width={5.5} height={13} rx={2.75} />
      <ellipse cx={cx - 13} cy={cy - 1} rx={4} ry={6.5} transform={`rotate(-35 ${cx - 13} ${cy - 1})`} />
      <ellipse cx={cx} cy={cy} rx={11} ry={10} />
      <rect x={cx - 9.5} y={cy + 7} width={19} height={6.5} rx={3} fill={C.gold} stroke={C.goldDeep} strokeWidth={1.4} />
    </g>
  );

  // Tangan menopang dagu: telunjuk menunjuk ke atas menyentuh dagu, jari lain mengepal.
  const gloveChin = (cx: number, cy: number) => (
    <g stroke={C.ink} strokeWidth={2.2} strokeLinejoin="round" fill={C.white}>
      <rect x={cx + 2} y={cy - 22} width={6.5} height={18} rx={3.25} transform={`rotate(28 ${cx + 5} ${cy - 6})`} />
      <ellipse cx={cx} cy={cy} rx={11} ry={10} />
      <path d={`M${cx - 6},${cy - 2} Q${cx - 1},${cy - 5} ${cx + 4},${cy - 2} M${cx - 6},${cy + 3} Q${cx - 1},${cy} ${cx + 4},${cy + 3}`} fill="none" strokeWidth={1.5} />
      <ellipse cx={cx + 9} cy={cy + 1} rx={3.8} ry={6} transform={`rotate(-20 ${cx + 9} ${cy + 1})`} />
      <rect x={cx - 15} y={cy + 1} width={6.5} height={13} rx={3} fill={C.gold} stroke={C.goldDeep} strokeWidth={1.4} transform={`rotate(-40 ${cx - 12} ${cy + 7})`} />
    </g>
  );

  // Kepalan di pinggang.
  const gloveFist = (cx: number, cy: number) => (
    <g stroke={C.ink} strokeWidth={2.2} strokeLinejoin="round" fill={C.white}>
      <ellipse cx={cx} cy={cy} rx={11.5} ry={10.5} />
      <path d={`M${cx - 6},${cy - 6} Q${cx - 2},${cy - 9} ${cx + 2},${cy - 6} M${cx - 7},${cy - 1} Q${cx - 3},${cy - 4} ${cx + 1},${cy - 1} M${cx - 6},${cy + 4} Q${cx - 2},${cy + 1} ${cx + 2},${cy + 4}`} fill="none" strokeWidth={1.6} />
      <rect x={cx + 6} y={cy - 9} width={6.5} height={15} rx={3} fill={C.gold} stroke={C.goldDeep} strokeWidth={1.4} transform={`rotate(-20 ${cx + 9} ${cy - 1})`} />
    </g>
  );

  // Tangan santai: dipakai untuk lengan menggantung, di dada, atau terentang.
  const gloveSoft = (cx: number, cy: number) => (
    <g stroke={C.ink} strokeWidth={2.2} strokeLinejoin="round" fill={C.white}>
      <ellipse cx={cx} cy={cy} rx={10.5} ry={10} />
      {/* Lipatan jempol (bukan lengkung senyum, agar tidak terlihat seperti wajah) */}
      <path d={`M${cx - 1},${cy - 7} Q${cx + 5},${cy - 4} ${cx + 4},${cy + 3}`} fill="none" strokeWidth={1.5} />
    </g>
  );

  const ribbon = (d: string, color: string) => (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke={C.ink} strokeWidth={16} />
      <path d={d} stroke={color} strokeWidth={12} />
    </g>
  );

  const eyePair = (render: (x: number) => ReactNode) => [render(113), render(147)];

  let eyesArt: ReactNode;
  if (cfg.eyes === "happy") {
    eyesArt = eyePair((x) => (
      <path key={x} d={`M${x - 9},116 Q${x},103 ${x + 9},116`} stroke={C.white} strokeWidth={4.5} strokeLinecap="round" fill="none" />
    ));
  } else if (cfg.eyes === "closed") {
    eyesArt = eyePair((x) => (
      <path key={x} d={`M${x - 9},111 Q${x},121 ${x + 9},111`} stroke={C.white} strokeWidth={4} strokeLinecap="round" fill="none" />
    ));
  } else {
    const wide = cfg.eyes === "wide";
    eyesArt = (
      <>
        {eyePair((x) => (
          <ellipse key={`w${x}`} cx={x} cy={113} rx={wide ? 12.5 : 11} ry={wide ? 14.5 : 13} fill={C.white} stroke={C.ink} strokeWidth={1.6} />
        ))}
        <g ref={pupilsRef}>
          {eyePair((x) => (
            <g key={`p${x}`}>
              <circle cx={x + 1} cy={115} r={wide ? 4.6 : 6.8} fill={C.pupil} />
              <circle cx={x + 3} cy={112} r={wide ? 1.6 : 2.4} fill={C.white} />
            </g>
          ))}
        </g>
        {cfg.eyes === "half" &&
          eyePair((x) => (
            <path key={`l${x}`} d={`M${x - 12.5},113 C${x - 12.5},96 ${x + 12.5},96 ${x + 12.5},113 Z`} fill={C.navy} stroke={C.ink} strokeWidth={1.6} />
          ))}
      </>
    );
  }

  const browPath = (d: string) => <path key={d} d={d} stroke={C.white} strokeWidth={3.7} strokeLinecap="round" fill="none" />;
  const BROWS: Record<Brows, [string, string]> = {
    normal: ["M103,95 Q112,88 121,94", "M139,94 Q148,88 157,95"],
    furrowed: ["M101,88 Q112,86 122,95", "M138,96 Q148,88 159,92"],
    worried: ["M103,96 Q112,92 121,87", "M139,87 Q148,92 157,96"],
    droopy: ["M102,98 Q112,92 121,95", "M139,95 Q148,92 158,98"],
    raised: ["M103,90 Q112,82 121,88", "M139,88 Q148,82 157,90"],
  };
  const browsArt = BROWS[cfg.brows].map(browPath);

  let mouthArt: ReactNode;
  switch (cfg.mouth) {
    case "bigGrin":
      mouthArt = (
        <>
          <path d="M115,127 Q130,152 145,127 Q130,133 115,127 Z" fill={C.pink} stroke={C.ink} strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M122,138 Q130,146 138,138 Q130,135 122,138 Z" fill={C.tongue} />
        </>
      );
      break;
    case "smile":
      mouthArt = <path d="M121,132 Q130,141 139,132" stroke={C.pink} strokeWidth={3.4} strokeLinecap="round" fill="none" />;
      break;
    case "hmm":
      mouthArt = <path d="M124,140 Q130,135 136,139" stroke={C.pink} strokeWidth={3.2} strokeLinecap="round" fill="none" />;
      break;
    case "wavy":
      mouthArt = (
        <path d="M120,138 Q123,134 126,138 Q129,142 132,138 Q135,134 138,138 Q141,142 142,139" stroke={C.pink} strokeWidth={3} strokeLinecap="round" fill="none" />
      );
      break;
    case "yawn":
      mouthArt = <ellipse cx={130} cy={136} rx={5} ry={4} fill={C.tongue} stroke={C.ink} strokeWidth={1.6} />;
      break;
    default:
      mouthArt = (
        <>
          <path d="M119,129 Q130,146 141,129 Q130,134 119,129 Z" fill={C.pink} stroke={C.ink} strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M124,136 Q130,142 136,136 Q130,134 124,136 Z" fill={C.tongue} />
        </>
      );
  }

  let leftHand: ReactNode;
  if (cfg.left === "wave") {
    // Telapak menghadap pengguna: jempol mengarah ke badan, kelingking di sisi luar.
    leftHand = (
      <g ref={leftHandRef}>
        <g transform="translate(144 0) scale(-1 1)">{gloveUp(72, 142)}</g>
      </g>
    );
  } else if (cfg.left === "chin") {
    leftHand = <g ref={leftHandRef}>{gloveChin(104, 156)}</g>;
  } else {
    const [x, y] = HAND_LEFT[cfg.left];
    leftHand = gloveSoft(x, y);
  }

  let rightArm: ReactNode;
  if (cfg.right === "hip") {
    rightArm = (
      <>
        {arm("M152,186 C176,186 188,200 176,214")}
        {gloveFist(170, 218)}
      </>
    );
  } else {
    const [x, y] = HAND_LEFT[cfg.right];
    rightArm = (
      <>
        {arm(mirror(ARM_LEFT[cfg.right]))}
        {gloveSoft(2 * CX - x, y)}
      </>
    );
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 260 300"
      className={`block h-auto w-full overflow-visible ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse ref={shadowRef} cx={CX} cy={286} rx={62} ry={7} fill="#064E3B" opacity={0.12} />

      <g ref={rootRef}>
        <g ref={bodyRef}>
          {/* Sayap trisula (di belakang leher dan badan) */}
          <g ref={prongLeftRef}>{prong(PRONG_LEFT, PRONG_LEFT_GOLD, PRONG_LEFT_SHINE)}</g>
          <g ref={prongRightRef}>{prong(mirror(PRONG_LEFT), mirror(PRONG_LEFT_GOLD), mirror(PRONG_LEFT_SHINE))}</g>

          {/* Kaki dan sepatu */}
          <path d={LEG_LEFT} fill={C.navy} stroke={C.ink} strokeWidth={2.4} strokeLinejoin="round" />
          <path d={mirror(LEG_LEFT)} fill={C.navy} stroke={C.ink} strokeWidth={2.4} strokeLinejoin="round" />
          <path d="M106,250 H125 M135,250 H154" stroke={C.gold} strokeWidth={5} strokeLinecap="round" />
          <ellipse cx={113} cy={270} rx={22} ry={11} fill={C.navy} stroke={C.ink} strokeWidth={2.4} />
          <ellipse cx={147} cy={270} rx={22} ry={11} fill={C.navy} stroke={C.ink} strokeWidth={2.4} />
          <path d="M98,266 Q106,262 114,264" stroke={C.navyLight} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />

          {/* Badan DNA */}
          <ellipse cx={CX} cy={178} rx={24} ry={13} fill={C.white} />
          <ellipse cx={CX} cy={206} rx={24} ry={13} fill={C.white} />
          <path d="M114,173 H146 M112,183 H148 M112,201 H148 M114,211 H146" stroke={C.purple} strokeWidth={5} strokeLinecap="round" />
          {ribbon(DNA_GREEN, C.green)}
          {ribbon(DNA_GOLD, C.gold)}

          {/* Kepala */}
          <path d={HEAD} fill={C.navy} stroke={C.ink} strokeWidth={2.6} strokeLinejoin="round" />
          <ellipse cx={CX} cy={79} rx={46} ry={6} fill={C.navyLight} opacity={0.75} />
          <path d="M102,100 C102,120 106,136 114,148" stroke={C.navyLight} strokeWidth={4.5} strokeLinecap="round" opacity={0.45} fill="none" />

          {/* Wajah */}
          <g ref={browsRef}>{browsArt}</g>
          <g ref={eyesRef}>{eyesArt}</g>
          <ellipse cx={100} cy={131} rx={7} ry={5} fill={C.cheek} opacity={cfg.eyes === "half" ? 0.55 : 1} />
          <ellipse cx={160} cy={131} rx={7} ry={5} fill={C.cheek} opacity={cfg.eyes === "half" ? 0.55 : 1} />
          <g ref={mouthRef}>{mouthArt}</g>

          {cfg.extras.includes("sweat") && (
            <g ref={sweatRef}>
              <path d="M172,92 C176,99 177,103 172,106 C167,103 168,99 172,92 Z" fill={C.sky} stroke={C.ink} strokeWidth={1.4} />
            </g>
          )}
        </g>

        {/* Lengan kiri */}
        <g ref={leftArmRef}>
          {arm(ARM_LEFT[cfg.left])}
          {leftHand}
        </g>

        {/* Lengan kanan */}
        <g ref={rightArmRef}>{rightArm}</g>

        {/* Bintang ber-buku di atas kepala */}
        <g ref={starRef}>
          <polygon points={starPoints(CX, 46, 27, 11.5)} fill={C.gold} stroke={C.goldDeep} strokeWidth={2} strokeLinejoin="round" />
          <polygon points={starPoints(CX, 47, 16, 6.8)} fill={C.green} />
          <path d={`M${CX - 9},48 Q${CX - 4.5},45 ${CX},48 Q${CX + 4.5},45 ${CX + 9},48 V57 Q${CX + 4.5},54 ${CX},57 Q${CX - 4.5},54 ${CX - 9},57 Z`} fill={C.gold} stroke={C.goldDeep} strokeWidth={1.3} strokeLinejoin="round" />
          <path d={`M${CX},48 V57`} stroke={C.goldDeep} strokeWidth={1.2} />
        </g>

        {cfg.extras.includes("sparkles") &&
          SPARKLES.map(([x, y], i) => (
            <polygon
              key={i}
              ref={(el) => {
                sparkleRefs.current[i] = el;
              }}
              points={starPoints(x, y, 8, 2.6, 4)}
              fill={C.gold}
              stroke={C.goldDeep}
              strokeWidth={1}
            />
          ))}

        {cfg.extras.includes("zzz") &&
          ZZZ.map(([x, y, size], i) => (
            <text
              key={i}
              ref={(el) => {
                zzzRefs.current[i] = el;
              }}
              x={x}
              y={y}
              fontSize={size}
              fontWeight={800}
              fontFamily="Montserrat, sans-serif"
              fill={C.navy}
            >
              Z
            </text>
          ))}
      </g>
    </svg>
  );
}
