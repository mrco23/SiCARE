import type { Availability, Slot } from "../../types/counselorSchedule";

/** Relative demo availability for the counselor's calendar; it is not linked to booking/session IDs. */
export function createCounselorScheduleSeed(today: Date): Availability {
  const availability: Availability = {};
  const pad = (value: number) => String(value).padStart(2, "0");
  const addDays = (date: Date, amount: number) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
  const keyOf = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const put = (offset: number, slots: Slot[]) => {
    availability[keyOf(addDays(today, offset))] = slots;
  };
  const available = (start: number): Slot => ({ start, status: "tersedia" });
  const booked = (start: number, client: string): Slot => ({
    start,
    status: "sesi",
    client,
  });

  put(-3, [booked(9 * 60, "Klien Anonim #B7C1"), available(10 * 60)]);
  put(-1, [available(13 * 60)]);
  put(1, [available(8 * 60), booked(10 * 60, "Klien Anonim #A3F2"), available(13 * 60)]);
  put(2, [available(9 * 60)]);
  put(4, [available(8 * 60), booked(9 * 60, "Klien Anonim #4D9E"), available(12 * 60)]);
  put(5, [booked(13 * 60 + 30, "Klien Anonim #7F12")]);
  put(7, [available(10 * 60), available(11 * 60)]);
  put(9, [available(8 * 60)]);
  put(12, [booked(9 * 60, "Klien Anonim #C0DE"), available(13 * 60)]);
  put(14, [available(10 * 60)]);

  return availability;
}
