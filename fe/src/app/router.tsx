import { Routes, Route } from "react-router-dom";

import HomePage from "../pages/public/HomePage";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

/* Layouts */
import ClientLayout from "../layouts/ClientLayout";
import CounselorLayout from "../layouts/CounselorLayout";
import AdminLayout from "../layouts/AdminLayout";

/* Pages */
import ClientDashboard from "../pages/client/Dashboard";
import CounselorDashboard from "../pages/counselor/Dashboard";
import AdminDashboard from "../pages/admin/Dashboard";
import PublicLayout from "../layouts/PublicLayout";
import AboutPage from "../pages/public/AboutPage";
import MoodTrackerPage from "../pages/public/MoodTrackerPage";
import FeedbackPage from "../pages/public/FeedbackPage";
import CounselorPage from "../pages/public/CounselorPage";

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
      </Route>

      <Route path="/counselor" element={<CounselorLayout />}>
        <Route index element={<CounselorDashboard />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
      </Route>

      {/*       <Route path="*" element={<Navigate to="/" replace />} /> */}
    </Routes>
  );
}
