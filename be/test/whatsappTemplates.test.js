import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeFormatAndRoom,
  formatBookingReference,
  formatIndonesianDate,
  formatIndonesianTimeWindow,
  renderWhatsAppTemplate,
  WHATSAPP_TEMPLATES,
} from "../src/templates/whatsapp/index.js";

test("formatIndonesianDate formats ISO strings to Indonesian day and month names", () => {
  const result = formatIndonesianDate("2026-11-02T10:00:00Z");
  assert.match(result, /2026/);
  assert.match(result, /November/);
});

test("formatIndonesianTimeWindow formats start and end times to WIB", () => {
  const result = formatIndonesianTimeWindow("2026-11-02T07:00:00Z", "2026-11-02T08:00:00Z");
  assert.match(result, /WIB/);
});

test("formatBookingReference produces clean short reference", () => {
  const ref = formatBookingReference("12345678-abcd-1234-abcd-123456789abc");
  assert.equal(ref, "#SC-123456");
});

test("describeFormatAndRoom formats online vs offline with room", () => {
  const online = describeFormatAndRoom("online", "https://meet.google.com/xyz");
  assert.match(online.sessionFormat, /Online/);
  assert.match(online.roomInfo, /meet\.google\.com/);

  const offline = describeFormatAndRoom("offline", "Ruang Konseling LMI 102");
  assert.match(offline.sessionFormat, /Tatap Muka/);
  assert.match(offline.roomInfo, /Ruangan: Ruang Konseling LMI 102/);
});

test("all 8 templates render without errors and contain required operational fields", () => {
  const sampleVars = {
    booking_id: "c7b5a190-2f3b-48aa-b55d-35712f5a65c2",
    client_name: "Ahmad Mahasiswa",
    counselor_name: "Dr. Siti Konselor",
    recipient_name: "Ahmad Mahasiswa",
    partner_name: "Dr. Siti Konselor",
    starts_at: "2026-11-05T09:00:00.000Z",
    ends_at: "2026-11-05T10:00:00.000Z",
    service_type: "individual",
    session_format: "offline",
    room: "Ruang 101",
    initiator_role: "counselor",
    reason: "Jadwal darurat kampus",
  };

  const templates = [
    "booking-requested",
    "booking-received",
    "booking-accepted",
    "booking-rejected",
    "reschedule-requested",
    "booking-cancelled",
    "session-reminder-h1",
    "session-reminder-day-of",
  ];

  for (const tpl of templates) {
    const text = renderWhatsAppTemplate(tpl, sampleVars);
    assert.equal(typeof text, "string");
    assert.ok(text.length > 50);
    assert.match(text, /Halo /);
    assert.match(text, /Nomor Booking: #SC-/);
    assert.match(text, /SiCARE/);

    // Strict privacy assurance: no clinical/intake fields
    assert.equal(text.includes("intake"), false);
    assert.equal(text.includes("diagnosa"), false);
    assert.equal(text.includes("catatan klinis"), false);
  }
});

test("renderWhatsAppTemplate handles DB message_type aliases with underscores", () => {
  const vars = {
    booking_id: "11111111-2222-3333-4444-555555555555",
    recipient_name: "Budi",
    partner_name: "Bu Konselor",
    starts_at: "2026-11-05T09:00:00.000Z",
    ends_at: "2026-11-05T10:00:00.000Z",
    session_format: "online",
  };

  const textH1 = renderWhatsAppTemplate("reminder_h1", vars);
  assert.match(textH1, /besok/);

  const textDayOf = renderWhatsAppTemplate("reminder_day_of", vars);
  assert.match(textDayOf, /dalam 1 jam/);

  const textAccepted = renderWhatsAppTemplate("booking_accepted", vars);
  assert.match(textAccepted, /dikonfirmasi/);
});

test("renderWhatsAppTemplate throws for unknown template", () => {
  assert.throws(() => {
    renderWhatsAppTemplate("non_existent_template", {});
  }, /tidak ditemukan/);
});
