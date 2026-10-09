import { Outlet } from "react-router-dom";
import Footer from "../components/home/Footer";

export default function PublicLayout() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
