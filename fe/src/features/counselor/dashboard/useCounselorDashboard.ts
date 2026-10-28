import { useCallback, useEffect, useMemo, useState } from "react";
import { COUNSELING_REQUEST_STATUS } from "../../../constants/status";
import {
  initialRequests,
  initialSessions,
  RATINGS,
  type Request,
  type Session,
} from "../../../data/mock/counselorDashboard";

export type DashboardSessionState = "done" | "live" | "upcoming";

export function dashboardTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(".").map(Number);
  return hours * 60 + minutes;
}

export function getDashboardSessionState(
  session: Session,
  nowMinutes: number,
): DashboardSessionState {
  const start = dashboardTimeToMinutes(session.time);
  const end = start + 60;
  if (nowMinutes >= end) return "done";
  if (nowMinutes >= start) return "live";
  return "upcoming";
}

export function dashboardWaitLabel(minutes: number): string {
  if (minutes < 60) return `Menunggu ${minutes} menit`;
  if (minutes < 1440) return `Menunggu ${Math.floor(minutes / 60)} jam`;
  return `Menunggu ${Math.floor(minutes / 1440)} hari`;
}

export function useCounselorDashboard() {
  const [now, setNow] = useState(() => new Date());
  const [requests, setRequests] = useState<Request[]>(initialRequests);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const pendingRequests = useMemo(
    () =>
      requests
        .filter((request) => request.status === COUNSELING_REQUEST_STATUS.PENDING)
        .sort((a, b) => b.waitMin - a.waitMin),
    [requests],
  );
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => dashboardTimeToMinutes(a.time) - dashboardTimeToMinutes(b.time)),
    [sessions],
  );
  const nextId = sortedSessions.find(
    (session) => getDashboardSessionState(session, nowMin) === "upcoming",
  )?.id;
  const liveSessions = sortedSessions.filter(
    (session) => getDashboardSessionState(session, nowMin) === "live",
  );
  const upcomingCount = sortedSessions.filter(
    (session) => getDashboardSessionState(session, nowMin) === "upcoming",
  ).length;
  const avgRating = RATINGS.reduce((sum, rating) => sum + rating, 0) / RATINGS.length;
  const todayLabel = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const summary =
    pendingRequests.length > 0
      ? `Anda punya ${pendingRequests.length} permintaan menunggu dan ${upcomingCount} sesi lagi hari ini.`
      : `Tidak ada permintaan menunggu. ${upcomingCount} sesi lagi hari ini.`;

  const decideRequest = useCallback(
    (id: number, accept: boolean): string | null => {
      const request = requests.find((item) => item.id === id);
      if (!request) return null;

      setRequests((previous) =>
        previous.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status: accept
                  ? COUNSELING_REQUEST_STATUS.ACCEPTED
                  : COUNSELING_REQUEST_STATUS.REJECTED,
              }
            : item,
        ),
      );

      if (accept) {
        setSessions((previous) => [
          ...previous,
          {
            id: 200 + request.id,
            client: request.name,
            topic: request.topic,
            format: request.format,
            time: "16.00",
          },
        ]);
      }

      return accept
        ? "Permintaan diterima. Sesi ditambahkan ke jadwal."
        : "Permintaan ditolak.";
    },
    [requests],
  );

  return {
    now,
    nowMin,
    requests,
    sessions,
    pendingRequests,
    sortedSessions,
    nextId,
    liveSessions,
    upcomingCount,
    avgRating,
    todayLabel,
    summary,
    decideRequest,
  };
}
