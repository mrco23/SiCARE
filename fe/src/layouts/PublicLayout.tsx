import { Outlet } from "react-router-dom";
import Footer from "../components/home/Footer";
import Navbar from "../components/home/Navbar";

export default function PublicLayout() {
  return (
    <div className="min-h-screen overflow-x-clip bg-white">
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

