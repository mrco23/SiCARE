import { useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import {
  useNotificationStore,
  type NotificationRole,
} from "../../features/notification/notificationStore";

type NotificationFilter = "all" | "unread";

type NotificationBellProps = {
  role: NotificationRole;
  recipientId: string;
  wrapperClassName?: string;
  buttonClassName?: string;
};

const joinClasses = (...classes: Array<string | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function NotificationBell({
  role,
  recipientId,
  wrapperClassName,
  buttonClassName,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const notifications = useNotificationStore((state) => state.notifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

  const ownNotifications = useMemo(
    () =>
      notifications
        .filter(
          (notification) =>
            notification.recipientId === recipientId &&
            notification.recipientRole === role,
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [notifications, recipientId, role],
  );
  const unreadCount = ownNotifications.filter(
    (notification) => notification.readAt === null,
  ).length;
  const visibleNotifications =
    filter === "unread"
      ? ownNotifications.filter((notification) => notification.readAt === null)
      : ownNotifications;

  const handleNotificationClick = (id: string) => {
    markAsRead(id);
    setOpen(false);
  };

  return (
    <div className={joinClasses(wrapperClassName)}>
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifikasi, ${unreadCount} belum dibaca`
            : "Notifikasi"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notifikasi"
        onClick={() => setOpen((current) => !current)}
        className={joinClasses(
          "relative flex items-center justify-center rounded-full text-[#333] transition-colors hover:bg-gray-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          buttonClassName,
        )}
      >
        <Bell className="h-[19px] w-[19px]" fill="currentColor" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Daftar notifikasi"
          className="fixed right-4 top-[4.75rem] z-[100] flex max-h-[min(34rem,calc(100vh-6rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.2)] sm:right-6 sm:top-[5.25rem]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Notifikasi</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {unreadCount === 0
                  ? "Tidak ada notifikasi belum dibaca"
                  : `${unreadCount} belum dibaca`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead(recipientId)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary-soft"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Baca semua
                </button>
              )}
              <button
                type="button"
                aria-label="Tutup notifikasi"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-1 border-b border-gray-100 px-3 py-2">
            {([
              { value: "all", label: "Semua" },
              { value: "unread", label: "Belum dibaca" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === option.value
                    ? "bg-primary text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Bell className="mx-auto h-7 w-7 text-gray-300" />
                <p className="mt-3 text-sm font-semibold text-gray-700">
                  {filter === "unread"
                    ? "Semua notifikasi sudah dibaca"
                    : "Belum ada notifikasi"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Notifikasi baru akan muncul di sini.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {visibleNotifications.map((notification) => {
                  const content = (
                    <>
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          notification.readAt === null
                            ? "bg-primary"
                            : "bg-transparent"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {notification.title}
                          </span>
                          {notification.href && (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-gray-600">
                          {notification.message}
                        </span>
                        <span className="mt-2 block text-[10px] font-medium text-gray-400">
                          {new Date(notification.createdAt).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                    </>
                  );

                  return (
                    <li key={notification.id}>
                      {notification.href ? (
                        <Link
                          to={notification.href}
                          onClick={() => handleNotificationClick(notification.id)}
                          className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 ${
                            notification.readAt === null ? "bg-primary/[0.035]" : ""
                          }`}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(notification.id)}
                          className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 ${
                            notification.readAt === null ? "bg-primary/[0.035]" : ""
                          }`}
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
