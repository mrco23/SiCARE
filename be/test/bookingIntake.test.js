import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clientIntakeAnswersSchema,
  createBookingSchema,
} from "../src/validators/booking.validator.js";
import { bookingRepository } from "../src/repositories/booking.repository.js";
import { attachIntakeAnswersForCounselor } from "../src/services/booking.service.js";

const validIntake = {
  selfHarm: "Tidak",
  distress: "Mungkin",
  abuse: "Tidak",
  substance: "Tidak",
  sleep: 3,
  finance: 4,
  topics: ["Kecemasan"],
  other: "",
  complaint: "Sulit tidur.",
  history: "Sejak dua bulan lalu.",
  reason: "Ingin lebih tenang.",
  efforts: "Sudah coba olahraga.",
  goal: "Tidur lebih baik.",
  strengths: "Disiplin.",
  weaknesses: "Mudah cemas.",
};

test("clientIntakeAnswersSchema accepts a fully-filled form", () => {
  const result = clientIntakeAnswersSchema.safeParse(validIntake);
  assert.equal(result.success, true);
});

test("clientIntakeAnswersSchema rejects a missing required field", () => {
  const { complaint, ...incomplete } = validIntake;
  const result = clientIntakeAnswersSchema.safeParse(incomplete);
  assert.equal(result.success, false);
});

test("clientIntakeAnswersSchema rejects an out-of-range scale answer", () => {
  const result = clientIntakeAnswersSchema.safeParse({ ...validIntake, sleep: 6 });
  assert.equal(result.success, false);
});

test("clientIntakeAnswersSchema rejects when no topic and no 'other' text are given", () => {
  const result = clientIntakeAnswersSchema.safeParse({ ...validIntake, topics: [], other: "" });
  assert.equal(result.success, false);
});

test("clientIntakeAnswersSchema accepts 'other' text in place of a topic", () => {
  const result = clientIntakeAnswersSchema.safeParse({ ...validIntake, topics: [], other: "Hal lain" });
  assert.equal(result.success, true);
});

test("createBookingSchema accepts an individual booking with intake_answers", () => {
  const result = createBookingSchema.safeParse({
    counselor_id: "11111111-1111-4111-8111-111111111111",
    availability_slot_id: "22222222-2222-4222-8222-222222222222",
    service_type: "individual",
    intake_answers: validIntake,
  });
  assert.equal(result.success, true);
});

test("createBookingSchema still accepts a booking with no intake_answers (optional)", () => {
  const result = createBookingSchema.safeParse({
    counselor_id: "11111111-1111-4111-8111-111111111111",
    availability_slot_id: "22222222-2222-4222-8222-222222222222",
    service_type: "individual",
  });
  assert.equal(result.success, true);
});

test("findIntakeAnswersByBookingIds returns an empty map without querying when given no ids", async () => {
  const result = await bookingRepository.findIntakeAnswersByBookingIds(
    { from: () => { throw new Error("should not be called"); } },
    [],
  );
  assert.deepEqual(result, new Map());
});

test("findIntakeAnswersByBookingIds keys rows by booking_id", async () => {
  const mockClient = {
    from(table) {
      assert.equal(table, "booking_intakes");
      return {
        select() {
          return {
            in: async (_column, ids) => ({
              data: ids.map((id) => ({ booking_id: id, answers: { ...validIntake } })),
              error: null,
            }),
          };
        },
      };
    },
  };

  const result = await bookingRepository.findIntakeAnswersByBookingIds(mockClient, ["book-1", "book-2"]);
  assert.equal(result.size, 2);
  assert.deepEqual(result.get("book-1"), validIntake);
});

test("saveIntakeAnswers upserts on booking_id and throws a readable error on failure", async () => {
  const calls = [];
  const okClient = {
    from(table) {
      return {
        upsert: async (payload, options) => {
          calls.push({ table, payload, options });
          return { error: null };
        },
      };
    },
  };
  await bookingRepository.saveIntakeAnswers(okClient, {
    bookingId: "book-1",
    clientId: "client-1",
    answers: validIntake,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.onConflict, "booking_id");

  const failingClient = {
    from: () => ({ upsert: async () => ({ error: { message: "boom" } }) }),
  };
  await assert.rejects(
    bookingRepository.saveIntakeAnswers(failingClient, {
      bookingId: "book-1",
      clientId: "client-1",
      answers: validIntake,
    }),
  );
});

test("attachIntakeAnswersForCounselor fails open when booking_intakes is unreadable (e.g. migration not applied)", async () => {
  // Regression test: before this fix, a missing booking_intakes table made
  // GET /bookings 500 for every counselor, instead of just omitting intake_answers.
  const brokenClient = {
    from(table) {
      if (table !== "booking_intakes") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          in: async () => ({
            data: null,
            error: { message: "Could not find the table 'public.booking_intakes' in the schema cache" },
          }),
        }),
      };
    },
  };

  const bookings = [{ id: "book-1" }, { id: "book-2" }];
  const result = await attachIntakeAnswersForCounselor(
    brokenClient,
    { app_role: "counselor" },
    bookings,
  );

  assert.equal(result, bookings);
  assert.equal(bookings[0].intake_answers, undefined);
  assert.equal(bookings[1].intake_answers, undefined);
});

test("attachIntakeAnswersForCounselor attaches answers for counselor role and leaves client role untouched", async () => {
  const mockClient = {
    from(table) {
      assert.equal(table, "booking_intakes");
      return {
        select: () => ({
          in: async () => ({ data: [{ booking_id: "book-1", answers: validIntake }], error: null }),
        }),
      };
    },
  };

  const counselorBookings = [{ id: "book-1" }, { id: "book-2" }];
  await attachIntakeAnswersForCounselor(mockClient, { app_role: "counselor" }, counselorBookings);
  assert.deepEqual(counselorBookings[0].intake_answers, validIntake);
  assert.equal(counselorBookings[1].intake_answers, null);

  const clientBookings = [{ id: "book-1" }];
  const neverCalledClient = { from: () => { throw new Error("should not query for client role"); } };
  await attachIntakeAnswersForCounselor(neverCalledClient, { app_role: "client" }, clientBookings);
  assert.equal(clientBookings[0].intake_answers, undefined);
});
