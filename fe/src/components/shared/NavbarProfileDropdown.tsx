import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Settings, Loader2 } from "lucide-react";
import { useAuth } from "../../features/auth/useAuth";
import { getInitials } from "../../lib/avatarUtils";

export interface NavbarProfileDropdownProps {
  role: "admin" | "head_lmi" | "counselor" | "client";
  wrapperClassName?: string;
  photoUrl?: string | null;
}

export default function NavbarProfileDropdown({
  role,
  wrapperClassName = "",
  photoUrl,
}: NavbarProfileDropdownProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageError, setImageError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Ambil nama lengkap pengguna
  const profileFullName = profile?.full_name;
  const fullName = useMemo(() => {
    if (profileFullName?.trim()) return profileFullName.trim();
    if (role === "admin") return "Administrator SiCARE";
    if (role === "head_lmi") return "Kepala LMI";
    if (role === "counselor") return "Konselor SiCARE";
    return "Mahasiswa / Klien";
  }, [profileFullName, role]);

  const initials = useMemo(() => getInitials(fullName), [fullName]);

  // Resolusi URL Foto:
  // Admin: SELALU menggunakan logo resmi SiCARE (/icon-512x512.png)
  // Peran lain: photoUrl -> avatar_url -> photo_path -> local storage -> fallback inisial
  const [localPhoto, setLocalPhoto] = useState<string | null>(() => {
    try {
      const key = `sicare_profile_photo_${profile?.id || role}`;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const key = `sicare_profile_photo_${profile?.id || role}`;
        setLocalPhoto(localStorage.getItem(key));
        setImageError(false);
      } catch {
        // ignore
      }
    };
    window.addEventListener("sicare:photo-updated", handleUpdate);
    return () => window.removeEventListener("sicare:photo-updated", handleUpdate);
  }, [profile?.id, role]);

  const resolvedPhoto = useMemo(() => {
    if (role === "admin") {
      return "/icon-512x512.png";
    }
    if (photoUrl) return photoUrl;
    if (localPhoto) return localPhoto;
    const p = profile as Record<string, unknown> | null;
    if (typeof p?.avatar_url === "string" && p.avatar_url) return p.avatar_url;
    if (typeof p?.photo_path === "string" && p.photo_path) return p.photo_path;
    return null;
  }, [role, photoUrl, localPhoto, profile]);

  // Konfigurasi tautan pengaturan & label peran
  const { roleLabel, settingsPath } = useMemo(() => {
    switch (role) {
      case "admin":
        return { roleLabel: "Administrator", settingsPath: "/admin/pengaturan" };
      case "head_lmi":
        return { roleLabel: "Kepala LMI", settingsPath: "/kepala-lmi/pengaturan" };
      case "counselor":
        return { roleLabel: "Konselor", settingsPath: "/konselor/pengaturan" };
      case "client":
      default:
        return { roleLabel: "Klien / Mahasiswa", settingsPath: "/klien/pengaturan" };
    }
  }, [role]);

  // Tutup dropdown saat klik di luar atau menekan tombol Escape
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await signOut();
      setIsOpen(false);
      navigate("/login", { replace: true });
    } catch {
      // Tetap arahkan ke login jika terjadi kegagalan jaringan
      setIsOpen(false);
      navigate("/login", { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render elemen avatar visual
  const renderAvatarContent = (sizeClass: string, isLogoAdmin: boolean): ReactNode => {
    if (isLogoAdmin) {
      return (
        <img
          src="/icon-512x512.png"
          alt="Logo SiCARE"
          className={`${sizeClass} rounded-full object-contain p-0.5 bg-white`}
        />
      );
    }

    if (resolvedPhoto && !imageError) {
      return (
        <img
          src={resolvedPhoto}
          alt={fullName}
          onError={() => setImageError(true)}
          className={`${sizeClass} rounded-full object-cover`}
        />
      );
    }

    // Fallback: inisial nama dengan warna primary brand SiCARE (#064E3B)
    return (
      <span
        aria-hidden="true"
        className={`${sizeClass} flex items-center justify-center rounded-full bg-[#064E3B] font-bold text-white tracking-wider`}
      >
        {initials}
      </span>
    );
  };

  return (
    <div ref={menuRef} className={`relative inline-block text-left ${wrapperClassName}`}>
      {/* Tombol Pemicu Avatar */}
      <button
        type="button"
        id={`profile-menu-button-${role}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Menu profil ${fullName}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white bg-white shadow-md ring-1 ring-slate-300 transition hover:ring-brand-gold focus:outline-none focus:ring-2 focus:ring-[#064E3B] focus:ring-offset-2"
      >
        {renderAvatarContent("h-full w-full", role === "admin")}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby={`profile-menu-button-${role}`}
          className="absolute right-0 top-full z-50 mt-2.5 w-64 max-w-[calc(100vw-2rem)] origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header Profil Ringkas */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 shadow-xs overflow-hidden">
              {renderAvatarContent("h-full w-full", role === "admin")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-800" title={fullName}>
                {fullName}
              </p>
              <p
                className="truncate text-[11px] text-slate-500"
                title={user?.email || "Akun SiCARE"}
              >
                {user?.email || "Akun Terotentikasi"}
              </p>
              <span className="mt-1 inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-[#064E3B] border border-emerald-200/60">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Navigasi Pengaturan Profil */}
          <div className="py-1">
            <Link
              to={settingsPath}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Settings className="h-4 w-4 text-slate-500" />
              <span>Pengaturan Akun</span>
            </Link>
          </div>

          {/* Tombol Logout */}
          <div className="border-t border-slate-100 pt-1">
            <button
              type="button"
              role="menuitem"
              disabled={isSubmitting}
              onClick={() => void handleLogout()}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin text-red-600" />
              ) : (
                <LogOut className="h-4 w-4 text-red-500" />
              )}
              <span>{isSubmitting ? "Mengeluarkan sesi..." : "Keluar dari SiCARE"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
