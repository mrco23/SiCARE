-- SiCARE: buat SATU sesi individu yang dapat langsung dimulai oleh konselor.
--
-- Jalankan di Supabase Dashboard -> SQL Editor. Tidak menghapus data apa pun; hanya menambah
-- satu slot, satu booking terkonfirmasi, peserta, sesi terjadwal, informed consent (signed),
-- jawaban form awal, dan notifikasi konfirmasi.
--
-- Hasil: sesi mulai 10 menit setelah query dijalankan dan berdurasi 60 menit. Tombol
-- "Mulai Sesi" di Aktivitas Konselor aktif mulai 15 menit sebelum jadwal sampai jadwal
-- selesai, jadi sesi ini dapat dimulai SEGERA sampai sekitar 70 menit setelah query dijalankan.
-- Setelah jadwal selesai tanpa dimulai, sesi otomatis ditandai terlewat.
--
-- Ubah c_counselor / c_client bila perlu. Klien harus akun aktif ber-role client.
-- Data diberi penanda [DUMMY].

begin;

do $$
declare
  c_counselor constant text := 'giovana@unikadelasalle.ac.id';
  c_client    constant text := '24013031@unikadelasalle.ac.id';
  c_zone      constant text := 'Asia/Makassar';
  c_room      constant text := 'Ruang Konseling LMI';
  -- Harus sama dengan OFFICIAL_TEMPLATE_VERSION di be/src/services/consentPdf.service.js
  c_consent_version constant text := 'v1.0';

  v_now        timestamptz := now();
  v_today      date := (now() at time zone 'Asia/Makassar')::date;
  v_starts     timestamptz := date_trunc('minute', now()) + interval '10 minutes';
  v_ends       timestamptz := date_trunc('minute', now()) + interval '70 minutes';
  v_counselor  uuid;
  v_client     record;
  v_period_id  uuid;
  v_slot_id    uuid;
  v_booking_id uuid;
  v_part_id    uuid;
  v_session_id uuid;
