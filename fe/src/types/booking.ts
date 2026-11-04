import type { BookingStatus, CounselingRequestStatus } from "../constants/status";
import type { CounselingFormat, IntakeAnswer } from "./counseling";

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

export type CounselingRequest = {
  id: number;
  name: string;
  format: CounselingFormat;
  time: string;
  waitMin: number;
  status: CounselingRequestStatus;
  isNew: boolean;
  pastSessions: number;
  topic: string;
  room?: string;
};

export type IntakeData = {
  date: string;
  selfHarm: IntakeAnswer;
  distress: IntakeAnswer;
  abuse: IntakeAnswer;
  substance: IntakeAnswer;
  sleep: number;
  finance: number;
  topics: string[];
  other: string;
  complaint: string;
  history: string;
  reason: string;
  efforts: string;
  goal: string;
  strengths: string;
  weaknesses: string;
};
