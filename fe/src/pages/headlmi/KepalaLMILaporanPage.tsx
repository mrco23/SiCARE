import CounselingReportView, {
  REPORT_ROW_LIMIT,
  type ReportSource,
} from "../../components/reports/CounselingReportView";
import { mapPublicAcademicPeriod } from "../../features/headlmi/shared/presentation";
import { adminApi } from "../../lib/adminApi";
import { getPublicAcademicPeriods, getPublicCounselors } from "../../lib/publicApi";
import { reportingApi } from "../../lib/reportingApi";

const HEAD_LMI_REPORT_SOURCE: ReportSource = {
  role: "headlmi",
  eyebrow: "Panel Pimpinan",
  description:
    "Ringkasan sesi, pembatalan, dan distribusi layanan per konselor berdasarkan periode akademik.",
  showOrphanWarning: false,
  async load() {
    const [report, counseling, periods, publicCounselors, feedback] =
      await Promise.all([
        reportingApi.getHeadLmiReport(),
        adminApi.listCounseling(REPORT_ROW_LIMIT),
        getPublicAcademicPeriods().catch(() => []),
        getPublicCounselors().catch(() => []),
        adminApi.listFeedback({ limit: REPORT_ROW_LIMIT }).catch(() => []),
      ]);
    return {
      report,
      counseling,
      periods: periods.map(mapPublicAcademicPeriod),
      counselorNames: publicCounselors.map(
        (c): [string, string] => [c.profile_id, c.public_name ?? ""],
      ),
      feedback,
    };
  },
};

export default function KepalaLMILaporanPage() {
  return <CounselingReportView source={HEAD_LMI_REPORT_SOURCE} />;
}
