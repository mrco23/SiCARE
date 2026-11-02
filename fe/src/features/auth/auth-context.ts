import { createContext } from "react";
import type {
  AuthProfile,
  AuthUser,
  RegisterRequest,
} from "../../types/auth";

export interface AuthContextValue {
  user: AuthUser | null;
  profile: AuthProfile | null;
  loading: boolean;
  authError: string | null;
  signIn: (identifier: string, password: string) => Promise<AuthProfile>;
  signUp: (input: RegisterRequest) => Promise<{
    emailConfirmationRequired: boolean;
    profile: AuthProfile | null;
  }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<AuthProfile | null>;
  resendConfirmation: (email: string) => Promise<{ sent: boolean; message: string }>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
