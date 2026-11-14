import type { ReactNode, SVGProps } from "react";

/*
 * Ikon Mood Tracker SiCARE.
 * - MoodAnswerIcon: versi mini maskot Psi. Posisi "lengan" Psi = tingkat energi
 *   (terangkat = tinggi, terkulai = rendah), ekspresi wajah = perasaan, properti kecil = konteks.
 * - MoodResultIcon: ikon cuaca hati untuk badge hasil.
 * Semua dekoratif (aria-hidden); teks jawaban/badge tetap menjadi label yang dibaca.
 */

export type MoodAnswerIconId =
  | "wake-fresh" | "wake-ready" | "wake-heavy" | "wake-exhausted"
  | "free-sport" | "free-walk" | "free-scroll" | "free-idle"
  | "task-focus" | "task-steady" | "task-distracted" | "task-stuck"
  | "invite-yes" | "invite-short" | "invite-later" | "invite-no"
  | "news-cheer" | "news-smile" | "news-flat" | "news-uneasy"
  | "change-chill" | "change-ok" | "change-worry" | "change-pressure"
  | "feel-happy" | "feel-okay" | "feel-anxious" | "feel-sad"
  | "status-great" | "status-fine" | "status-heavy" | "status-notok";

export type MoodResultIconId = "ceria" | "tenang" | "tegang" | "lelah" | "seimbang";

type Energy = 2 | 1 | -1 | -2;
type Face =
  | "joy" | "grin" | "smile" | "blush" | "calm" | "neutral" | "blank" | "sleepy" | "asleep"
  | "determined" | "dizzy" | "melt" | "party" | "annoyed" | "cool" | "sweatSmile" | "worried"
  | "distressed" | "anxious" | "sad" | "starry" | "pleading" | "heartbroken" | "firm" | "apologetic";
type Prop =
  | "sun" | "zzz" | "motion" | "chat" | "phone" | "sofa" | "fire" | "hourglass" | "swirl"
  | "puddle" | "cheer" | "check" | "clock" | "no" | "confetti" | "sweat" | "thought"
  | "sparkle" | "tear" | "heartbreak";

const SPECS: Record<MoodAnswerIconId, { energy: Energy; face: Face; prop?: Prop }> = {
  "wake-fresh": { energy: 2, face: "joy", prop: "sun" },
  "wake-ready": { energy: 1, face: "smile" },
  "wake-heavy": { energy: -1, face: "sleepy" },
  "wake-exhausted": { energy: -2, face: "asleep", prop: "zzz" },
  "free-sport": { energy: 2, face: "grin", prop: "motion" },
  "free-walk": { energy: 1, face: "smile", prop: "chat" },
  "free-scroll": { energy: -1, face: "neutral", prop: "phone" },
  "free-idle": { energy: -2, face: "blank", prop: "sofa" },
  "task-focus": { energy: 2, face: "determined", prop: "fire" },
  "task-steady": { energy: 1, face: "calm", prop: "hourglass" },
  "task-distracted": { energy: -1, face: "dizzy", prop: "swirl" },
  "task-stuck": { energy: -2, face: "melt", prop: "puddle" },
  "invite-yes": { energy: 2, face: "grin", prop: "cheer" },
  "invite-short": { energy: 1, face: "smile", prop: "check" },
  "invite-later": { energy: -1, face: "apologetic", prop: "clock" },
  "invite-no": { energy: -2, face: "firm", prop: "no" },
  "news-cheer": { energy: 2, face: "party", prop: "confetti" },
  "news-smile": { energy: 1, face: "blush" },
  "news-flat": { energy: -1, face: "neutral" },
  "news-uneasy": { energy: -2, face: "annoyed" },
  "change-chill": { energy: 2, face: "cool" },
  "change-ok": { energy: 1, face: "sweatSmile", prop: "sweat" },
  "change-worry": { energy: -1, face: "worried", prop: "thought" },
  "change-pressure": { energy: -2, face: "distressed" },
  "feel-happy": { energy: 2, face: "joy", prop: "sparkle" },
  "feel-okay": { energy: 1, face: "calm" },
  "feel-anxious": { energy: -1, face: "anxious", prop: "sweat" },
  "feel-sad": { energy: -2, face: "sad", prop: "tear" },
  "status-great": { energy: 2, face: "starry" },
  "status-fine": { energy: 1, face: "smile" },
  "status-heavy": { energy: -1, face: "pleading" },
  "status-notok": { energy: -2, face: "heartbroken", prop: "heartbreak" },
};

