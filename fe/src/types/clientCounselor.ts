export type ClientCounselorKey = "GY" | "RW";

export interface ClientCounselorIdentity {
  entityId: string;
  id: number;
  key: ClientCounselorKey;
  name: string;
  historyName: string;
  initials: string;
}

export interface CounselorEducation {
  school: string;
  year: string;
  degree: string;
}

/** Satu slot ketersediaan bertanggal untuk direktori konselor (label dalam WITA). */
export interface CounselorUpcomingSlot {
  id: string;
  startsAt: string;
  /** Kunci tanggal WITA "YYYY-MM-DD" untuk pengelompokan. */
  dateKey: string;
  /** Contoh: "Sen, 30 Nov". */
  dateLabel: string;
  /** Contoh: "09.00–10.00". */
  timeLabel: string;
}

export interface ClientDirectoryCounselor extends ClientCounselorIdentity {
  photoUrl?: string | null;
  /** Bidang/judul singkat konselor (headline profil); kosong bila belum diisi. */
  headline: string;
  /** Deskripsi profil (bio); kosong bila belum diisi. */
  bio: string;
  education: CounselorEducation[];
  /** Mis. "5 Tahun"; null bila belum diisi atau 0 tahun. */
  experience: string | null;
  topics: string[];
  /** Slot tersedia yang akan datang, urut dari yang terdekat. */
  upcomingSlots: CounselorUpcomingSlot[];
}

export interface BookingCounselor extends ClientCounselorIdentity {
  profileId?: string;
  photoUrl?: string | null;
  availabilityByDate?: Record<string, string[]>;
  /** Jam selesai tiap ketersediaan: tanggal -> jam mulai -> jam selesai (WITA, "HH.MM"). */
  availabilityEndByDate?: Record<string, Record<string, string>>;
  short: string;
  gender: "Perempuan" | "Laki-laki" | "Tidak dicantumkan";
  degree: string;
  experience: string;
  room: string;
  focus: string;
  about: string;
  skills: string[];
  schedule: Record<string, string[]>;
}

