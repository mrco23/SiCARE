export type SlotStatus = "tersedia" | "sesi";
export type Slot = { start: number; status: SlotStatus; client?: string };
export type Availability = Record<string, Slot[]>;

export type EditorState = {
  mode: "new" | "edit";
  date: string;
  orig: number | null;
  initialStart: number;
  status: SlotStatus;
  client?: string;
};

export type CancelTarget = { date: string; start: number; client?: string };
export type CancelReason = { code: string; label: string; note: string };

export type CancellationRecord = CancelReason & {
  date: string;
  start: number;
  client: string;
  cancelledAt: string;
};
