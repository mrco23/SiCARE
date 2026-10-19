export interface LoginForm {
  nim: string;
  password: string;
}

export interface RegisterForm {
  // Akun
  nim: string;
  password: string;
  confirmPassword: string;
  // Data pribadi
  fullName: string;
  gender: string;
  age: string;
  phone: string;
  ethnicity: string;
  religion: string;
  address: string;
  maritalStatus: string;
  occupation: string;
  // Akademik & keluarga
  faculty: string;
  studyProgram: string;
  education: string;
  childOrder: string;
  siblingsCount: string;
}

export type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;
