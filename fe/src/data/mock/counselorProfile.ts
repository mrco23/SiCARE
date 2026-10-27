import type { CounselorProfile } from "../../types/counselorProfile";

/** Initial profile form values for the counselor demo; not a persisted user profile. */
export const INITIAL_COUNSELOR_PROFILE: CounselorProfile = {
  photo: "/gio.jpeg",
  displayName: "Giovanna Yudi, S.Psi., M.Psi., Psikolog",
  bio: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  experienceStartYear: "2021",
  educations: [
    {
      id: 1,
      school: "Universitas Surabaya",
      year: "2018",
      major: "Sarjana Psikologi",
    },
    {
      id: 2,
      school: "Universitas Surabaya",
      year: "2021",
      major: "Magister Psikologi Profesi",
    },
  ],
  topics: ["Karir", "Pengembangan Diri", "Motivasi", "Stres", "Relasi", "Keluarga"],
  phone: "081234567890",
  services: { individual: true, group: true },
};
