import { useState } from "react";
import { PageContainer, PageHeader } from "../../components/shared";
import { BOOKING_STATUS } from "../../constants/status";
import { useBookingStore } from "../../features/booking/store/bookingStore";
import { MetricCards, RecentClientBookings, ServiceDistribution, SessionTrend, CounselorWorkload } from "../../components/admin/dashboard/DashboardSections";
import { periodFilters } from "../../features/admin/dashboard/dashboardConstants";

export default function AdminBerandaPage() {
  const [period, setPeriod] = useState<(typeof periodFilters)[number]>("Hari Ini");
  const bookings = useBookingStore((state) => state.bookings);
  const pendingBookings = bookings.filter(
    (booking) => booking.status === BOOKING_STATUS.WAITING_CONFIRMATION,
  ).length;

  return (
    <PageContainer role="admin">
      <PageHeader
        title="Dashboard Monitoring Konseling"
        description="Ringkasan statistik dan operasional layanan konseling kampus."
        actions={
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold text-slate-600">
            {periodFilters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  period === item
                    ? "bg-white text-slate-800 shadow-sm"
                    : "hover:text-slate-900"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        }
      />

      <MetricCards additionalRequests={bookings.length} additionalPending={pendingBookings} />
      <RecentClientBookings bookings={bookings} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SessionTrend />
        <ServiceDistribution />
      </div>
      <CounselorWorkload />
    </PageContainer>
  );
}
