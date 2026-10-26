import type { BookingStatus } from "../constants/status";

export type BookingServiceType = "INDIVIDUAL" | "GROUP";

export interface Booking {
  id: string;
  clientId: string;
  counselorId: string;
  serviceType: BookingServiceType;
  date: string;
  startTime: string;
  status: BookingStatus;
}
