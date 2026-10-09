import { Outlet } from "react-router-dom";
import Navbar from "../components/home/Navbar";

export default function PublicLayout() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <div className="sticky top-0 z-50">
        <Navbar />
      </div>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
