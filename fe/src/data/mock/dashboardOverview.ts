/** Shared dashboard summary values that were duplicated verbatim across roles. */
export const DASHBOARD_COUNTS = {
  totalRequests: 124,
  completedSessions: 98,
  cancelled: 8,
  pending: 5,
} as const;

export const WEEKLY_SESSIONS = [
  { label: "Minggu 1", value: 14 },
  { label: "Minggu 2", value: 30 },
  { label: "Minggu 3", value: 20 },
  { label: "Minggu 4", value: 16 },
] as const;

/**
 * Workload summary is a dashboard snapshot, not a relation to the detailed
 * counselor directory or report session fixtures.
 */
export const COUNSELOR_WORKLOAD = [
  {
    name: "Ma'am Giovanna Yudi, M.Psi",
    sessions: 24,
    availability: "available",
    avatar: "https://ui-avatars.com/api/?name=Giovanna+Yudi&background=15803d&color=fff",
  },
  {
    name: "Dr. Budi Santoso, Psikolog",
    sessions: 19,
    availability: "full",
    avatar: "https://ui-avatars.com/api/?name=Budi+Santoso&background=475569&color=fff",
  },
] as const;
