/** Satu baris counselor_educations; `id` kosong untuk draf yang belum disimpan. */
export type CounselorEducation = {
  id: string;
  school: string;
  year: string;
  major: string;
};

export type CounselorProfile = {
  photo: string | null;
  displayName: string;
  headline?: string;
  bio: string;
  experienceStartYear: string;
  topics: string[];
  phone: string;
};

export type CounselorProfileErrors = Record<string, string>;
