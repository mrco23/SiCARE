export type Role = "CLIENT" | "COUNSELOR" | "ADMIN" | "HEAD_LMI";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
