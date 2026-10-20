import { Routes, Route } from "react-router-dom";

/* Auth */
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

/* Layouts */
import KonselorLayout from "../layouts/KonselorLayout";
import AdminLayout from "../layouts/AdminLayout";
import KlienLayout from "../layouts/KlienLayout";
import KepalaLMILayout from "../layouts/KepalaLMILayout";

/* Client */
import KlienBerandaPage from "../pages/client/KlienBerandaPage";
import KlienPesananPage from "../pages/client/KlienPesananPage";
import KlienAktivitasPage from "../pages/client/KlienAktivitasPage";
import KlienKonselorPage from "../pages/client/KlienKonselorPage";
import KlienRiwayatPage from "../pages/client/KlienRiwayatPage";
import KlienPengaturanPage from "../pages/client/KlienPengaturanPage";

/* Admin */
import AdminBerandaPage from "../pages/admin/AdminBerandaPage";
import AdminActivityPage from "../pages/admin/AdminAktivitasPage";
import AdminFeedbackPage from "../pages/admin/AdminFeedbackPage";
import AdminPeriodePage from "../pages/admin/AdminPeriodePage";
import AdminKonselingPage from "../pages/admin/AdminKonselingPage";
import AdminLaporanPage from "../pages/admin/AdminLaporanPage.tsx";
import AdminAkunPage from "../pages/admin/AdminAkunPage";
import AdminPengaturanPage from "../pages/admin/AdminPengaturanPage.tsx";

/* Public */
import HomePage from "../pages/public/HomePage";
import PublicLayout from "../layouts/PublicLayout";
import AboutPage from "../pages/public/AboutPage";
import MoodTrackerPage from "../pages/public/MoodTrackerPage";
import FeedbackPage from "../pages/public/FeedbackPage";
import CounselorPage from "../pages/public/CounselorPage";
import PanduanPage from "../pages/public/PanduanPage";

/* Counselor */
import KonselorBerandaPage from "../pages/counselor/KonselorBerandaPage";
import KonselorJadwalPage from "../pages/counselor/KonselorJadwalPage";
import KonselorRiwayatPage from "../pages/counselor/KonselorRiwayatPage";
import KonselorPermintaanPage from "../pages/counselor/KonselorPermintaanPage.tsx";
import KonselorAktivitasPage from "../pages/counselor/KonselorAktivitasPage";
import KonselorPengaturanPage from "../pages/counselor/KonselorPengaturanPage.tsx";
import KonselorFeedbackPage from "../pages/counselor/KonselorFeedbackPage.tsx";

/* Head LMI */
import KepalaLMIBerandaPage from "../pages/headlmi/KepalaLMIBerandaPage.tsx";
import KepalaLMILaporanPage from "../pages/headlmi/KepalaLMILaporanPage.tsx";
import KepalaLMIPengaturanPage from "../pages/headlmi/KepalaLMIPengaturanPage.tsx";
import KepalaLMIFeedbackPage from "../pages/headlmi/KepalaLMIFeedbackPage.tsx";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="tentang-kami" element={<AboutPage />} />
        <Route path="panduan" element={<PanduanPage />} />
        <Route path="profil-konselor" element={<CounselorPage />} />
        <Route path="mood-tracker" element={<MoodTrackerPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/klien" element={<KlienLayout />}>
        <Route index element={<KlienBerandaPage />} />
        <Route path="pesanan" element={<KlienPesananPage />} />
        <Route path="aktivitas" element={<KlienAktivitasPage />} />
        <Route path="konselor" element={<KlienKonselorPage />} />
        <Route path="riwayat" element={<KlienRiwayatPage />} />
        <Route path="pengaturan" element={<KlienPengaturanPage />} />
      </Route>

      <Route path="/konselor" element={<KonselorLayout />}>
        <Route index element={<KonselorBerandaPage />} />
        <Route path="aktivitas" element={<KonselorAktivitasPage />} />
        <Route path="permintaan" element={<KonselorPermintaanPage />} />
        <Route path="riwayat" element={<KonselorRiwayatPage />} />
        <Route path="jadwal" element={<KonselorJadwalPage />} />
        <Route path="feedback" element={<KonselorFeedbackPage />} />
        <Route path="pengaturan" element={<KonselorPengaturanPage />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminBerandaPage />} />
        <Route path="aktivitas" element={<AdminActivityPage />} />
        <Route path="akun" element={<AdminAkunPage />} />
        <Route path="konseling" element={<AdminKonselingPage />} />
        <Route path="feedback" element={<AdminFeedbackPage />} />
        <Route path="laporan" element={<AdminLaporanPage />} />
        <Route path="periode" element={<AdminPeriodePage />} />
        <Route path="pengaturan" element={<AdminPengaturanPage />} />
      </Route>

      <Route path="/kepala-lmi" element={<KepalaLMILayout />}>
        <Route index element={<KepalaLMIBerandaPage />} />
        <Route path="laporan" element={<KepalaLMILaporanPage />} />
        <Route path="feedback" element={<KepalaLMIFeedbackPage />} />
        <Route path="pengaturan" element={<KepalaLMIPengaturanPage />} />
      </Route>

      {/*       <Route path="*" element={<Navigate to="/" replace />} /> */}
    </Routes>
  );
}
