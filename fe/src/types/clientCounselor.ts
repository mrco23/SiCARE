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

export interface ClientDirectoryCounselor extends ClientCounselorIdentity {
  photoUrl?: string | null;
  about: string;
  education: CounselorEducation[];
  experience: string;
  topics: string[];
  schedule: Record<string, string[]>;
}

export interface BookingCounselor extends ClientCounselorIdentity {
  profileId?: string;
  photoUrl?: string | null;
  availabilityByDate?: Record<string, string[]>;
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

