import { Routes, Route } from "react-router-dom";

import HomePage from "../pages/public/HomePage";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

/* Layouts */
import ClientLayout from "../layouts/ClientLayout";
import CounselorLayout from "../layouts/CounselorLayout";
import AdminLayout from "../layouts/AdminLayout";

/* Pages */

/* Client */
import ClientDashboard from "../pages/client/ClientBerandaPage";

/* Admin */
import AdminBerandaPage from "../pages/admin/AdminBerandaPage";
import AdminActivityPage from "../pages/admin/AdminAktivitasPage";
import AdminFeedbackPage from "../pages/admin/AdminFeedbackPage";
import AdminLaporanPage from "../pages/admin/AdminLaporanPage";
import AdminKonselingPage from "../pages/admin/AdminKonselingPage";

/* Public */
import PublicLayout from "../layouts/PublicLayout";
import AboutPage from "../pages/public/AboutPage";
import MoodTrackerPage from "../pages/public/MoodTrackerPage";
import FeedbackPage from "../pages/public/FeedbackPage";
import CounselorPage from "../pages/public/CounselorPage";

/* Counselor */
import CounselorDashboardPage from "../pages/counselor/CounselorDashboardPage";
import JadwalPage from "../pages/counselor/JadwalPage";
import RiwayatPage from "../pages/counselor/RiwayatPage";
import AdminAkunPage from "../pages/admin/AdminAkunPage";
import AdminPengaturanPage from "../pages/admin/AdminPengaturanPage";
import PanduanPage from "../pages/public/PanduanPage";

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

      <Route path="/client" element={<ClientLayout />}>
        <Route index element={<ClientDashboard />} />
        <Route path="aktivitas" element={<></>} />
        <Route path="riwayat" element={<></>} />
        <Route path="pengaturan" element={<></>} />
      </Route>

      <Route path="/konselor" element={<CounselorLayout />}>
        <Route index element={<CounselorDashboardPage />} />
        <Route path="aktivitas" element={<></>} />
        <Route path="permintaan" element={<></>} />
        <Route path="riwayat" element={<RiwayatPage />} />
        <Route path="jadwal" element={<JadwalPage />} />
        <Route path="pengaturan" element={<></>} />
        <Route path="feedback" element={<></>} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminBerandaPage />} />
        <Route path="aktivitas" element={<AdminActivityPage />} />
        <Route path="akun" element={<AdminAkunPage />} />
        <Route path="konseling" element={<AdminKonselingPage />} />
        <Route path="pengaturan" element={<AdminPengaturanPage />} />
        <Route path="feedback" element={<AdminFeedbackPage />} />
        <Route path="laporan" element={<AdminLaporanPage />} />
      </Route>

      {/*       <Route path="*" element={<Navigate to="/" replace />} /> */}
    </Routes>
  );
}
