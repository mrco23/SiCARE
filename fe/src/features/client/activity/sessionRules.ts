import {
  CLIENT_SESSION_TIMELINE_STATUS,
  type ClientSessionTimelineStatus,
} from "../../../constants/status";
import type { Session } from "../../../data/mock/clientActivity";

export const RESCHEDULE_MIN_HOURS = 24;
export const RESCHEDULE_MAX = 1;

export const formatTime = (date: Date): string =>
  `${String(date.getHours()).padStart(2, "0")}.${String(date.getMinutes()).padStart(2, "0")}`;

export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const sameDay = (a: Date, b: Date): boolean =>
  a.toDateString() === b.toDateString();

export const dayLabel = (date: Date, now: number): string => {
  const today = startOfDay(new Date(now));
  const target = startOfDay(date);
  const difference = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );

  if (difference === 0) return "Hari ini";
  if (difference === 1) return "Besok";
  if (difference === -1) return "Kemarin";

  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

export const countdown = (milliseconds: number): string => {
  const minutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0
    ? `${hours} jam ${remainingMinutes} menit lagi`
    : `${remainingMinutes} menit lagi`;
};

export const statusOf = (
  session: Session,
  now: number,
): ClientSessionTimelineStatus => {
  if (now >= session.start.getTime() && now < session.end.getTime()) {
    return CLIENT_SESSION_TIMELINE_STATUS.ONGOING;
  }
  if (now >= session.end.getTime()) {
    return CLIENT_SESSION_TIMELINE_STATUS.COMPLETED;
  }
  return CLIENT_SESSION_TIMELINE_STATUS.UPCOMING;
};

export const canReschedule = (session: Session, now: number): boolean => {
  const hoursLeft = (session.start.getTime() - now) / 3_600_000;
  return (
    statusOf(session, now) === CLIENT_SESSION_TIMELINE_STATUS.UPCOMING &&
    hoursLeft >= RESCHEDULE_MIN_HOURS &&
    session.rescheduleCount < RESCHEDULE_MAX
  );
};

export const needsFeedback = (session: Session, now: number): boolean =>
  statusOf(session, now) === CLIENT_SESSION_TIMELINE_STATUS.COMPLETED &&
  !session.feedbackGiven;
