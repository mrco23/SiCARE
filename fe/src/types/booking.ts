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

/** Runtime booking metadata shared by the client, counselor, and admin views. */
export interface BookingRecord extends Booking {
  clientName: string;
  counselorName: string;
  topic: string;
  createdAt: string;
  room?: string;
}

/** Input for creating a booking; intake answers are intentionally excluded. */
export type CreateBookingInput = Omit<
  BookingRecord,
  "id" | "status" | "createdAt" | "room"
>;
