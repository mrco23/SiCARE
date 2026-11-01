import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CalendarPlus, CheckCircle2, Clock3, MessageSquareText, RefreshCw } from "lucide-react";
import { PageHeader } from "../../components/shared";
import { useAuth } from "../../features/auth/useAuth";
import { sicareApi, type BookingRecordApi, type SessionRecordApi, type FeedbackRecordApi } from "../../lib/sicareApi";
import { getPublicCounselors } from "../../lib/publicApi";
import { ApiError } from "../../lib/api";
const dateTime = (value: string) => new Date(value).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
export default function KlienBerandaPage() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<BookingRecordApi[]>([]);
  const [sessions, setSessions] = useState<SessionRecordApi[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRecordApi[]>([]);
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const fetchDashboard = useCallback(async () => {
    const [bookingRows, sessionRows, feedbackRows] = await Promise.all([
      sicareApi.bookings(100), sicareApi.sessions(100), sicareApi.myFeedback(),
    ]);
    // Booking/session list DTOs expose counselor_id, not nested counselor objects.
    // Use the public directory for display names without making the dashboard depend on it.
    const counselorRows = await getPublicCounselors().catch(() => []);
    const counselorNameMap = Object.fromEntries(
      counselorRows.map((counselor) => [counselor.profile_id, counselor.public_name] as const),
    );
    return { bookingRows, sessionRows, feedbackRows, counselorNameMap, currentTime: Date.now() };
  }, []);
  const applyDashboard = useCallback((result: Awaited<ReturnType<typeof fetchDashboard>>) => {
    setBookings(result.bookingRows);
    setSessions(result.sessionRows);
    setFeedback(result.feedbackRows);
    setCounselorNames(result.counselorNameMap);
    setNow(result.currentTime);
    setError("");
  }, []);
  const reportLoadError = useCallback((cause: unknown) => {
    setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "Beranda klien tidak dapat dimuat.");
  }, []);
  useEffect(() => {
    let active = true;
    void fetchDashboard()
      .then((result) => { if (active) applyDashboard(result); })
      .catch((cause: unknown) => { if (active) reportLoadError(cause); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchDashboard, applyDashboard, reportLoadError]);
  const refresh = () => { setLoading(true); setError(""); void fetchDashboard().then(applyDashboard).catch(reportLoadError).finally(() => setLoading(false)); };
  const pending = bookings.filter((item) => ["waiting_confirmation", "reschedule_requested"].includes(item.status)).length;
  const confirmed = bookings.filter((item) => item.status === "confirmed").length;
  const completed = sessions.filter((item) => item.status === "completed").length;
  const upcoming = sessions
    .filter((item) => ["scheduled", "ongoing"].includes(item.status))
    .filter((item) => item.status === "ongoing" || Date.parse(item.starts_at) >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const nextBooking = bookings
    .filter((item) => ["waiting_confirmation", "confirmed", "reschedule_requested"].includes(item.status))
    .filter((item) => Date.parse(item.starts_at) >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const cards = [{ label: "Menunggu konfirmasi", value: pending, icon: Clock3 }, { label: "Booking dikonfirmasi", value: confirmed, icon: CalendarClock }, { label: "Sesi selesai", value: completed, icon: CheckCircle2 }, { label: "Feedback dikirim", value: feedback.length, icon: MessageSquareText }];
  return <div className="space-y-5"><PageHeader title={`Halo, ${profile?.full_name ?? "Klien"}`} description="Berikut ringkasan aktivitas konselingmu dari database SiCARE." actions={<button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><RefreshCw className="h-4 w-4" /> Muat ulang</button>} />{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}{loading && <p className="rounded-xl bg-white p-4 text-sm text-slate-600">Memuat ringkasan...</p>}<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon }) => <article key={label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div><Icon className="h-5 w-5 text-primary" /></article>)}</section><section className="grid gap-4 lg:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" /><h2 className="font-bold">Jadwal sesi berikutnya</h2></div>{upcoming ? <><p className="mt-3 font-semibold text-slate-900">{dateTime(upcoming.starts_at)}</p><p className="mt-1 text-sm text-slate-600">{counselorNames[upcoming.counselor_id] ?? "Konselor"} · {upcoming.status === "ongoing" ? "Sedang berlangsung" : "Terjadwal"}</p></> : nextBooking ? <><p className="mt-3 font-semibold text-slate-900">{dateTime(nextBooking.starts_at)}</p><p className="mt-1 text-sm text-slate-600">{counselorNames[nextBooking.counselor_id] ?? "Konselor"} · {nextBooking.status === "reschedule_requested" ? "Perlu memilih jadwal ulang" : "Menunggu konfirmasi booking"}</p></> : <p className="mt-3 text-sm text-slate-500">Belum ada jadwal aktif.</p>}<Link to="/klien/aktivitas" className="mt-4 inline-flex text-sm font-semibold text-primary">Lihat aktivitas</Link></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><CalendarPlus className="h-5 w-5 text-primary" /><h2 className="font-bold">Butuh sesi konseling?</h2></div><p className="mt-3 text-sm leading-relaxed text-slate-600">Pilih konselor dan jadwal yang benar-benar tersedia. Permintaan akan dikirim untuk konfirmasi konselor.</p><Link to="/klien/pesanan" className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">Buat booking</Link></article></section></div>;
}
