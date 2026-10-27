export type CounselorEducation = {
  id: number;
  school: string;
  year: string;
  major: string;
};

export type CounselorProfile = {
  photo: string | null;
  displayName: string;
  bio: string;
  experienceStartYear: string;
  educations: CounselorEducation[];
  topics: string[];
  phone: string;
  services: { individual: boolean; group: boolean };
};

export type CounselorProfileErrors = Record<string, string>;
