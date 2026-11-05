# Usulan: Catatan Sesi & Jawaban Intake pada `GET /counselor/history`

**Pembaruan 2026-11-05:** bagian `session_notes` sudah diimplementasikan (migrasi `20261105140000`). `booking_intakes` tetap usulan.

**Status:** USULAN — belum diterapkan. Belum ada file di `supabase/migrations/`, belum ada perubahan controller untuk bagian ini.
**Tanggal:** 2026-11-04
**Alasan ditahan:** `AGENTS.md` §3 dan `SOP_COVERAGE_MATRIX.md` #13 & #16 mensyaratkan field, akses, retensi, audit, dan penghapusan untuk intake/catatan konseling disahkan pemilik SOP sebelum tabel/endpoint dibuat.

## Temuan skema (working tree)

| Field frontend (`CounselorHistoryResponseDto`) | Sumber di repo | Status |
| --- | --- | --- |
| `clients[].photo_url` | Path bucket `avatars` di `auth.users.user_metadata.avatar_url` (ditulis `POST /profile/photo`, `be/src/routes/domain.routes.js`) | **Diimplementasikan** tanpa migrasi |
| `session_notes[]` | Tidak ada tabel. `counseling_sessions` (`20261027000000_sicare_core_schema.sql`) tidak punya kolom catatan. | Butuh migrasi + endpoint tulis |
| `intake_answers[]` | Tidak ada tabel. `POST /bookings` tidak menerima/menyimpan intake (matriks endpoint #22). | Butuh migrasi + perubahan RPC booking |

Catatan: membaca dua tabel ini saja tidak cukup — tanpa jalur tulis (`POST /bookings` untuk intake, endpoint catatan dari `KonselorAktivitasPage`) array akan selalu kosong.

## Draf migrasi (`20261104000000_sicare_session_notes_booking_intakes.sql`)

```sql
begin;

-- Jawaban intake per booking. Bentuk mengikuti ClientIntake (fe/src/types/counseling.ts).
create table if not exists public.booking_intakes (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_intakes_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint booking_intakes_answers_size check (pg_column_size(answers) <= 32768)
);

-- Catatan per sesi. Satu baris per sesi; penulis = konselor sesi tersebut.
create table if not exists public.session_notes (
  session_id uuid primary key references public.counseling_sessions(id) on delete cascade,
  counselor_id uuid not null references public.profiles(id) on delete restrict,
  counselor_note text,
  client_note text,
  follow_up text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_notes_counselor_note_len check (counselor_note is null or length(counselor_note) <= 10000),
  constraint session_notes_client_note_len check (client_note is null or length(client_note) <= 10000),
  constraint session_notes_follow_up_len check (follow_up is null or length(follow_up) <= 5000)
);

create index if not exists session_notes_counselor_idx on public.session_notes(counselor_id);
create index if not exists booking_intakes_client_idx on public.booking_intakes(client_id);

-- Hanya backend (service_role) yang boleh membaca/menulis.
alter table public.booking_intakes enable row level security;
alter table public.session_notes enable row level security;
revoke all on public.booking_intakes from anon, authenticated;
revoke all on public.session_notes from anon, authenticated;
grant all on public.booking_intakes to service_role;
grant all on public.session_notes to service_role;

drop trigger if exists booking_intakes_set_updated_at on public.booking_intakes;
create trigger booking_intakes_set_updated_at before update on public.booking_intakes
  for each row execute function public.handle_updated_at();
drop trigger if exists session_notes_set_updated_at on public.session_notes;
create trigger session_notes_set_updated_at before update on public.session_notes
  for each row execute function public.handle_updated_at();

commit;
```

## Draf perubahan controller (`getHistory`, setelah `bookings` dimuat)

```js
const sessionIds = (sessions ?? []).map((s) => s.id);
let sessionNotes = [];
if (sessionIds.length > 0) {
  const { data, error } = await client
    .from("session_notes")
    .select("session_id,counselor_note,client_note,follow_up")
    .eq("counselor_id", req.auth.user.id) // pemilik catatan, bukan hanya filter sesi
    .in("session_id", sessionIds);
  if (error) supabaseError(error, "Catatan sesi riwayat tidak dapat dibaca.");
  sessionNotes = data ?? [];
}

let intakeAnswers = [];
if (bookingIds.length > 0) {
  // bookingIds sudah dibatasi ke sesi milik konselor ini.
  const { data, error } = await client
    .from("booking_intakes")
    .select("booking_id,answers")
    .in("booking_id", bookingIds);
  if (error) supabaseError(error, "Jawaban intake riwayat tidak dapat dibaca.");
  intakeAnswers = data ?? [];
}

// writeAudit: tambah hanya hitungan, jangan isi catatan/jawaban.
metadata: { role: "counselor", count, notes_count: sessionNotes.length, intake_count: intakeAnswers.length }

// respons
return sendData(res, { configured: true, sessions, bookings, clients, session_notes: sessionNotes, intake_answers: intakeAnswers });
```

Tes yang perlu ditambah: tes migrasi (regex seperti `counselorHistoryCredentials.test.js`), tes bahwa catatan konselor lain tidak ikut terbaca, tes bahwa audit metadata tidak memuat isi catatan.

## Pertanyaan SOP yang harus dijawab sebelum diterapkan

1. **`client_note`:** ditulis siapa dan kapan? Klien melalui endpoint apa?
   - *Keputusan pengguna 2026-11-04:* klien hanya boleh membaca `client_note` dan `follow_up`; `counselor_note` hanya untuk konselor. Endpoint klien (mis. `GET /sessions/:id/notes`) harus memilih kolom di server (`select("session_id,client_note,follow_up")`) dan memeriksa `bookings.client_id`; jangan mengirim `counselor_note` lalu menyembunyikannya di UI. Masih perlu dikonfirmasi pemilik SOP.
2. **Booking kelompok:** intake satu per booking (perwakilan) atau per peserta (`booking_participants`)?
3. **Retensi & penghapusan:** berapa lama disimpan; apa yang terjadi saat akun klien dinonaktifkan/dihapus (draf memakai `on delete cascade`).
4. **Enkripsi kolom:** cukup RLS + service_role, atau perlu enkripsi aplikasi seperti `CONSENT_ENCRYPTION_KEY`?
5. **Akses lintas peran:** apakah Admin/Kepala LMI boleh membaca? Draf: tidak.
6. **Sesi dibatalkan:** apakah intake booking yang dibatalkan tetap tampil di riwayat?
