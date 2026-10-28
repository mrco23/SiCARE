import { PageContainer, PageHeader } from "../../components/shared";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarCheck } from "lucide-react";
import { ActivitySummary, CounselorSummary, MetricCards } from "../../components/headlmi/dashboard/DashboardSections";

export default function KepalaLMIBerandaPage() {
  const navigate = useNavigate();

  return (
    <PageContainer role="headlmi" spacing="none" className="space-y-5 text-slate-800">
      <PageHeader
        eyebrow="Beranda Kepala LMI"
        title="Ringkasan Konseling"
        description="Pantau kondisi layanan dan tindak lanjut utama."
        actions={
          <button
            type="button"
            onClick={() => navigate("/admin/laporan")}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark sm:self-auto"
          >
            Lihat laporan lengkap
            <ArrowRight className="h-4 w-4" />
          </button>
        }
      />

      <MetricCards />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3"><ActivitySummary /></div>
        <div className="xl:col-span-2"><CounselorSummary /></div>
      </div>
      <p className="flex items-center gap-2 px-1 text-xs text-slate-400">
        <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
        Data yang ditampilkan merupakan data contoh dan dapat dihubungkan ke API.
      </p>
    </PageContainer>
  );
}
