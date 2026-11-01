export interface LoginForm {
  identifier: string;
  password: string;
}

export type AppRole = "client" | "counselor" | "admin" | "head_lmi";
export type MemberCategory = "student" | "faculty_staff" | "other";

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthProfile {
  id: string;
  identity_code: string | null;
  full_name: string;
  app_role: AppRole;
  member_category: MemberCategory | null;
  account_status: "pending" | "active" | "disabled";
  phone_e164?: string | null;
  whatsapp_opt_in?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthMeResponse {
  user: AuthUser;
  profile: AuthProfile;
}

export interface AuthLoginResponse extends AuthMeResponse {
  session: {
    access_token: string;
    refresh_token: string;
  };
}

export interface AuthRegisterResponse {
  user: AuthUser | null;
  session: {
    access_token: string;
    refresh_token: string;
  } | null;
  email_confirmation_required: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  identity_code: string;
  member_category: MemberCategory;
  phone_e164: string;
}
