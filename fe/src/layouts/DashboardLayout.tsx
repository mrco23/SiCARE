import { Outlet } from "react-router-dom";
export default function DashboardLayout() {
  return (
    <div>
      <aside>Dashboard Menu</aside>
      <section>
        <Outlet />
      </section>
    </div>
  );
}
