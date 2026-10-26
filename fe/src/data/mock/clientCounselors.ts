export type ClientCounselorKey = "GY" | "RW";

export interface ClientCounselorIdentity {
  /** Stable mock entity key; numeric id is retained for existing UI handlers. */
  entityId: "counselor-giovanna-yudi" | "counselor-rico-kornelius-wahani";
  id: number;
  key: ClientCounselorKey;
  name: string;
  historyName: string;
  initials: string;
}

/**
 * Canonical identity labels for the two named counselors shared by client
 * booking, directory, activity, and history screens. Screen-specific schedules
 * remain separate because the source screens currently disagree.
 */
export const CLIENT_COUNSELOR_IDENTITIES: Record<
  ClientCounselorKey,
  ClientCounselorIdentity
> = {
  GY: {
    entityId: "counselor-giovanna-yudi",
    id: 1,
    key: "GY",
    name: "Giovanna Yudi, S.Psi., M.Psi., Psikolog",
    historyName: "Giovanna Yudi, S.Psi., M.Psi.",
    initials: "GY",
  },
  RW: {
    entityId: "counselor-rico-kornelius-wahani",
    id: 2,
    key: "RW",
    name: "Rico Kornelius Wahani, S.Psi., M.Psi., Psikolog",
    historyName: "Rico Kornelius Wahani, S.Psi., M.Psi.",
    initials: "RW",
  },
};

export interface CounselorEducation {
  school: string;
  year: string;
  degree: string;
}

export interface ClientDirectoryCounselor extends ClientCounselorIdentity {
  about: string;
  education: CounselorEducation[];
  experience: string;
  topics: string[];
  schedule: Record<string, string[]>;
}

const DIRECTORY_ABOUT =
  "Informasi singkat mengenai konselor belum tersedia. Silakan lihat pendidikan, pengalaman, topik keahlian, dan jadwal konseling berikut.";
const DIRECTORY_TOPICS = [
  "Karir",
  "Pengembangan Diri",
  "Motivasi",
  "Stres",
  "Relasi",
  "Keluarga",
  "Konflik",
  "Kesiapan Kerja",
];
const DIRECTORY_EDUCATION: CounselorEducation[] = [
  {
    school: "Universitas Surabaya",
    year: "2018",
    degree: "Sarjana Psikologi",
  },
  {
    school: "Universitas Surabaya",
    year: "2021",
    degree: "Magister Psikologi Profesi",
  },
];
const DIRECTORY_SCHEDULE: Record<string, string[]> = {
  Senin: [],
  Selasa: ["14.00–15.00", "15.00–16.00"],
  Rabu: ["09.00–10.00", "10.00–11.00"],
  Kamis: ["14.00–15.00", "15.00–16.00"],
  Jumat: [],
};

export const CLIENT_DIRECTORY_COUNSELORS: ClientDirectoryCounselor[] = [
  {
    ...CLIENT_COUNSELOR_IDENTITIES.GY,
    about: DIRECTORY_ABOUT,
    education: DIRECTORY_EDUCATION.map((item) => ({ ...item })),
    experience: "5 Tahun",
    topics: [...DIRECTORY_TOPICS],
    schedule: Object.fromEntries(
      Object.entries(DIRECTORY_SCHEDULE).map(([day, slots]) => [day, [...slots]]),
    ),
  },
  {
    ...CLIENT_COUNSELOR_IDENTITIES.RW,
    about: DIRECTORY_ABOUT,
    education: DIRECTORY_EDUCATION.map((item) => ({ ...item })),
    experience: "5 Tahun",
    topics: [...DIRECTORY_TOPICS],
    schedule: Object.fromEntries(
      Object.entries(DIRECTORY_SCHEDULE).map(([day, slots]) => [day, [...slots]]),
    ),
  },
];

export interface BookingCounselor extends ClientCounselorIdentity {
  short: string;
  gender: "Perempuan" | "Laki-laki";
  degree: string;
  experience: string;
  room: string;
  focus: string;
  about: string;
  skills: string[];
  schedule: Record<string, string[]>;
}

