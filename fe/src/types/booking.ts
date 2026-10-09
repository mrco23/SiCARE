import type { BookingStatus } from "../constants/status";

export interface Booking {
  id: string;
  clientId: string;
  counselorId: string;
  serviceType: "INDIVIDUAL" | "GROUP";
  date: string;
  startTime: string;
  status: BookingStatus;
}
