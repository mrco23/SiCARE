import { createContext, useContext } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastApi {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

/** Akses toast global; harus dipakai di dalam `<ToastProvider>`. */
export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast harus dipakai di dalam <ToastProvider>.");
  }
  return context;
}
