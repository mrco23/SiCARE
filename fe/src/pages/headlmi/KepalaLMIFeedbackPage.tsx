import FeedbackModerationView, {
  type FeedbackViewSource,
} from "../../components/feedback/FeedbackModerationView";
import { mapPublicAcademicPeriod } from "../../features/headlmi/shared/presentation";
import { adminApi } from "../../lib/adminApi";
import { getPublicAcademicPeriods, getPublicCounselors } from "../../lib/publicApi";

const HEAD_LMI_FEEDBACK_SOURCE: FeedbackViewSource = {
  role: "headlmi",
  eyebrow: "Panel Pimpinan",
  description:
    "Penilaian anonim dari klien untuk psikolog setelah sesi konseling. Halaman ini hanya untuk melihat; moderasi dilakukan oleh Admin.",
  readOnly: true,
  async load() {
    const [feedback, statistics, periods, publicCounselors] = await Promise.all([
      adminApi.listFeedback({ limit: 100 }),
      adminApi.getFeedbackStatistics(),
      getPublicAcademicPeriods().catch(() => []),
      getPublicCounselors().catch(() => []),
    ]);
    return {
      feedback,
      statistics,
      periods: periods.map(mapPublicAcademicPeriod),
      counselorNames: publicCounselors.map(
        (c): [string, string] => [c.profile_id, c.public_name ?? ""],
      ),
    };
  },
};

export default function KepalaLMIFeedbackPage() {
  return <FeedbackModerationView source={HEAD_LMI_FEEDBACK_SOURCE} />;
}