begin
  -- Konselor aktif.
  select p.id into v_counselor
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(c_counselor) and p.app_role = 'counselor' and p.account_status = 'active';
  if v_counselor is null then
    raise exception 'Konselor % tidak ditemukan, bukan konselor, atau tidak aktif.', c_counselor;
  end if;

  -- Klien aktif.
  select p.id as user_id, p.full_name, p.identity_code as nim, p.phone_e164 as phone,
         case p.gender when 'male' then 'Laki-laki' when 'female' then 'Perempuan' end as gender_id
  into v_client
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(c_client) and p.app_role = 'client' and p.account_status = 'active';
  if v_client.user_id is null then
    raise exception 'Klien % tidak ditemukan, bukan klien, atau tidak aktif.', c_client;
  end if;

  -- Periode akademik yang mencakup hari ini (WITA).
  select id into v_period_id
  from public.academic_periods
  where v_today between starts_on and ends_on
  order by is_published desc, starts_on desc
  limit 1;
  if v_period_id is null then
    raise exception 'Tidak ada periode akademik yang mencakup %. Tambahkan periode dulu.', v_today;
  end if;

  -- Slot, booking terkonfirmasi, dan peserta utama.
  insert into public.availability_slots (counselor_id, academic_period_id, starts_at, ends_at, status)
  values (v_counselor, v_period_id, v_starts, v_ends, 'available')
  returning id into v_slot_id;

  insert into public.bookings (
    client_id, counselor_id, availability_slot_id, service_type, participant_count,
    starts_at, ends_at, status, created_at, updated_at
  ) values (
    v_client.user_id, v_counselor, v_slot_id, 'individual', 1,
    v_starts, v_ends, 'confirmed', v_now - interval '2 hours', v_now - interval '1 hour'
  ) returning id into v_booking_id;

  insert into public.booking_participants (
    booking_id, user_id, display_name, full_name, is_representative, is_primary,
    participant_type, participant_status, nim, gender, phone_e164, created_at
  ) values (
    v_booking_id, v_client.user_id, v_client.full_name, v_client.full_name, true, true,
    'primary_client', 'registered', v_client.nim, v_client.gender_id, v_client.phone,
    v_now - interval '2 hours'
  ) returning id into v_part_id;

  -- Sesi terjadwal.
  insert into public.counseling_sessions (booking_id, counselor_id, starts_at, ends_at, status, room, created_at, updated_at)
  values (v_booking_id, v_counselor, v_starts, v_ends, 'scheduled', c_room, v_now - interval '1 hour', v_now - interval '1 hour')
  returning id into v_session_id;

  -- Informed consent sudah ditandatangani (syarat "Mulai Sesi").
  insert into public.informed_consents (
    booking_id, session_id, booking_participant_id, consent_statement_version, status,
    signer_user_id, signer_name_snapshot, identity_snapshot, viewed_at, signed_at,
    signature_method, created_at
  ) values (
    v_booking_id, v_session_id, v_part_id, c_consent_version, 'signed',
    v_client.user_id, v_client.full_name,
    jsonb_strip_nulls(jsonb_build_object('full_name', v_client.full_name, 'nim', v_client.nim, 'gender', v_client.gender_id)),
    v_now - interval '50 minutes', v_now - interval '45 minutes', 'electronic_canvas', v_now - interval '1 hour'
  );

  -- Jawaban form awal (format Google Form LMI), agar konselor dapat melihat form klien.
  if to_regclass('public.booking_intakes') is not null then
    insert into public.booking_intakes (booking_id, client_id, answers, created_at)
    values (v_booking_id, v_client.user_id, jsonb_build_object(
      'selfHarm', 'Tidak', 'distress', 'Mungkin', 'abuse', 'Tidak', 'substance', 'Tidak',
      'sleep', 3, 'finance', 3,
      'topics', jsonb_build_array('Motivasi'), 'other', '',
      'complaint', '[DUMMY] Sulit fokus mengikuti perkuliahan beberapa minggu terakhir.',
      'history', '[DUMMY] Mulai dirasakan sejak awal semester.',
      'reason', '[DUMMY] Ingin mendapat pandangan dan cara mengatasi.',
      'efforts', '[DUMMY] Sudah mencoba membuat jadwal belajar.',
      'goal', '[DUMMY] Lebih teratur dan tenang menjalani kuliah.',
      'strengths', '[DUMMY] Mau belajar dan terbuka pada masukan.',
      'weaknesses', '[DUMMY] Mudah menunda pekerjaan.'
    ), v_now - interval '2 hours');
  end if;

  -- Notifikasi konfirmasi ke klien (seperti sicare_transition_booking -> confirmed).
  insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at)
  values (v_client.user_id, 'booking.confirmed', 'Konseling dikonfirmasi',
          'Permintaan konseling diterima. Periksa detail sesi.', 'booking', v_booking_id, v_now - interval '1 hour');

  raise notice 'Sesi % dibuat: % s.d. % WITA (booking %). Dapat dimulai sampai % WITA.',
    v_session_id,
    to_char(v_starts at time zone c_zone, 'DD Mon YYYY HH24:MI'),
    to_char(v_ends at time zone c_zone, 'HH24:MI'),
    v_booking_id,
    to_char(v_ends at time zone c_zone, 'HH24:MI');
end;
$$;

commit;

-- Cek hasil:
-- select s.id, s.status, s.starts_at at time zone 'Asia/Makassar' as mulai_wita,
--        b.status as booking, ic.status as consent
-- from public.counseling_sessions s
-- join public.bookings b on b.id = s.booking_id
-- join public.informed_consents ic on ic.booking_id = b.id
-- join auth.users u on u.id = s.counselor_id
-- where u.email = 'giovana@unikadelasalle.ac.id' and s.status = 'scheduled'
-- order by s.starts_at desc limit 5;
