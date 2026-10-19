import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import AuthBackground from "./AuthBackground";

interface CenteredAuthLayoutProps {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
  /** Lebar form. */
  wide?: boolean;
}

export default function CenteredAuthLayout({
  title,
  subtitle,
  footer,
  children,
  wide = false,
}: CenteredAuthLayoutProps) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg">
      <AuthBackground />

      <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
          {/* Logo */}
          <Link to="/" className="mb-6 flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-[1.5px] border-[#c9a54a] bg-white shadow-sm">
              <img
                src="/android-192x192.png"
                alt="Logo Universitas Katolik De La Salle Manado"
                className="h-12 w-12 rounded-full object-contain"
              />
            </div>
            <span className="text-2xl font-semibold leading-none tracking-tight">
              <span className="text-primary">Si</span>
              <span className="text-blue-900">CARE</span>
            </span>
          </Link>

          <header className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-text-base md:text-3xl">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-text-muted md:text-base">
              {subtitle}
            </p>
          </header>

          {/* Kartu form: sedikit transparan agar dekorasi terlihat samar di belakangnya */}
          <div className="rounded-card border border-white/70 bg-white/85 p-6 shadow-[0_24px_60px_rgba(6,78,59,0.12)] backdrop-blur-md sm:p-8">
            {children}
          </div>

          <div className="mt-6 text-center text-sm text-text-muted">
            {footer}
          </div>
        </div>
      </main>
    </div>
  );
}
