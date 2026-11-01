import type { AppRole } from "./auth";

export type Role = AppRole;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
