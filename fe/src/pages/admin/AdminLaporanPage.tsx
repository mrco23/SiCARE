import CounselingReportView, {
  REPORT_ROW_LIMIT,
  type ReportSource,
} from "../../components/reports/CounselingReportView";
import { adminApi } from "../../lib/adminApi";
import { mapAcademicPeriodDto } from "../../lib/academicPeriods";
import { getPublicCounselors } from "../../lib/publicApi";
import { reportingApi } from "../../lib/reportingApi";

const ADMIN_REPORT_SOURCE: ReportSource = {
  role: "admin",
  description:
    "Ringkasan sesi, pembatalan, distribusi layanan per konselor, dan ekspor data berdasarkan periode akademik.",
  showOrphanWarning: true,
  async load() {
    const [report, counseling, periods, accounts, publicCounselors, feedback] =
      await Promise.all([
        reportingApi.getAdminReport(),
        adminApi.listCounseling(REPORT_ROW_LIMIT),
        adminApi.listAcademicPeriods().catch(() => []),
        adminApi.listAccounts({ role: "counselor", limit: 100 }).catch(() => []),
        getPublicCounselors().catch(() => []),
        adminApi.listFeedback({ limit: REPORT_ROW_LIMIT }).catch(() => []),
      ]);
    return {
      report,
      counseling,
      periods: periods.map(mapAcademicPeriodDto),
      counselorNames: [
        ...publicCounselors.map(
          (c): [string, string] => [c.profile_id, c.public_name ?? ""],
        ),
        ...accounts.map((a): [string, string] => [a.id, a.full_name ?? ""]),
      ],
      feedback,
    };
  },
};

export default function AdminLaporanPage() {
  return <CounselingReportView source={ADMIN_REPORT_SOURCE} />;
}
