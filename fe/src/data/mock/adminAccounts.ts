/** Admin account-management seed. Matching names elsewhere are intentionally not linked without stable shared IDs. */

export type Role =
  | "Konselor"
  | "Mahasiswa"
  | "Dosen"
  | "Staff"
  | "Kepala LMI"
  | "Admin";

export type Account = {
  id: number;
  name: string;
  code: string; // NIM / NIP
  email: string;
  role: Role;
  active: boolean;
  created: string; // ISO (YYYY-MM-DD)
};

export const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 1,
    name: "Giovanna Yudi, M.Psi",
    code: "198705122014",
    email: "giovanna@unikadelasalle.ac.id",
    role: "Konselor",
    active: true,
    created: "2024-08-01",
  },
  {
    id: 2,
    name: "Rico Kornelius Wahani",
    code: "198901042015",
    email: "rico@unikadelasalle.ac.id",
    role: "Konselor",
    active: true,
    created: "2024-08-01",
  },
  {
    id: 3,
    name: "Yusli Ngongano",
    code: "2210011045",
    email: "yusli@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    active: true,
    created: "2025-08-20",
  },
  {
    id: 4,
    name: "Ayu Pratiwi",
    code: "2110022018",
    email: "ayu@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    active: true,
    created: "2025-08-22",
  },
  {
    id: 5,
    name: "Bagas Hermawan",
    code: "197612032005",
    email: "bagas@unikadelasalle.ac.id",
    role: "Dosen",
    active: false,
    created: "2025-09-02",
  },
  {
    id: 6,
    name: "Dr. Maria Kaunang",
    code: "196804151993",
    email: "maria@unikadelasalle.ac.id",
    role: "Kepala LMI",
    active: true,
    created: "2024-07-15",
  },
  {
    id: 7,
    name: "Admin SiCARE",
    code: "-",
    email: "admin@unikadelasalle.ac.id",
    role: "Admin",
    active: true,
    created: "2024-07-01",
  },
  {
    id: 8,
    name: "Chelsea Ngongano",
    code: "2310033077",
    email: "chelsea@mhs.unikadelasalle.ac.id",
    role: "Mahasiswa",
    active: true,
    created: "2025-10-01",
  },
  {
    id: 9,
    name: "Stefanus Lumoindong",
    code: "199203102019",
    email: "stefanus@unikadelasalle.ac.id",
    role: "Staff",
    active: true,
    created: "2025-03-11",
  },
];