/* Warna maskot SiCARE (navy, emas, hijau DNA) + aksen lembut. */
const C = {
  navy: "#1B3A7A",
  ink: "#0F2452",
  gold: "#F2B53A",
  goldDeep: "#B8862A",
  green: "#127A45",
  leaf: "#2A8F5A",
  purple: "#6A2C8F",
  pink: "#F07A86",
  cheek: "#F59AA3",
  sky: "#6EC1E4",
  pupil: "#0B1530",
  white: "#FFFFFF",
  mist: "#E7ECF3",
  slate: "#5F6B7A",
};

const round = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/* ---------- Lengan Psi (sayap) per tingkat energi ---------- */

const WING: Record<Energy, { d: string; tip: [number, number] }> = {
  2: { d: "M26,38 C16,38 9,28 10,13", tip: [10, 13] },
  1: { d: "M26,38 C16,39 9,32 7,24", tip: [7, 24] },
  [-1]: { d: "M26,38 C17,39 11,38 6,40", tip: [6, 40] },
  [-2]: { d: "M26,39 C20,40 16.5,45 17,53", tip: [17, 53] },
};

function mirrorPath(d: string) {
  return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${64 - Number(x)},${y}`);
}

function Wings({ energy }: { energy: Energy }) {
  const { d, tip } = WING[energy];
  const right = mirrorPath(d);
  return (
    <g fill="none" {...round}>
      {[d, right].map((path) => (
        <g key={path}>
          <path d={path} stroke={C.ink} strokeWidth={8.6} />
          <path d={path} stroke={C.navy} strokeWidth={6.6} />
          <path d={path} stroke={C.gold} strokeWidth={1.8} />
        </g>
      ))}
      {[tip, [64 - tip[0], tip[1]] as [number, number]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={3.6} fill={C.white} stroke={C.ink} strokeWidth={1.1} />
      ))}
    </g>
  );
}

function Body() {
  return (
    <g>
      <ellipse cx={27} cy={53.6} rx={4.8} ry={2.9} fill={C.navy} stroke={C.ink} strokeWidth={1} />
      <ellipse cx={37} cy={53.6} rx={4.8} ry={2.9} fill={C.navy} stroke={C.ink} strokeWidth={1} />
      <path
        d="M20,16.5 C24,14.5 40,14.5 44,16.5 C44,18.5 42,19.5 41,20 C40.5,30 39.5,41 38.5,50.5 L25.5,50.5 C24.5,41 23.5,30 23,20 C22,19.5 20,18.5 20,16.5 Z"
        fill={C.navy}
        stroke={C.ink}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <path d="M25.8,49.6 H30 M34,49.6 H38.2" stroke={C.gold} strokeWidth={1.6} {...round} />
      <path d="M28.4,36.5 C35.6,40 28.4,45 35.6,48.6" stroke={C.gold} strokeWidth={1.9} fill="none" {...round} />
      <path d="M35.6,36.5 C28.4,40 35.6,45 28.4,48.6" stroke={C.green} strokeWidth={1.9} fill="none" {...round} />
      <polygon points={starPoints(32, 9, 5.5, 2.4)} fill={C.gold} stroke={C.goldDeep} strokeWidth={0.8} strokeLinejoin="round" />
    </g>
  );
}

/* ---------- Ekspresi wajah ---------- */

const EYE_L = 28;
const EYE_R = 36;
const EYE_Y = 24.5;

const eyeOpen = (x: number) => (
  <g key={`o${x}`}>
    <ellipse cx={x} cy={EYE_Y} rx={2.6} ry={3} fill={C.white} />
    <circle cx={x + 0.3} cy={EYE_Y + 0.4} r={1.6} fill={C.pupil} />
    <circle cx={x + 0.85} cy={EYE_Y - 0.35} r={0.6} fill={C.white} />
  </g>
);
const eyeHappy = (x: number) => (
  <path key={`h${x}`} d={`M${x - 2.4},${EYE_Y + 0.9} Q${x},${EYE_Y - 2.3} ${x + 2.4},${EYE_Y + 0.9}`} stroke={C.white} strokeWidth={1.7} fill="none" {...round} />
);
const eyeClosed = (x: number) => (
  <path key={`c${x}`} d={`M${x - 2.4},${EYE_Y - 0.3} Q${x},${EYE_Y + 2.1} ${x + 2.4},${EYE_Y - 0.3}`} stroke={C.white} strokeWidth={1.7} fill="none" {...round} />
);
const eyeHalf = (x: number) => (
  <g key={`f${x}`}>
    <ellipse cx={x} cy={EYE_Y + 0.6} rx={2.6} ry={2.2} fill={C.white} />
    <circle cx={x + 0.3} cy={EYE_Y + 1.2} r={1.4} fill={C.pupil} />
    <path d={`M${x - 2.9},${EYE_Y + 0.3} H${x + 2.9}`} stroke={C.white} strokeWidth={1.4} {...round} />
    <rect x={x - 3.2} y={EYE_Y - 3} width={6.4} height={3.2} fill={C.navy} />
  </g>
);
const eyeSpiral = (x: number) => (
  <path
    key={`s${x}`}
    d={`M${x},${EYE_Y} m-0.6,0 a0.6,0.6 0 1 1 1.2,0 a1.4,1.4 0 1 1 -2.6,0.2 a2.2,2.2 0 1 1 4.2,-0.6`}
    stroke={C.white}
    strokeWidth={1.1}
    fill="none"
    {...round}
  />
);
const eyeSquint = (x: number, dir: 1 | -1) => (
  <path key={`q${x}`} d={`M${x - 1.8 * dir},${EYE_Y - 2} L${x + 1.6 * dir},${EYE_Y} L${x - 1.8 * dir},${EYE_Y + 2}`} stroke={C.white} strokeWidth={1.7} fill="none" {...round} />
);
const eyeStar = (x: number) => (
  <polygon key={`t${x}`} points={starPoints(x, EYE_Y, 3.3, 1.45)} fill={C.gold} stroke={C.white} strokeWidth={0.5} strokeLinejoin="round" />
);
const eyeBig = (x: number) => (
  <g key={`b${x}`}>
    <ellipse cx={x} cy={EYE_Y + 0.2} rx={2.9} ry={3.3} fill={C.white} />
    <circle cx={x + 0.2} cy={EYE_Y + 0.6} r={2.2} fill={C.pupil} />
    <circle cx={x + 0.9} cy={EYE_Y - 0.4} r={0.8} fill={C.white} />
    <circle cx={x - 0.6} cy={EYE_Y + 1.5} r={0.45} fill={C.white} />
  </g>
);

const cheeks = (r = 1.6) => (
  <g key="ck" fill={C.cheek}>
    <circle cx={25.4} cy={29} r={r} />
    <circle cx={38.6} cy={29} r={r} />
  </g>
);

const line = (d: string, w = 1.7) => <path key={d} d={d} stroke={C.white} strokeWidth={w} fill="none" {...round} />;
const fillMouth = (d: string) => <path key={d} d={d} fill={C.pink} stroke={C.ink} strokeWidth={0.6} strokeLinejoin="round" />;

const BROWS = {
  worried: line("M25.8,21.4 L29.6,20.2 M38.2,21.4 L34.4,20.2", 1.3),
  angry: line("M25.8,20.2 L29.8,21.6 M38.2,20.2 L34.2,21.6", 1.4),
  flat: line("M26,20.8 H29.8 M34.2,20.8 H38", 1.3),
};

const MOUTH = {
  open: fillMouth("M28.4,29.4 Q32,35.6 35.6,29.4 Z"),
  grin: fillMouth("M27.6,29 Q32,37 36.4,29 Z"),
  smile: line("M29,30.2 Q32,33.4 35,30.2"),
  small: line("M30,30.6 Q32,32.2 34,30.6"),
  flat: line("M29.6,31 H34.4"),
  slant: line("M29.6,31.7 L34.6,30.6"),
  frown: line("M29.2,32.4 Q32,29.6 34.8,32.4"),
  smallFrown: line("M30,32 Q32,30.6 34,32"),
  wavy: line("M28.8,31.4 Q30.4,30 32,31.4 Q33.6,32.8 35.2,31.4", 1.5),
  zigzag: line("M28.8,31.6 L30.4,30.4 L32,31.6 L33.6,30.4 L35.2,31.6", 1.5),
  o: <circle key="mo" cx={32} cy={31.2} r={1.4} fill={C.pink} stroke={C.ink} strokeWidth={0.5} />,
};

const sunglasses = (
  <g key="sg">
    <path
      d="M24.4,22.4 H39.6 V24 Q39.6,27.6 36.2,27.6 Q33.1,27.6 32.8,24.4 H31.2 Q30.9,27.6 27.8,27.6 Q24.4,27.6 24.4,24 Z"
      fill={C.pupil}
      stroke={C.gold}
      strokeWidth={0.7}
      strokeLinejoin="round"
    />
    <path d="M26.2,23.6 L27.6,25.2 M34.2,23.6 L35.6,25.2" stroke={C.white} strokeWidth={0.8} {...round} />
  </g>
);

function FaceArt({ face }: { face: Face }) {
  const both = (fn: (x: number) => ReactNode) => [fn(EYE_L), fn(EYE_R)];
  const parts: Record<Face, ReactNode[]> = {
    joy: [...both(eyeOpen), MOUTH.open, cheeks()],
    grin: [...both(eyeHappy), MOUTH.grin, cheeks()],
    smile: [...both(eyeOpen), MOUTH.smile, cheeks(1.3)],
    blush: [...both(eyeHappy), MOUTH.smile, cheeks(2)],
    calm: [...both(eyeClosed), MOUTH.small, cheeks(1.3)],
    neutral: [...both(eyeOpen), MOUTH.flat],
    blank: [...both(eyeHalf), MOUTH.flat],
    sleepy: [...both(eyeHalf), MOUTH.o],
    asleep: [...both(eyeClosed), MOUTH.o],
    determined: [BROWS.angry, ...both(eyeOpen), MOUTH.smile],
    dizzy: [...both(eyeSpiral), MOUTH.wavy],
    melt: [...both(eyeOpen), MOUTH.wavy, cheeks(1.3)],
    party: [...both(eyeHappy), MOUTH.grin, cheeks()],
    annoyed: [BROWS.flat, ...both(eyeHalf), MOUTH.slant],
    cool: [sunglasses, MOUTH.smile],
    sweatSmile: [...both(eyeHappy), MOUTH.open, cheeks(1.3)],
    worried: [BROWS.worried, ...both(eyeOpen), MOUTH.frown],
    distressed: [eyeSquint(EYE_L, 1), eyeSquint(EYE_R, -1), MOUTH.zigzag],
    anxious: [BROWS.worried, ...both(eyeOpen), MOUTH.wavy],
    sad: [BROWS.worried, ...both(eyeOpen), MOUTH.frown],
    starry: [...both(eyeStar), MOUTH.grin, cheeks()],
    pleading: [BROWS.worried, ...both(eyeBig), MOUTH.smallFrown],
    heartbroken: [BROWS.worried, ...both(eyeClosed), MOUTH.frown],
    firm: [BROWS.flat, ...both(eyeOpen), MOUTH.flat],
    apologetic: [...both(eyeHappy), MOUTH.small, cheeks(1.3)],
  };
  return <g>{parts[face]}</g>;
}

/* ---------- Properti kecil ---------- */

const BEHIND: Prop[] = ["sofa", "puddle"];

function PropArt({ prop }: { prop: Prop }) {
  switch (prop) {
    case "sun":
      return (
        <g {...round}>
          <circle cx={52} cy={12} r={3.6} fill={C.gold} />
          <path d="M52,4.6 V6.4 M52,17.6 V19.4 M44.6,12 H46.4 M57.6,12 H59.4 M46.8,6.8 L48,8 M56,16 L57.2,17.2 M46.8,17.2 L48,16 M56,8 L57.2,6.8" stroke={C.gold} strokeWidth={1.5} />
        </g>
      );
    case "zzz":
      return (
        <g fill="none" stroke={C.ink} {...round}>
          <path d="M45.5,8 H51 L45.5,13.5 H51" strokeWidth={1.6} />
          <path d="M53,2.5 H56.6 L53,6.1 H56.6" strokeWidth={1.2} />
        </g>
      );
    case "motion":
      return <path d="M2.5,40 H8 M1.5,44.5 H6.5 M3.5,49 H8.5" stroke={C.slate} strokeWidth={1.5} {...round} />;
    case "chat":
      return (
        <g>
          <path d="M46,3.5 H58.5 Q60.5,3.5 60.5,5.5 V11 Q60.5,13 58.5,13 H51 L48,15.8 V13 H46 Q44,13 44,11 V5.5 Q44,3.5 46,3.5 Z" fill={C.white} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
          <circle cx={48.6} cy={8.3} r={0.95} fill={C.leaf} />
          <circle cx={52.2} cy={8.3} r={0.95} fill={C.leaf} />
          <circle cx={55.8} cy={8.3} r={0.95} fill={C.leaf} />
        </g>
      );
    case "phone":
      return (
        <g>
          <rect x={46.5} y={25.5} width={8} height={12.5} rx={1.6} fill={C.ink} />
          <rect x={47.7} y={27} width={5.6} height={8.4} rx={0.6} fill={C.sky} />
          <circle cx={50.5} cy={36.8} r={0.5} fill={C.white} />
        </g>
      );
    case "sofa":
      return (
        <g>
          <rect x={10} y={44.5} width={44} height={8} rx={4} fill={C.leaf} opacity={0.55} />
          <rect x={8} y={50} width={48} height={8} rx={3.5} fill={C.leaf} />
        </g>
      );
    case "fire":
      return (
        <g>
          <path d="M52,3.5 C55.4,7.6 57.4,10 56.4,14 C55.8,16.8 54,18.4 52,18.4 C50,18.4 47.8,16.8 47.8,14 C47.8,11.4 49.8,10.4 49.8,7.8 C51.4,8.8 52.4,10.2 52,3.5 Z" fill="#F28C28" />
          <path d="M52,10.5 C53.6,12.6 54.4,13.8 53.8,15.4 C53.4,16.6 52.7,17 52,17 C51.1,17 50.2,16.3 50.2,15.2 C50.2,14 51.2,13.4 51.1,12 C51.6,12.4 52.1,12.9 52,10.5 Z" fill={C.gold} />
        </g>
      );
    case "hourglass":
      return (
        <g {...round}>
          <path d="M47.5,4.5 H56.5 M47.5,19.5 H56.5" stroke={C.ink} strokeWidth={1.6} />
          <path d="M48.8,5 H55.2 Q55.2,9.6 52,12 Q55.2,14.4 55.2,19 H48.8 Q48.8,14.4 52,12 Q48.8,9.6 48.8,5 Z" fill={C.white} stroke={C.ink} strokeWidth={1} />
          <path d="M50.2,8 H53.8 Q53.2,10 52,11 Q50.8,10 50.2,8 Z M49.9,18.2 Q50.4,15.6 52,14.8 Q53.6,15.6 54.1,18.2 Z" fill={C.gold} />
        </g>
      );
    case "swirl":
      return (
        <path
          d="M52,11 m-0.8,0 a0.8,0.8 0 1 1 1.6,0 a2,2 0 1 1 -3.6,0.3 a3.2,3.2 0 1 1 6,-0.8 a4.4,4.4 0 1 1 -8.4,1.4"
          stroke={C.purple}
          strokeWidth={1.5}
          fill="none"
          {...round}
        />
      );
    case "puddle":
      return (
        <g fill={C.navy} stroke={C.ink} strokeWidth={0.8}>
          <ellipse cx={32} cy={57} rx={16} ry={3.6} />
          <path d="M20,55.5 Q19,59.5 21,60.5 Q23,59.5 22.4,55.5 Z M43,55.6 Q42.4,58.4 43.8,59.2 Q45.2,58.4 44.8,55.6 Z" />
        </g>
      );
    case "cheer":
      return (
        <g stroke={C.gold} strokeWidth={1.5} {...round}>
          <path d="M3.5,8.5 L5.6,10.2 M2.5,13.5 H5 M6.8,5 L7.8,7.4" />
          <path d="M60.5,8.5 L58.4,10.2 M61.5,13.5 H59 M57.2,5 L56.2,7.4" />
        </g>
      );
    case "check":
      return (
        <g>
          <circle cx={52} cy={11} r={5.6} fill={C.leaf} />
          <path d="M49.4,11.2 L51.3,13.1 L54.8,9.2" stroke={C.white} strokeWidth={1.6} fill="none" {...round} />
        </g>
      );
    case "clock":
      return (
        <g>
          <circle cx={52} cy={11} r={5.6} fill={C.white} stroke={C.ink} strokeWidth={1.3} />
          <path d="M52,8 V11 L54.2,12.4" stroke={C.ink} strokeWidth={1.3} fill="none" {...round} />
        </g>
      );
    case "no":
      return (
        <g>
          <circle cx={52} cy={11} r={5.6} fill={C.mist} stroke={C.slate} strokeWidth={1.1} />
          <path d="M49.8,8.8 L54.2,13.2 M54.2,8.8 L49.8,13.2" stroke={C.slate} strokeWidth={1.5} {...round} />
        </g>
      );
    case "confetti":
      return (
        <g>
          <rect x={5} y={6} width={3} height={1.8} rx={0.6} fill={C.gold} transform="rotate(-25 6.5 7)" />
          <rect x={54} y={4} width={3} height={1.8} rx={0.6} fill={C.purple} transform="rotate(30 55.5 5)" />
          <circle cx={13} cy={20} r={1.2} fill={C.pink} />
          <circle cx={53} cy={19} r={1.2} fill={C.leaf} />
          <rect x={44} y={2} width={2.6} height={1.6} rx={0.5} fill={C.leaf} transform="rotate(15 45.3 2.8)" />
          <circle cx={18} cy={4} r={1} fill={C.purple} />
          <rect x={58} y={13} width={2.6} height={1.6} rx={0.5} fill={C.gold} transform="rotate(-20 59.3 13.8)" />
        </g>
      );
    case "sweat":
      return <path d="M42.2,17.6 C44.2,20.6 44.4,22.2 42.2,23.4 C40,22.2 40.2,20.6 42.2,17.6 Z" fill={C.sky} stroke={C.ink} strokeWidth={0.5} />;
    case "thought":
      return (
        <g fill={C.white} stroke={C.ink} strokeWidth={0.9}>
          <circle cx={45.5} cy={16} r={1.1} />
          <circle cx={48.4} cy={12.6} r={1.7} />
          <path d="M51,9.5 C50,6 53,3.6 55.4,5 C57,2.8 61,4 60.4,7.2 C62.4,8.4 61.4,11.6 58.8,11.4 C57.6,13.4 53.6,13.2 53,11.4 C50.6,12 49.6,10.4 51,9.5 Z" strokeLinejoin="round" />
        </g>
      );
    case "sparkle":
      return <path d="M52,4.5 L53.5,9.5 L58.5,11 L53.5,12.5 L52,17.5 L50.5,12.5 L45.5,11 L50.5,9.5 Z" fill={C.gold} stroke={C.goldDeep} strokeWidth={0.6} strokeLinejoin="round" />;
    case "tear":
      return <path d="M27.6,27.2 C29.2,29.8 29.4,31.2 27.6,32.2 C25.8,31.2 26,29.8 27.6,27.2 Z" fill={C.sky} stroke={C.ink} strokeWidth={0.4} />;
    case "heartbreak":
      return (
        <g>
          <path d="M52,18.4 C45.6,13.8 46,7.6 49.4,7.6 C50.9,7.6 51.8,8.6 52,9.7 C52.2,8.6 53.1,7.6 54.6,7.6 C58,7.6 58.4,13.8 52,18.4 Z" fill={C.pink} stroke={C.ink} strokeWidth={0.7} strokeLinejoin="round" />
          <path d="M52,9.9 L50.9,12.6 L53,14 L52,16.6" stroke={C.white} strokeWidth={1.1} fill="none" {...round} />
        </g>
      );
  }
}

type IconSvgProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

export function MoodAnswerIcon({ id, size = 48, ...props }: IconSvgProps & { id: MoodAnswerIconId }) {
  const spec = SPECS[id];
  const behind = spec.prop && BEHIND.includes(spec.prop);
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" {...props}>
      {behind && spec.prop && <PropArt prop={spec.prop} />}
      <Wings energy={spec.energy} />
      <Body />
      <FaceArt face={spec.face} />
      {!behind && spec.prop && <PropArt prop={spec.prop} />}
    </svg>
  );
}

/* ---------- Ikon cuaca hati untuk badge hasil ---------- */

const CLOUD = "M7,18.5 H17.2 A3.8,3.8 0 0 0 17.4,10.9 A5.4,5.4 0 0 0 7,11.9 A3.3,3.3 0 0 0 7,18.5 Z";

export function MoodResultIcon({ id, size = 18, ...props }: IconSvgProps & { id: MoodResultIconId }) {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, fill: "none", ...round };
  let art: ReactNode;
  switch (id) {
    case "ceria":
      art = (
        <g>
          <circle cx={12} cy={12} r={4.4} fill={C.gold} />
          <path d="M12,2.8 V5 M12,19 V21.2 M2.8,12 H5 M19,12 H21.2 M5.5,5.5 L7,7 M17,17 L18.5,18.5 M5.5,18.5 L7,17 M17,7 L18.5,5.5" stroke={C.gold} strokeWidth={1.7} {...round} />
        </g>
      );
      break;
    case "tenang":
      art = (
        <g>
          <circle cx={9} cy={8.6} r={4} fill={C.gold} />
          <path d={CLOUD} {...stroke} fill={C.white} transform="translate(1.5 1)" />
        </g>
      );
      break;
    case "tegang":
      art = <path d="M3,8.5 H14 A2.6,2.6 0 1 0 11.4,5.9 M3,12.5 H18.5 A2.8,2.8 0 1 1 15.7,15.3 M3,16.5 H10" {...stroke} />;
      break;
    case "lelah":
      art = (
        <g>
          <path d={CLOUD} {...stroke} fill={C.white} transform="translate(0 -3)" />
          <path d="M8,18.5 L7,21 M12,18.5 L11,21 M16,18.5 L15,21" {...stroke} />
        </g>
      );
      break;
    case "seimbang":
      art = (
        <g {...round} fill="none">
          <path d="M3.5,17.5 A8.5,8.5 0 0 1 20.5,17.5" stroke="currentColor" strokeWidth={1.7} />
          <path d="M7,17.5 A5,5 0 0 1 17,17.5" stroke={C.gold} strokeWidth={1.7} />
          <path d="M2.5,20.5 H21.5" stroke="currentColor" strokeWidth={1.7} />
        </g>
      );
      break;
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...props}>
      {art}
    </svg>
  );
}
