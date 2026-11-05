import FeedbackModerationView, {
  type FeedbackViewSource,
} from "../../components/feedback/FeedbackModerationView";
import { adminApi } from "../../lib/adminApi";
import { mapAcademicPeriodDto } from "../../lib/academicPeriods";
import { getPublicCounselors } from "../../lib/publicApi";

const ADMIN_FEEDBACK_SOURCE: FeedbackViewSource = {
  role: "admin",
  description:
    "Penilaian anonim dari klien untuk psikolog setelah sesi konseling. Periksa feedback baru, lalu tampilkan yang sesuai.",
  readOnly: false,
  async load() {
    const [feedback, statistics, periods, accounts, publicCounselors] =
      await Promise.all([
        adminApi.listFeedback({ limit: 100 }),
        adminApi.getFeedbackStatistics(),
        adminApi.listAcademicPeriods().catch(() => []),
        adminApi.listAccounts({ role: "counselor", limit: 100 }).catch(() => []),
        getPublicCounselors().catch(() => []),
      ]);
    return {
      feedback,
      statistics,
      periods: periods.map(mapAcademicPeriodDto),
      counselorNames: [
        ...publicCounselors.map(
          (c): [string, string] => [c.profile_id, c.public_name ?? ""],
        ),
        ...accounts.map((a): [string, string] => [a.id, a.full_name ?? ""]),
      ],
    };
  },
};

export default function AdminFeedbackPage() {
  return <FeedbackModerationView source={ADMIN_FEEDBACK_SOURCE} />;
}
