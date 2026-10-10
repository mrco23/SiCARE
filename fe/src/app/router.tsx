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
import ClientDashboard from "../pages/client/Dashboard";

/* Admin */
import AdminDashboard from "../pages/admin/Dashboard";

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

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/" element={<PublicLayout />}>
        <Route path="tentang-kami" element={<AboutPage />} />
        <Route path="panduan" element={<></>} />
        <Route path="konselor" element={<CounselorPage />} />
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

      <Route path="/counselor" element={<CounselorLayout />}>
        <Route index element={<CounselorDashboardPage />} />
        <Route path="aktivitas" element={<></>} />
        <Route path="permintaan" element={<></>} />
        <Route path="riwayat" element={<RiwayatPage />} />
        <Route path="jadwal" element={<JadwalPage />} />
        <Route path="pengaturan" element={<></>} />
        <Route path="feedback" element={<></>} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
      </Route>

      {/*       <Route path="*" element={<Navigate to="/" replace />} /> */}
    </Routes>
  );
}
