import type { AuthProfile } from "../../types/auth";

export function getRoleHomePath(role: AuthProfile["app_role"]): string {
  switch (role) {
    case "client":
      return "/klien";
    case "counselor":
      return "/konselor";
    case "admin":
      return "/admin";
    case "head_lmi":
      return "/kepala-lmi";
  }
}