/** Booking has a different schedule fixture than the directory; keep it explicit. */
export const CLIENT_BOOKING_COUNSELORS: BookingCounselor[] = [
  {
    ...CLIENT_COUNSELOR_IDENTITIES.GY,
    short: "Giovanna Yudi,\nS.Psi., M.Psi.",
    gender: "Perempuan",
    degree: "S2 Psikolog",
    experience: "5 tahun pengalaman",
    room: "Ruang Konseling 01",
    focus:
      "Fokus pada pengembangan diri, manajemen stres, dan penanganan kecemasan.",
    about:
      "Berpengalaman dalam konseling individu dan kelompok dengan fokus pada pengelolaan stres, kecemasan, masalah hubungan, dan pengembangan diri.",
    skills: [
      "Kecemasan",
      "Stres",
      "Masalah Hubungan",
      "Manajemen Emosi",
      "Pengembangan Diri",
    ],
    schedule: {
      Senin: ["08:00 - 10:00", "14:00 - 15:00"],
      Selasa: ["08:00 - 10:00", "13:00 - 14:00"],
      Rabu: [],
      Kamis: ["08:00 - 10:00", "14:00 - 15:00"],
      Jumat: ["08:00 - 10:00"],
    },
  },
  {
    ...CLIENT_COUNSELOR_IDENTITIES.RW,
    short: "Rico Kornelius\nWahani, S.Psi.,\nM.Psi., Psikolog",
    gender: "Laki-laki",
    degree: "S2 Psikolog",
    experience: "5 tahun pengalaman",
    room: "Ruang Konseling 02",
    focus: "Fokus pada pengembangan diri, manajemen stres, dan kecemasan.",
    about:
      "Berpengalaman mendampingi mahasiswa dan staf dalam mengelola stres kerja, kecemasan akademik, dan pengembangan diri.",
    skills: ["Kecemasan", "Stres", "Pengembangan Diri"],
    schedule: {
      Senin: ["09:00 - 10:00"],
      Selasa: [],
      Rabu: ["10:00 - 11:00"],
      Kamis: ["13:00 - 14:00"],
      Jumat: ["08:00 - 10:00", "14:00 - 15:00"],
    },
  },
];

export interface PublicCounselorEducation {
  school: string;
  year: string;
  major: string;
}

export interface PublicCounselorSchedule {
  day: string;
  slots: string[];
}

export interface PublicCounselorProfile {
  entityId: ClientCounselorIdentity["entityId"];
  id: number;
  name: string;
  photo: string;
  description: string;
  experience: string;
  education: PublicCounselorEducation[];
  topics: string[];
  schedule: PublicCounselorSchedule[];
}

const PUBLIC_COUNSELOR_DESCRIPTION =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
const WEEKDAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"] as const;

export const PUBLIC_COUNSELOR_PROFILES: PublicCounselorProfile[] =
  CLIENT_DIRECTORY_COUNSELORS.map((counselor) => ({
    entityId: counselor.entityId,
    id: counselor.id,
    name: counselor.name,
    photo: counselor.key === "GY" ? "/gio.jpeg" : "/rico.png",
    description: PUBLIC_COUNSELOR_DESCRIPTION,
    experience: counselor.experience,
    education: counselor.education.map(({ school, year, degree }) => ({
      school,
      year,
      major: degree,
    })),
    topics: [...counselor.topics],
    schedule: WEEKDAYS.map((day) => ({
      day,
      slots: [...(counselor.schedule[day] ?? [])],
    })),
  }));

export const CLIENT_HISTORY_COUNSELORS = {
  GY: {
    name: CLIENT_COUNSELOR_IDENTITIES.GY.historyName,
    initials: CLIENT_COUNSELOR_IDENTITIES.GY.initials,
    degree: "S2 Psikolog",
  },
  RW: {
    name: CLIENT_COUNSELOR_IDENTITIES.RW.historyName,
    initials: CLIENT_COUNSELOR_IDENTITIES.RW.initials,
    degree: "S2 Psikolog",
  },
} as const;

export type ClientHistoryCounselor = (typeof CLIENT_HISTORY_COUNSELORS)[ClientCounselorKey];

export const CLIENT_ACTIVITY_COUNSELOR_SCHEDULE: Record<
  string,
  Record<number, string[]>
> = {
  [CLIENT_COUNSELOR_IDENTITIES.GY.historyName]: {
    2: ["14.00-15.00", "15.00-16.00"],
    3: ["09.00-10.00", "10.00-11.00"],
    4: ["14.00-15.00", "15.00-16.00"],
  },
  [CLIENT_COUNSELOR_IDENTITIES.RW.historyName]: {
    2: ["14.00-15.00", "15.00-16.00"],
    3: ["09.00-10.00", "10.00-11.00"],
    4: ["14.00-15.00", "15.00-16.00"],
  },
};
