// Zona waktu operasional LMI Unika De La Salle Manado (WITA). Semua jam di pesan WhatsApp memakai zona ini.
export const OPERATIONAL_TIME_ZONE = "Asia/Makassar";

const DAYS_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/**
 * Formats ISO date to Indonesian readable date string (e.g. "Senin, 3 November 2026")
 * @param {string|Date} dateInput
 * @param {string} [timeZone='Asia/Makassar']
 * @returns {string}
 */
export function formatIndonesianDate(dateInput, timeZone = OPERATIONAL_TIME_ZONE) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);

  try {
    const formatter = new Intl.DateTimeFormat("id-ID", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return formatter.format(date);
  } catch {
    const dayName = DAYS_ID[date.getDay()];
    const day = date.getDate();
    const monthName = MONTHS_ID[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName}, ${day} ${monthName} ${year}`;
  }
}

/**
 * Formats start and end times to Indonesian time window (e.g. "14:00 - 15:00 WITA")
 * @param {string|Date} startsAt
 * @param {string|Date} endsAt
 * @param {string} [timeZone='Asia/Makassar']
 * @returns {string}
 */
export function formatIndonesianTimeWindow(startsAt, endsAt, timeZone = OPERATIONAL_TIME_ZONE) {
  if (!startsAt) return "-";
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : null;
  if (Number.isNaN(start.getTime())) return "-";

  const pad = (n) => String(n).padStart(2, "0");

  let startStr = "";
  let endStr = "";
  try {
    const timeFormatter = new Intl.DateTimeFormat("id-ID", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    startStr = timeFormatter.format(start).replace(".", ":");
    if (end && !Number.isNaN(end.getTime())) {
      endStr = timeFormatter.format(end).replace(".", ":");
    }
  } catch {
    startStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    if (end && !Number.isNaN(end.getTime())) {
      endStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
    }
  }

  return endStr ? `${startStr} - ${endStr} WITA` : `${startStr} WITA`;
}

/**
 * Normalizes short booking reference
 * @param {string} bookingId
 * @returns {string}
 */
export function formatBookingReference(bookingId) {
  if (!bookingId || typeof bookingId !== "string") return "#SI-CARE";
  const cleaned = bookingId.replace(/-/g, "").toUpperCase();
  return `#SC-${cleaned.slice(0, 6)}`;
}

/**
 * Translates format to Indonesian readable description
 * @param {string|null|undefined} format
 * @param {string|null|undefined} room
 * @returns {{ sessionFormat: string, roomInfo: string, formatIcon: string }}
 */
export function describeFormatAndRoom(format, room) {
  const isOnline = format === "online";
  const sessionFormat = isOnline ? "Online (Daring)" : "Tatap Muka (Luring)";
  const formatIcon = isOnline ? "💻" : "🏫";
  let roomInfo = "";
  if (!isOnline && room && room.trim()) {
    roomInfo = `📍 Ruangan: ${room.trim()}\n`;
  } else if (isOnline && room && room.trim()) {
    roomInfo = `🔗 Tautan: ${room.trim()}\n`;
  }
  return { sessionFormat, roomInfo, formatIcon };
}

/**
 * @param {Record<string, any>} vars
 * @returns {{ date: string, time: string }}
 */
function sessionWhen(vars) {
  return {
    date: vars.starts_at ? formatIndonesianDate(vars.starts_at) : vars.session_date || "-",
    time: vars.starts_at ? formatIndonesianTimeWindow(vars.starts_at, vars.ends_at) : vars.session_time || "-",
  };
}

// Emoji dan *tebal* WhatsApp membuat pesan mudah dipindai; tidak ada data sensitif di dalamnya.
const SIGNATURE = "Terima kasih 🙏\n*Tim SiCARE*";

/**
 * Template definitions registry
 */
export const WHATSAPP_TEMPLATES = {
  "booking-requested": (vars) => {
    const counselorName = vars.counselor_name || vars.recipient_name || "Konselor";
    const clientName = vars.client_name || "Klien";
    const ref = vars.booking_reference || formatBookingReference(vars.booking_id);
    const { date, time } = sessionWhen(vars);
    const serviceType = vars.service_type === "group" ? "Konseling Kelompok" : "Konseling Individu";

    return (
`Halo ${counselorName} 👋

📥 *Permintaan Konseling Baru*
Anda menerima permintaan jadwal konseling baru di SiCARE.

🔖 Nomor Booking: ${ref}
👤 Klien: ${clientName}
📅 Tanggal: ${date}
⏰ Waktu: ${time}
🧾 Layanan: ${serviceType}

👉 Silakan buka website SiCARE untuk meninjau dan mengonfirmasi permintaan ini.

Terima kasih 🙏
*Tim Layanan Mahasiswa dan Inklusi (LMI)*`
    );
  },

  "booking-received": (vars) => {
    const clientName = vars.client_name || vars.recipient_name || "Klien";
    const counselorName = vars.counselor_name || "Konselor";
    const ref = vars.booking_reference || formatBookingReference(vars.booking_id);
    const { date, time } = sessionWhen(vars);

    return (
`Halo ${clientName} 👋

📨 *Permintaan Diterima*
Permintaan jadwal konseling Anda telah kami terima dan sedang menunggu konfirmasi dari konselor.

🔖 Nomor Booking: ${ref}
👤 Konselor: ${counselorName}
📅 Tanggal: ${date}
⏰ Waktu: ${time}

⏳ Kami akan mengirimkan pemberitahuan setelah konselor mengonfirmasi jadwal Anda. Detail booking dapat dilihat di website SiCARE.

${SIGNATURE}`
    );
  },

  "booking-accepted": (vars) => {
    const clientName = vars.client_name || vars.recipient_name || "Klien";
    const counselorName = vars.counselor_name || "Konselor";
    const ref = vars.booking_reference || formatBookingReference(vars.booking_id);
    const { date, time } = sessionWhen(vars);
    const { roomInfo } = describeFormatAndRoom(vars.session_format, vars.room);

    return (
`Halo ${clientName} 👋

✅ *Jadwal Dikonfirmasi*
Permintaan konseling Anda telah dikonfirmasi.

🔖 Nomor Booking: ${ref}
👤 Konselor: ${counselorName}
📅 Tanggal: ${date}
⏰ Waktu: ${time}
${roomInfo}
👉 Silakan buka website SiCARE untuk melihat detail booking Anda.

${SIGNATURE}`
    );
  },

  "booking-rejected": (vars) => {
    const clientName = vars.client_name || vars.recipient_name || "Klien";
    const counselorName = vars.counselor_name || "Konselor";
    const ref = vars.booking_reference || formatBookingReference(vars.booking_id);
    const reason = vars.reason ? `📝 Alasan: ${vars.reason}\n` : "";

    return (
`Halo ${clientName} 👋

❌ *Permintaan Belum Dapat Dijadwalkan*
Mohon maaf, permintaan konseling Anda belum dapat kami jadwalkan saat ini.

🔖 Nomor Booking: ${ref}
👤 Konselor: ${counselorName}
${reason}
👉 Silakan memilih jadwal atau konselor lain yang tersedia melalui website SiCARE.

Terima kasih atas pengertian Anda 🙏
*Tim SiCARE*`
    );
  },

  "reschedule-requested": (vars) => {
    const recipientName = vars.recipient_name || "Pengguna SiCARE";
    const ref = vars.booking_reference || formatBookingReference(vars.booking_id);
    const initiator = vars.initiator_role === "counselor" ? "Konselor" : "Klien";
    const reason = vars.reason ? `📝 Alasan: ${vars.reason}\n` : "";

    return (
`Halo ${recipientName} 👋

🔄 *Permintaan Jadwal Ulang*
Terdapat permintaan penjadwalan ulang untuk sesi konseling Anda di SiCARE.

🔖 Nomor Booking: ${ref}
👤 Diajukan oleh: ${initiator}
${reason}
👉 Silakan buka website SiCARE untuk memilih atau meninjau slot jadwal pengganti.

${SIGNATURE}`
    );
  },

  "booking-cancelled": (vars) => {
    const recipientName = vars.recipient_name || "Pengguna SiCARE";
    const ref = vars.booking_reference || formatBookingReference(vars.booking_id);
    const initiator = vars.initiator_role === "counselor" ? "Konselor" : "Klien";
    const reasonInfo = vars.reason ? `📝 Alasan pembatalan: ${vars.reason}\n` : "";

    return (
`Halo ${recipientName} 👋

🚫 *Sesi Dibatalkan*
Pemberitahuan bahwa sesi konseling Anda di SiCARE telah dibatalkan.

🔖 Nomor Booking: ${ref}
👤 Dibatalkan oleh: ${initiator}
${reasonInfo}
👉 Silakan kunjungi website SiCARE jika Anda ingin menjadwalkan sesi konseling baru.

${SIGNATURE}`
    );
  },

  "session-reminder-h1": (vars) => {
    const recipientName = vars.recipient_name || "Pengguna SiCARE";
    const partnerName = vars.partner_name || "Konselor/Klien";
    const ref = vars.booking_reference || formatBookingReference(vars.booking_id);
    const { date, time } = sessionWhen(vars);
    // Format dan tautan sesi tidak dicantumkan; ruangan tetap disebut untuk sesi tatap muka.
    const { roomInfo } = describeFormatAndRoom(vars.session_format, vars.room);
    const roomLine = vars.session_format === "online" ? "" : roomInfo;

    return (
`Halo ${recipientName} 👋

🔔 *Pengingat Sesi Besok*
Anda memiliki jadwal sesi konseling besok di SiCARE.

🔖 Nomor Booking: ${ref}
👤 Dengan: ${partnerName}
📅 Tanggal: ${date}
⏰ Waktu: ${time}
${roomLine}
😇 Mohon hadir tepat waktu sesuai jadwal yang disepakati.

${SIGNATURE}`
    );
  },

  "session-reminder-morning": (vars) => {
    const recipientName = vars.recipient_name || "Pengguna SiCARE";
    const partnerName = vars.partner_name || "Konselor/Klien";
    const ref = vars.booking_reference || formatBookingReference(vars.booking_id);
    const { time } = sessionWhen(vars);
    const { roomInfo } = describeFormatAndRoom(vars.session_format, vars.room);

    return (
`Halo ${recipientName} 👋

☀️ *Pengingat Sesi Hari Ini*
Anda memiliki jadwal sesi konseling hari ini di SiCARE.

🔖 Nomor Booking: ${ref}
👤 Dengan: ${partnerName}
⏰ Waktu: ${time}
${roomInfo}
😇 Mohon hadir tepat waktu. Detail sesi dapat dilihat di website SiCARE.

${SIGNATURE}`
    );
  },

  "session-reminder-day-of": (vars) => {
    const recipientName = vars.recipient_name || "Pengguna SiCARE";
    const partnerName = vars.partner_name || "Konselor/Klien";
    const ref = vars.booking_reference || formatBookingReference(vars.booking_id);
    const { time } = sessionWhen(vars);
    const { sessionFormat, roomInfo, formatIcon } = describeFormatAndRoom(vars.session_format, vars.room);

    return (
`Halo ${recipientName} 👋

⏰ *Sesi Dimulai dalam 1 Jam*
Sesi konseling Anda di SiCARE akan dimulai dalam 1 jam.

🔖 Nomor Booking: ${ref}
👤 Dengan: ${partnerName}
⏰ Waktu: ${time}
${formatIcon} Format: ${sessionFormat}
${roomInfo}
👉 Silakan persiapkan diri Anda dan buka website SiCARE untuk detail sesi.

${SIGNATURE}`
    );
  },

  "consent-invitation": (vars) => {
    const recipientName = vars.recipient_name || "Peserta Konseling";
    const link = vars.invitation_link || "https://sicare.ac.id/consent/invite";

    return (
`Halo ${recipientName} 👋

📝 *Undangan Informed Consent*
Anda menerima undangan untuk melengkapi Informed Consent (Surat Pernyataan Kesediaan) konseling melalui SiCARE.

👉 Silakan buka tautan berikut untuk memeriksa data, membaca dokumen persetujuan resmi, dan melakukan tanda tangan secara mandiri:
${link}

🔒 Tautan ini bersifat pribadi dan rahasia. Jangan bagikan kepada orang lain.

${SIGNATURE}`
    );
  },

  "consent-reminder": (vars) => {
    const recipientName = vars.recipient_name || "Peserta Konseling";
    const link = vars.invitation_link || "https://sicare.ac.id/consent/invite";

    return (
`Halo ${recipientName} 👋

🔔 *Pengingat Informed Consent*
Anda belum melengkapi Informed Consent untuk sesi konseling di SiCARE.

👉 Mohon buka tautan berikut untuk melengkapi data dan menandatangani dokumen persetujuan sebelum sesi konseling dimulai:
${link}

🔒 Tautan ini bersifat pribadi dan rahasia. Jangan bagikan kepada orang lain.

${SIGNATURE}`
    );
  },
};

/**
 * Renders a WhatsApp message template by name.
 * Maps DB message_type to template identifier if needed.
 * @param {string} templateName
 * @param {Record<string, unknown>} variables
 * @returns {string}
 */
export function renderWhatsAppTemplate(templateName, variables = {}) {
  // Normalize message_type names e.g. reminder_h1 -> session-reminder-h1
  const normalizedKey = templateName.replace(/_/g, "-");
  let renderer = WHATSAPP_TEMPLATES[normalizedKey];

  if (!renderer && normalizedKey.startsWith("reminder-")) {
    renderer = WHATSAPP_TEMPLATES[`session-${normalizedKey}`];
  }

  if (!renderer) {
    throw new Error(`WhatsApp template '${templateName}' tidak ditemukan.`);
  }

  return renderer(variables);
}
