import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import { GuestOnlyRoute, ProtectedRoute } from "../features/auth/RouteGuards";

/* Auth */
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
const AuthConfirmedPage = lazy(() => import("../pages/auth/AuthConfirmedPage"));
const ResetPasswordPage = lazy(() => import("../pages/auth/ResetPasswordPage"));

/* Layouts */
import KonselorLayout from "../layouts/KonselorLayout";
import AdminLayout from "../layouts/AdminLayout";
import KlienLayout from "../layouts/KlienLayout";
import KepalaLMILayout from "../layouts/KepalaLMILayout";

/* Client */
const KlienBerandaPage = lazy(() => import("../pages/client/KlienBerandaPage"));
const KlienPesananPage = lazy(() => import("../pages/client/KlienPesananPage"));
const KlienAktivitasPage = lazy(() => import("../pages/client/KlienAktivitasPage"));
const KlienKonselorPage = lazy(() => import("../pages/client/KlienKonselorPage"));
const KlienRiwayatPage = lazy(() => import("../pages/client/KlienRiwayatPage"));
const KlienPengaturanPage = lazy(() => import("../pages/client/KlienPengaturanPage"));

/* Admin */
const AdminBerandaPage = lazy(() => import("../pages/admin/AdminBerandaPage"));
const AdminActivityPage = lazy(() => import("../pages/admin/AdminAktivitasPage"));
const AdminFeedbackPage = lazy(() => import("../pages/admin/AdminFeedbackPage"));
const AdminPeriodePage = lazy(() => import("../pages/admin/AdminPeriodePage"));
const AdminKonselingPage = lazy(() => import("../pages/admin/AdminKonselingPage"));
const AdminLaporanPage = lazy(() => import("../pages/admin/AdminLaporanPage.tsx"));
const AdminAkunPage = lazy(() => import("../pages/admin/AdminAkunPage"));
const AdminPengaturanPage = lazy(() => import("../pages/admin/AdminPengaturanPage.tsx"));

/* Public */
import HomePage from "../pages/public/HomePage";
import PublicLayout from "../layouts/PublicLayout";
const AboutPage = lazy(() => import("../pages/public/AboutPage"));
const MoodTrackerPage = lazy(() => import("../pages/public/MoodTrackerPage"));
const MoodCheckPage = lazy(() => import("../pages/public/MoodCheckPage"));
const FeedbackPage = lazy(() => import("../pages/public/FeedbackPage"));
const CounselorPage = lazy(() => import("../pages/public/CounselorPage"));
const PanduanPage = lazy(() => import("../pages/public/PanduanPage"));

/* Counselor */
const KonselorBerandaPage = lazy(() => import("../pages/counselor/KonselorBerandaPage"));
const KonselorJadwalPage = lazy(() => import("../pages/counselor/KonselorJadwalPage"));
const KonselorRiwayatPage = lazy(() => import("../pages/counselor/KonselorRiwayatPage"));
const KonselorPermintaanPage = lazy(() => import("../pages/counselor/KonselorPermintaanPage.tsx"));
const KonselorAktivitasPage = lazy(() => import("../pages/counselor/KonselorAktivitasPage"));
const KonselorPengaturanPage = lazy(() => import("../pages/counselor/KonselorPengaturanPage.tsx"));
const KonselorFeedbackPage = lazy(() => import("../pages/counselor/KonselorFeedbackPage.tsx"));

/* Head LMI */
const KepalaLMIBerandaPage = lazy(() => import("../pages/headlmi/KepalaLMIBerandaPage.tsx"));
const KepalaLMILaporanPage = lazy(() => import("../pages/headlmi/KepalaLMILaporanPage.tsx"));
const KepalaLMIPengaturanPage = lazy(() => import("../pages/headlmi/KepalaLMIPengaturanPage.tsx"));
const KepalaLMIFeedbackPage = lazy(() => import("../pages/headlmi/KepalaLMIFeedbackPage.tsx"));

/* Guest Informed Consent Portal */
const GuestConsentPage = lazy(() => import("../pages/guest/GuestConsentPage.tsx"));

/** Halaman dimuat saat dibuka (code splitting); tata letak tetap tampil selama halaman dimuat. */
function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-[#064E3B]/20 border-t-[#064E3B]" />
      <span className="sr-only">Memuat halaman...</span>
    </div>
  );
}

function page(Component: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="tentang-kami" element={page(AboutPage)} />
        <Route path="panduan" element={page(PanduanPage)} />
        <Route path="profil-konselor" element={page(CounselorPage)} />
        <Route path="mood-tracker" element={page(MoodTrackerPage)} />
        <Route path="mood-tracker/cek" element={page(MoodCheckPage)} />
        <Route path="feedback" element={page(FeedbackPage)} />
      </Route>

      <Route path="/login" element={<GuestOnlyRoute><Login /></GuestOnlyRoute>} />
      <Route path="/register" element={<GuestOnlyRoute><Register /></GuestOnlyRoute>} />
      <Route path="/auth/confirmed" element={page(AuthConfirmedPage)} />
      <Route path="/auth/reset-password" element={page(ResetPasswordPage)} />
      <Route path="/consent/invite" element={page(GuestConsentPage)} />

      <Route path="/klien" element={<ProtectedRoute allowedRoles={["client"]}><KlienLayout /></ProtectedRoute>}>
        <Route index element={page(KlienBerandaPage)} />
        <Route path="pesanan" element={page(KlienPesananPage)} />
        <Route path="aktivitas" element={page(KlienAktivitasPage)} />
        <Route path="konselor" element={page(KlienKonselorPage)} />
        <Route path="riwayat" element={page(KlienRiwayatPage)} />
        <Route path="pengaturan" element={page(KlienPengaturanPage)} />
      </Route>

      <Route path="/konselor" element={<ProtectedRoute allowedRoles={["counselor"]}><KonselorLayout /></ProtectedRoute>}>
        <Route index element={page(KonselorBerandaPage)} />
        <Route path="aktivitas" element={page(KonselorAktivitasPage)} />
        <Route path="permintaan" element={page(KonselorPermintaanPage)} />
        <Route path="riwayat" element={page(KonselorRiwayatPage)} />
        <Route path="jadwal" element={page(KonselorJadwalPage)} />
        <Route path="feedback" element={page(KonselorFeedbackPage)} />
        <Route path="pengaturan" element={page(KonselorPengaturanPage)} />
      </Route>

      <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminLayout /></ProtectedRoute>}>
        <Route index element={page(AdminBerandaPage)} />
        <Route path="aktivitas" element={page(AdminActivityPage)} />
        <Route path="akun" element={page(AdminAkunPage)} />
        <Route path="konseling" element={page(AdminKonselingPage)} />
        <Route path="feedback" element={page(AdminFeedbackPage)} />
        <Route path="laporan" element={page(AdminLaporanPage)} />
        <Route path="periode" element={page(AdminPeriodePage)} />
        <Route path="pengaturan" element={page(AdminPengaturanPage)} />
      </Route>

      <Route path="/kepala-lmi" element={<ProtectedRoute allowedRoles={["head_lmi"]}><KepalaLMILayout /></ProtectedRoute>}>
        <Route index element={page(KepalaLMIBerandaPage)} />
        <Route path="laporan" element={page(KepalaLMILaporanPage)} />
        <Route path="feedback" element={page(KepalaLMIFeedbackPage)} />
        <Route path="pengaturan" element={page(KepalaLMIPengaturanPage)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
