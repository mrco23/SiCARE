import { create } from "zustand";

export type NotificationRole = "client" | "counselor" | "admin" | "headlmi";

/** Demo identities are explicit because the prototype does not yet have an auth-backed user session. */
export const DEMO_NOTIFICATION_RECIPIENTS = {
  client: "client-demo",
  counselor: "counselor-giovanna-yudi",
  admin: "admin-demo",
  headlmi: "headlmi-demo",
} as const;

export interface AppNotification {
  id: string;
  recipientId: string;
  recipientRole: NotificationRole;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  href?: string;
}

type AddNotificationInput = Omit<AppNotification, "id" | "createdAt" | "readAt"> & {
  createdAt?: string;
};

interface NotificationStore {
  notifications: AppNotification[];
  addNotification: (input: AddNotificationInput) => string;
  markAsRead: (id: string) => void;
  markAllAsRead: (recipientId: string) => void;
}

const initialTimestamp = new Date().toISOString();

const initialNotifications: AppNotification[] = [
  {
    id: "seed-counselor-requests",
    recipientId: DEMO_NOTIFICATION_RECIPIENTS.counselor,
    recipientRole: "counselor",
    title: "Permintaan konseling menunggu",
    message: "Ada 4 permintaan konseling pada antrean demo yang perlu ditinjau.",
    createdAt: initialTimestamp,
    readAt: null,
    href: "/konselor/permintaan",
  },
  {
    id: "seed-admin-feedback",
    recipientId: DEMO_NOTIFICATION_RECIPIENTS.admin,
    recipientRole: "admin",
    title: "Feedback menunggu moderasi",
    message: "Ada 3 feedback berstatus pending pada data demo.",
    createdAt: initialTimestamp,
    readAt: null,
    href: "/admin/feedback",
  },
  {
    id: "seed-headlmi-report",
    recipientId: DEMO_NOTIFICATION_RECIPIENTS.headlmi,
    recipientRole: "headlmi",
    title: "Laporan konseling tersedia",
    message: "Buka halaman laporan untuk meninjau ringkasan data demo.",
    createdAt: initialTimestamp,
    readAt: null,
    href: "/kepala-lmi/laporan",
  },
];

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: initialNotifications,
  addNotification: (input) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const notification: AppNotification = {
      ...input,
      id,
      createdAt: input.createdAt ?? new Date().toISOString(),
      readAt: null,
    };
    set((state) => ({ notifications: [notification, ...state.notifications] }));
    return id;
  },
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === id && notification.readAt === null
          ? { ...notification, readAt: new Date().toISOString() }
          : notification,
      ),
    })),
  markAllAsRead: (recipientId) => {
    const readAt = new Date().toISOString();
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.recipientId === recipientId && notification.readAt === null
          ? { ...notification, readAt }
          : notification,
      ),
    }));
  },
}));
