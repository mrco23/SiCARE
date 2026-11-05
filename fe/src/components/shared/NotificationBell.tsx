import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, ChevronRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { NotificationRole } from "../../features/notification/notificationStore";
import { sicareApi, type NotificationRecordApi } from "../../lib/sicareApi";
import { ApiError } from "../../lib/api";

type NotificationFilter = "all" | "unread";

type NotificationBellProps = {
  role: NotificationRole;
  /** Deprecated compatibility prop. Notifications are scoped by the authenticated API session. */
  recipientId?: string;
  wrapperClassName?: string;
  buttonClassName?: string;
};

const PANEL_MAX_WIDTH = 368;
const VIEWPORT_GUTTER = 12;

const joinClasses = (...classes: Array<string | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function NotificationBell({
  role,
  wrapperClassName,
  buttonClassName,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [notifications, setNotifications] = useState<NotificationRecordApi[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Panel dirender di body karena navbar memakai backdrop-blur, yang membuat
  // `position: fixed` mengacu ke navbar. Posisinya mengikuti tombol lalu dijaga
  // tetap di dalam layar, seperti panel filter periode akademik.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = rootRef.current?.getBoundingClientRect();
      if (!button) return;
      const viewport = document.documentElement.clientWidth;
      const width = Math.min(PANEL_MAX_WIDTH, viewport - VIEWPORT_GUTTER * 2);
      const left = Math.max(
        VIEWPORT_GUTTER,
        Math.min(button.right - width, viewport - width - VIEWPORT_GUTTER),
      );
      const top = button.bottom + 8;
      setPanelStyle({ top, left, width, maxHeight: `min(34rem, calc(100dvh - ${top + VIEWPORT_GUTTER}px))` });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const fetchNotifications = useCallback(() => sicareApi.notifications(false, 30), []);
  const applyNotifications = useCallback((result: Awaited<ReturnType<typeof fetchNotifications>>) => {
    setNotifications(result.items);
    setUnreadCount(result.unread_count);
    setError("");
  }, []);
  const reportLoadError = useCallback((cause: unknown) => {
    setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "Notifikasi tidak dapat dimuat.");
  }, []);

  useEffect(() => {
    let active = true;
    void fetchNotifications()
      .then((result) => { if (active) applyNotifications(result); })
      .catch((cause: unknown) => { if (active) reportLoadError(cause); });
    return () => { active = false; };
  }, [fetchNotifications, applyNotifications, reportLoadError]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetchNotifications()
      .then((result) => { if (active) applyNotifications(result); })
      .catch((cause: unknown) => { if (active) reportLoadError(cause); });
    return () => { active = false; };
  }, [open, fetchNotifications, applyNotifications, reportLoadError]);

  const visibleNotifications = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return filter === "unread" ? sorted.filter((item) => item.read_at === null) : sorted;
  }, [notifications, filter]);

  const destinationFor = (item: NotificationRecordApi) => {
    if (item.entity_type === "booking") return role === "client" ? "/klien/aktivitas" : role === "counselor" ? "/konselor/permintaan" : role === "admin" ? "/admin/konseling" : "/kepala-lmi/laporan";
    if (item.entity_type === "feedback") return role === "client" ? "/klien/riwayat" : role === "counselor" ? "/konselor/feedback" : role === "admin" ? "/admin/feedback" : "/kepala-lmi/feedback";
    if (item.entity_type === "session") return role === "client" ? "/klien/riwayat" : role === "counselor" ? "/konselor/aktivitas" : role === "admin" ? "/admin/konseling" : "/kepala-lmi/laporan";
    return undefined;
  };

  const handleNotificationClick = async (id: string) => {
    try {
      const wasUnread = notifications.some((item) => item.id === id && item.read_at === null);
      const updated = await sicareApi.markNotificationRead(id);
      setNotifications((previous) => previous.map((item) => item.id === id ? updated : item));
      if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1));
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "Notifikasi tidak dapat ditandai dibaca.");
    }
  };

  const handleReadAll = async () => {
    setBusy(true);
    try { await sicareApi.markAllNotificationsRead(); applyNotifications(await fetchNotifications()); }
    catch (cause) { setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "Notifikasi tidak dapat ditandai dibaca."); }
    finally { setBusy(false); }
  };

  return (
    <div ref={rootRef} className={joinClasses(wrapperClassName)}>
      <button type="button" aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : "Notifikasi"} aria-haspopup="dialog" aria-expanded={open} title="Notifikasi" onClick={() => setOpen((current) => !current)} className={joinClasses("relative flex items-center justify-center rounded-full text-[#333] transition-colors hover:bg-gray-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", buttonClassName)}>
        <Bell className="h-[19px] w-[19px]" fill="currentColor" strokeWidth={1.5} />
        {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-bold leading-none text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && createPortal(<section ref={panelRef} role="dialog" aria-label="Daftar notifikasi" style={panelStyle} className="fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3.5"><div><h2 className="text-sm font-bold text-gray-900">Notifikasi</h2><p className="mt-0.5 text-xs text-gray-500">{unreadCount === 0 ? "Tidak ada notifikasi belum dibaca" : `${unreadCount} belum dibaca`}</p></div><div className="flex items-center gap-1">{unreadCount > 0 && <button type="button" disabled={busy} onClick={() => void handleReadAll()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary-soft disabled:opacity-50"><CheckCheck className="h-3.5 w-3.5" />Baca semua</button>}<button type="button" aria-label="Tutup notifikasi" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button></div></div>
        <div className="flex gap-1 border-b border-gray-100 px-3 py-2">{([{ value: "all", label: "Semua" }, { value: "unread", label: "Belum dibaca" }] as const).map((option) => <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filter === option.value ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"}`}>{option.label}</button>)}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">{error && <p role="alert" className="m-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}{visibleNotifications.length === 0 ? <div className="px-5 py-10 text-center"><Bell className="mx-auto h-7 w-7 text-gray-300" /><p className="mt-3 text-sm font-semibold text-gray-700">{filter === "unread" ? "Semua notifikasi sudah dibaca" : "Belum ada notifikasi"}</p><p className="mt-1 text-xs text-gray-500">Notifikasi baru akan muncul di sini.</p></div> : <ul className="divide-y divide-gray-100">{visibleNotifications.map((notification) => {
          const href = destinationFor(notification);
          const content = <><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.read_at === null ? "bg-primary" : "bg-transparent"}`} /><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-gray-900">{notification.title}</span>{href && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />}</span><span className="mt-1 block text-xs leading-relaxed text-gray-600">{notification.body}</span><span className="mt-2 block text-[10px] font-medium text-gray-400">{new Date(notification.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span></>;
          return <li key={notification.id}>{href ? <Link to={href} onClick={() => void handleNotificationClick(notification.id)} className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 ${notification.read_at === null ? "bg-primary/[0.035]" : ""}`}>{content}</Link> : <button type="button" onClick={() => void handleNotificationClick(notification.id)} className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 ${notification.read_at === null ? "bg-primary/[0.035]" : ""}`}>{content}</button>}</li>;
        })}</ul>}</div>
      </section>, document.body)}
    </div>
  );
}
