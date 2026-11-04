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

