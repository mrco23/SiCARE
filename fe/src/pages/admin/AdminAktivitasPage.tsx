import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer, PageHeader } from "../../components/shared";
import { adminApi } from "../../lib/adminApi";
import type { AdminActivityDto } from "../../types/api";
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Stethoscope,
} from "lucide-react";

type EntityFilter = "all" | AdminActivityDto["entity_type"];
type TimeFilter = "all" | "today" | "7d" | "30d";

const ENTITY_TABS: { key: EntityFilter; label: string }[] = [
  { key: "all", label: "Semua Aktivitas" },
  { key: "booking", label: "Booking" },
  { key: "session", label: "Sesi Konseling" },
  { key: "feedback", label: "Feedback" },
];

const ENTITY_META: Record<
  AdminActivityDto["entity_type"],
  {
    label: string;
    badgeClass: string;
    href: string;
    hrefLabel: string;
  }
> = {
  booking: {
    label: "Booking Konseling",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
    href: "/admin/konseling",
    hrefLabel: "Buka Monitoring",
  },
  session: {
    label: "Sesi Konseling",
    badgeClass: "border-emerald-200 bg-emerald-50 text-primary",
    href: "/admin/konseling",
    hrefLabel: "Buka Monitoring",
  },
  feedback: {
    label: "Feedback Klien",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
    href: "/admin/feedback",
    hrefLabel: "Buka Moderasi",
  },
};

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  waiting_confirmation: {
    label: "Menunggu Konfirmasi",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
  confirmed: {
    label: "Dikonfirmasi",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  reschedule_requested: {
    label: "Perubahan Jadwal",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
  },
  rejected: {
    label: "Ditolak",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
  },
  cancelled: {
    label: "Dibatalkan",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
  },
  completed: {
    label: "Selesai",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  scheduled: {
    label: "Terjadwal",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
  },
  in_progress: {
    label: "Sedang Berlangsung",
    badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  pending: {
    label: "Menunggu Moderasi",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
  shown: {
    label: "Ditampilkan Publik",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  disabled: {
    label: "Dinonaktifkan",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const REVIEW_LABELS: Record<string, string> = {
  new: "Peninjauan LMI: Baru",
  reviewed: "Peninjauan LMI: Ditinjau",
  resolved: "Peninjauan LMI: Selesai",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describeActivity(item: AdminActivityDto): string {
  const statusInfo = STATUS_LABELS[item.status]?.label ?? item.status;
  if (item.entity_type === "booking") {
    return `Permintaan booking konseling diperbarui ke status "${statusInfo}".`;
  }
  if (item.entity_type === "session") {
    return `Sesi konseling diperbarui ke status "${statusInfo}".`;
  }
  return `Feedback anonim klien berstatus moderasi "${statusInfo}".`;
}

export default function AdminActivityPage() {
  const [items, setItems] = useState<AdminActivityDto[]>([]);
  const [referenceTime, setReferenceTime] = useState<number>(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [query, setQuery] = useState("");

  const fetchActivities = useCallback(async () => {
    const data = await adminApi.listActivity(100);
    return [...data].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, []);

  useEffect(() => {
    let active = true;
    void fetchActivities()
      .then((sorted) => {
        if (!active) return;
        setItems(sorted);
        setReferenceTime(Date.now());
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Log aktivitas sistem tidak dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchActivities]);

  const handleRefresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const sorted = await fetchActivities();
      setItems(sorted);
      setReferenceTime(Date.now());
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Log aktivitas sistem tidak dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(
    () => ({
      all: items.length,
      booking: items.filter((i) => i.entity_type === "booking").length,
      session: items.filter((i) => i.entity_type === "session").length,
      feedback: items.filter((i) => i.entity_type === "feedback").length,
    }),
    [items],
  );

  const availableStatuses = useMemo(() => {
    const relevant =
      entityFilter === "all"
        ? items
        : items.filter((i) => i.entity_type === entityFilter);
    return [...new Set(relevant.map((i) => i.status))].sort();
  }, [items, entityFilter]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      if (entityFilter !== "all" && item.entity_type !== entityFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (timeFilter !== "all") {
        const updatedMs = new Date(item.updated_at).getTime();
        const diffDays = (referenceTime - updatedMs) / 86400000;
        if (timeFilter === "today" && diffDays > 1) return false;
        if (timeFilter === "7d" && diffDays > 7) return false;
        if (timeFilter === "30d" && diffDays > 30) return false;
      }
      if (q) {
        const statusLabel = (
          STATUS_LABELS[item.status]?.label ?? item.status
        ).toLowerCase();
        const typeLabel = ENTITY_META[item.entity_type].label.toLowerCase();
        const idMatch = item.entity_id.toLowerCase().includes(q);
        if (
          !idMatch &&
          !statusLabel.includes(q) &&
          !typeLabel.includes(q) &&
          !item.status.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [items, entityFilter, statusFilter, timeFilter, query, referenceTime]);

  return (
    <PageContainer role="admin">
      <PageHeader
        title="Log Aktivitas Sistem"
        description="Pantau pembaruan terbaru pada permintaan booking, sesi konseling, dan moderasi feedback klien."
        actions={
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Muat ulang
          </button>
        }
      />

      {loadError && (
        <div
          role="alert"
          className="flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 sm:flex-row sm:items-center"
        >
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="shrink-0 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Ringkasan KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Aktivitas
            </p>
            <h3 className="mt-1 text-3xl font-bold text-slate-800">
              {counts.all}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Entitas terbaru</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-primary">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Booking
            </p>
            <h3 className="mt-1 text-3xl font-bold text-slate-800">
              {counts.booking}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Permintaan jadwal</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-sky-700">
            <ClipboardList className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Sesi Konseling
            </p>
            <h3 className="mt-1 text-3xl font-bold text-slate-800">
              {counts.session}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Pelaksanaan sesi</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-primary">
            <Stethoscope className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Feedback
            </p>
            <h3 className="mt-1 text-3xl font-bold text-slate-800">
              {counts.feedback}
            </h3>
            <p className="mt-1 text-xs text-slate-500">Ulasan & moderasi</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-700">
            <MessageSquareText className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold text-slate-600">
          {ENTITY_TABS.map((t) => {
            const active = entityFilter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setEntityFilter(t.key);
                  setStatusFilter("all");
                }}
                className={`rounded-lg px-3.5 py-2 transition-colors ${
                  active
                    ? "bg-white text-slate-800 shadow-sm"
                    : "hover:text-slate-900"
                }`}
              >
                {t.label}{" "}
                <span className="ml-1 text-[10px] text-slate-400">
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter status aktivitas"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
        >
          <option value="all">Semua status</option>
          {availableStatuses.map((st) => (
            <option key={st} value={st}>
              {STATUS_LABELS[st]?.label ?? st}
            </option>
          ))}
        </select>

        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
          aria-label="Filter rentang waktu"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
        >
          <option value="all">Semua waktu</option>
          <option value="today">24 jam terakhir</option>
          <option value="7d">7 hari terakhir</option>
          <option value="30d">30 hari terakhir</option>
        </select>

        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari ID entitas atau status..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
          />
        </div>
      </div>

      {/* Daftar Aktivitas */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <p className="text-xs text-slate-400">
            Menampilkan {filteredRows.length} dari {items.length} aktivitas
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Memuat log aktivitas dari server...
          </div>
        ) : filteredRows.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredRows.map((item) => {
              const meta = ENTITY_META[item.entity_type];
              const statusInfo = STATUS_LABELS[item.status] ?? {
                label: item.status,
                badgeClass: "border-slate-200 bg-slate-100 text-slate-600",
              };
              const shortEntityId = item.entity_id.slice(0, 8).toUpperCase();

              return (
                <div
                  key={`${item.entity_type}-${item.id}`}
                  className="flex flex-col justify-between gap-4 p-5 transition-colors hover:bg-slate-50/60 sm:flex-row sm:items-center sm:px-6"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusInfo.badgeClass}`}
                      >
                        {statusInfo.label}
                      </span>
                      {item.review_status && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {REVIEW_LABELS[item.review_status] ??
                            item.review_status}
                        </span>
                      )}
                      <span className="font-mono text-xs font-semibold text-slate-400">
                        #{shortEntityId}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-700">
                      {describeActivity(item)}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Diperbarui: {formatDateTime(item.updated_at)}
                      </span>
                      <span>Dibuat: {formatDateTime(item.created_at)}</span>
                    </div>
                  </div>

                  <Link
                    to={meta.href}
                    className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-accent/50 hover:text-primary sm:self-center"
                  >
                    {meta.hrefLabel}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400">
            <Activity className="mx-auto mb-2 h-8 w-8" />
            <p className="text-sm font-medium">
              Tidak ada aktivitas sistem yang sesuai dengan filter.
            </p>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
