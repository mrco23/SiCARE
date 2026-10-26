import type { CounselingFormat, IntakeAnswer } from "../../../types/counseling";
import {
  INTAKE_ESSAY_OPTIONS,
  INTAKE_SCALE_OPTIONS,
  INTAKE_YESNO_OPTIONS,
} from "../../../data/mock/intakeOptions";

/** Intake answers intentionally remain local to the booking form and are not stored in Zustand. */
export interface ClientIntakeForm {
  selfHarm: IntakeAnswer | null;
  distress: IntakeAnswer | null;
  abuse: IntakeAnswer | null;
  substance: IntakeAnswer | null;
  sleep: number | null;
  finance: number | null;
  topics: string[];
  otherOn: boolean;
  other: string;
  complaint: string;
  history: string;
  reason: string;
  efforts: string;
  goal: string;
  strengths: string;
  weaknesses: string;
  groupName: string;
  groupSize: string;
  groupMembers: string;
  declared: boolean;
  consent: boolean;
}

export const createEmptyClientIntakeForm = (): ClientIntakeForm => ({
  selfHarm: null,
  distress: null,
  abuse: null,
  substance: null,
  sleep: null,
  finance: null,
  topics: [],
  otherOn: false,
  other: "",
  complaint: "",
  history: "",
  reason: "",
  efforts: "",
  goal: "",
  strengths: "",
  weaknesses: "",
  groupName: "",
  groupSize: "",
  groupMembers: "",
  declared: false,
  consent: false,
});

/** Pure validation shared by the booking page and future focused tests. */
export function validateClientIntakeForm(
  form: ClientIntakeForm,
  service: CounselingFormat | null,
): string[] {
  const missing: string[] = [];

  INTAKE_YESNO_OPTIONS.forEach(({ key }) => {
    if (!form[key]) missing.push(key);
  });
  INTAKE_SCALE_OPTIONS.forEach(({ key }) => {
    if (!form[key]) missing.push(key);
  });

  const hasOther = form.otherOn && form.other.trim().length > 0;
  if (!form.topics.length && !hasOther) missing.push("topics");

  INTAKE_ESSAY_OPTIONS.forEach(({ key }) => {
    if (!form[key].trim()) missing.push(key);
  });

  if (service === "Kelompok") {
    const size = Number(form.groupSize);
    if (!form.groupName.trim()) missing.push("groupName");
    if (!Number.isInteger(size) || size < 2 || size > 10) {
      missing.push("groupSize");
    }
    if (!form.groupMembers.trim()) missing.push("groupMembers");
  }

  return missing;
}
