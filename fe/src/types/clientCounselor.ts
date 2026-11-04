export type ClientCounselorKey = "GY" | "RW";

export interface ClientCounselorIdentity {
  entityId: string;
  id: number;
  key: ClientCounselorKey;
  name: string;
  historyName: string;
  initials: string;
}

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
  photoUrl?: string | null;
  about: string;
  education: CounselorEducation[];
  experience: string;
  topics: string[];
  schedule: Record<string, string[]>;
}

export interface BookingCounselor extends ClientCounselorIdentity {
  profileId?: string;
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

