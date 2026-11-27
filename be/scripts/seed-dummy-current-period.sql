-- SiCARE: SEED DUMMY periode akademik aktif untuk konselor giovana@unikadelasalle.ac.id.
-- Simpan sebagai snippet di Supabase Dashboard -> SQL Editor (project NON-PRODUKSI) dan jalankan
-- SETELAH snippet "Reset Dummy" (be/scripts/reset-transactional-data.sql). Bukan migrasi.
-- Skrip TIDAK membuat atau mengubah akun (tidak menyentuh auth.users maupun profiles).
--
-- Akun (konstanta di bawah):
--   konselor   : giovana@unikadelasalle.ac.id (wajib ada, counselor aktif). Semua sesi milik konselor ini.
--   klien uji  : 24013037@unikadelasalle.ac.id (wajib ada, client aktif).
--   klien lain : semua client aktif lain, urut tanggal dibuat, dipakai bergiliran (klien uji hanya
--                dipakai bila klien lain tidak ada). Klien kelompok = perwakilan; anggota lain tamu [DUMMY].
--
-- 2.1  20 sesi yang sudah lewat, tersebar merata dari awal periode aktif sampai kemarin
--      (hari kerja, jam WITA), urutan jenis diselang-seling:
--        individu : 4 selesai + feedback, 2 selesai belum feedback, 1 selesai belum feedback milik
--                   24013037 (sesi selesai paling baru), 3 dibatalkan
--        kelompok : 5 selesai + feedback, 2 selesai belum feedback, 3 dibatalkan
--      Feedback: rating 3-5, status moderasi tampil / menunggu / dinonaktifkan bervariasi.
--      Dibatalkan: 4 oleh konselor (Hentikan/Urungkan Sesi, alasan berbeda) dan 2 oleh klien
--      (alasan berbeda); semuanya batal sebelum dimulai.
-- 2.2  2 sesi terjadwal Giovana dengan 24013037 pada dua hari kerja berbeda beberapa hari lagi:
--        J1 +2 hari kerja 10.00 (consent lengkap), J2 2 hari kerja setelah J1, 13.00 (consent belum
--        ditandatangani).
--   Catatan: dengan snippet "Sesi Mulai 2 Menit Lagi", 24013037 memiliki 3 booking aktif; aplikasi
--   membatasi 2 booking aktif per klien, jadi akun ini tidak bisa memesan baru sampai salah satunya
--   selesai/dibatalkan.
--
-- Ikut dibuat: slot, booking, peserta, intake [DUMMY], sesi, informed consent (signed untuk sesi
-- selesai; tanpa file PDF sehingga unduh PDF consent dummy gagal), catatan sesi [DUMMY], feedback,
-- dan notifikasi in-app dengan type yang dibuat backend/RPC.
-- TIDAK dibuat: whatsapp_outbox (tidak ada WhatsApp ke nomor asli), consent_invitations, audit log.
-- Skrip menolak berjalan bila tabel bookings belum kosong.
-- Tahan terhadap skema lama: counseling_sessions.format, informed_consents.consent_template_id,
-- academic_periods.is_published, dan counselor_profiles.is_public; booking_intakes dan
-- session_notes dilewati bila tabelnya belum ada.

begin;

-- Hari kerja terdekat (Senin-Jumat) dari p_day, bergeser ke arah p_dir (+1 / -1).
create or replace function pg_temp.sicare_dummy_workday(p_day date, p_dir int)
returns date language plpgsql as $f$
declare v date := p_day;
begin
  while extract(isodow from v) > 5 loop v := v + p_dir; end loop;
  return v;
end;
$f$;

do $$
declare
  c_target_client    constant text := '24013037@unikadelasalle.ac.id';
  c_target_counselor constant text := 'giovana@unikadelasalle.ac.id';
  c_zone     constant text := 'Asia/Makassar';
  -- Harus sama dengan OFFICIAL_TEMPLATE_VERSION di be/src/services/consentPdf.service.js
  c_consent_version constant text := 'v1.0';
  c_room     constant text := 'Ruang Konseling LMI';

  v_has_template_col boolean;
  v_has_format_col   boolean;
  v_has_publish_col  boolean;
  v_has_intakes boolean := to_regclass('public.booking_intakes') is not null;
  v_has_notes   boolean := to_regclass('public.session_notes') is not null;
  v_template_id uuid;
  v_version    text;
  v_missing    text;

  v_c_status   text;
  v_c_signer   uuid;
  v_c_name     text;
  v_c_identity jsonb;
  v_c_viewed   timestamptz;
  v_c_signed   timestamptz;
  v_c_method   text;

  v_now        timestamptz := now();
  v_today      date := (now() at time zone 'Asia/Makassar')::date;
  v_year       int := extract(year from (now() at time zone 'Asia/Makassar'))::int;
  v_month      int := extract(month from (now() at time zone 'Asia/Makassar'))::int;
  v_acad_year  text;
  v_semester   text;
  v_p_start    date;
  v_p_end      date;
  v_period     public.academic_periods%rowtype;
  v_first_day  date;
  v_last_day   date;
  v_span       int;

  v_target_client    uuid;
  v_counselor        uuid;
  v_pool       uuid[];
  v_n_pool     int;
  v_pool_idx   int := 0;
  v_i          int;
  v_k          int;
  v_n          int;
  v_sc         record;
  v_client     record;
  v_part       record;
  v_admin      record;
  v_day        date;
  v_hour       int;
  v_starts     timestamptz;
  v_ends       timestamptz;
  v_created    timestamptz;
  v_confirmed  timestamptz;
  v_cancelled  timestamptz;
  v_slot_id    uuid;
  v_booking_id uuid;
  v_session_id uuid;
  v_feedback_id uuid;
  v_signed     boolean;

  c_hours  int[] := array[9, 10, 13, 14, 15];
  c_guests text[] := array[
    'Yohanes Karundeng','Maria Sondakh','Paulus Watung','Agnes Pinontoan',
    'Stevanus Lengkong','Natalia Tuwaidan','Rio Palar','Grace Mamahit'];
begin
  -- ------------------------------------------------------------------ prasyarat skema
  select string_agg(r.tbl || '.' || r.col, ', ') into v_missing
  from (values
    ('profiles', 'gender'),
    ('profiles', 'member_category'),
    ('booking_participants', 'full_name'),
    ('booking_participants', 'is_primary'),
    ('booking_participants', 'nim'),
    ('informed_consents', 'consent_statement_version')
  ) as r(tbl, col)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col
  );
  if v_missing is not null then
    raise exception 'Migrasi database belum lengkap; kolom tidak ditemukan: %. Terapkan migrasi supabase/migrations terlebih dahulu.', v_missing;
  end if;

  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'counseling_sessions' and column_name = 'format')
  into v_has_format_col;
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'informed_consents' and column_name = 'consent_template_id')
  into v_has_template_col;
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_periods' and column_name = 'is_published')
  into v_has_publish_col;

  v_version := c_consent_version;
  if v_has_template_col then
    execute 'select id, version from public.consent_templates
             where template_code = $1 and is_active = true limit 1'
      into v_template_id, v_version using 'SICARE_IC_STD';
    if v_template_id is null then
      raise exception 'Template consent aktif SICARE_IC_STD tidak ditemukan.';
    end if;
  end if;
  if not v_has_intakes then
    raise notice 'Tabel booking_intakes belum ada; intake dummy dilewati.';
  end if;
  if not v_has_notes then
    raise notice 'Tabel session_notes belum ada; catatan sesi dummy dilewati.';
  end if;

  if exists (select 1 from public.bookings) then
    raise exception 'Tabel bookings belum kosong. Jalankan snippet Reset Dummy (reset-transactional-data.sql) dulu.';
  end if;

  -- ------------------------------------------------------------------ akun
  select p.id into v_counselor
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(c_target_counselor)
    and p.app_role = 'counselor' and p.account_status = 'active';
  if v_counselor is null then
    raise exception 'Konselor aktif % tidak ditemukan.', c_target_counselor;
  end if;
  if not public.is_public_counselor(v_counselor) then
    raise notice 'Konselor % belum tampil publik (nama publik kosong?); data tetap dibuat.', c_target_counselor;
  end if;

  select p.id into v_target_client
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(c_target_client)
    and p.app_role = 'client' and p.account_status = 'active';
  if v_target_client is null then
    raise exception 'Klien aktif % tidak ditemukan.', c_target_client;
  end if;

  select array_agg(p.id order by p.created_at) into v_pool
  from public.profiles p
  where p.app_role = 'client' and p.account_status = 'active' and p.id <> v_target_client;
  if v_pool is null then
    v_pool := array[v_target_client];
    raise notice 'Tidak ada klien aktif selain %; semua sesi memakai akun ini.', c_target_client;
  end if;
  v_n_pool := array_length(v_pool, 1);
  raise notice 'Klien lain aktif: % akun (19 sesi dibagi bergiliran).', v_n_pool;

  -- ------------------------------------------------------------------ periode aktif
  select * into v_period from public.academic_periods
  where v_today between starts_on and ends_on
  order by starts_on desc limit 1;

  if not found then
    if v_month >= 8 then
      v_acad_year := v_year || '/' || (v_year + 1); v_semester := 'Ganjil';
      v_p_start := make_date(v_year, 8, 1);         v_p_end := make_date(v_year + 1, 1, 31);
    elsif v_month = 1 then
      v_acad_year := (v_year - 1) || '/' || v_year; v_semester := 'Ganjil';
      v_p_start := make_date(v_year - 1, 8, 1);     v_p_end := make_date(v_year, 1, 31);
    else
      v_acad_year := (v_year - 1) || '/' || v_year; v_semester := 'Genap';
      v_p_start := make_date(v_year, 2, 1);         v_p_end := make_date(v_year, 7, 31);
    end if;

    insert into public.academic_periods (academic_year, semester, starts_on, ends_on)
    values (v_acad_year, v_semester, v_p_start, v_p_end)
    on conflict (academic_year, semester) do update
      set starts_on = least(public.academic_periods.starts_on, excluded.starts_on),
          ends_on = greatest(public.academic_periods.ends_on, excluded.ends_on)
    returning * into v_period;
  end if;
  if v_has_publish_col then
    execute 'update public.academic_periods set is_published = true where id = $1' using v_period.id;
  end if;

  v_first_day := pg_temp.sicare_dummy_workday(v_period.starts_on, 1);
  v_last_day := pg_temp.sicare_dummy_workday(v_today - 1, -1);
  if v_last_day < v_first_day then
    raise exception 'Periode % % baru dimulai; belum ada hari kerja yang lewat untuk sesi selesai.',
      v_period.academic_year, v_period.semester;
  end if;
  v_span := v_last_day - v_first_day;
  raise notice 'Periode: % % (% s.d. %); sesi lewat dibuat % s.d. %.',
    v_period.academic_year, v_period.semester, v_period.starts_on, v_period.ends_on,
    v_first_day, v_last_day;

  -- ------------------------------------------------------------------ daftar skenario
  -- s_kind: done | cancel_counselor | cancel_client | upcoming
  -- s_guests: jumlah anggota tamu (kelompok); 0 = individu. s_rating null = belum feedback.
  create temp table tmp_dummy_scenarios (
    s_code text primary key, s_order int, s_kind text, s_client uuid, s_day date, s_hour int,
    s_guests int, s_rating int, s_moderation text, s_reason text, s_signed boolean
  ) on commit drop;

  -- 2.1: 20 sesi lewat. Urutan = urutan kronologis (diselang-seling jenisnya).
  for v_sc in
    select * from (values
      ( 1, 'K01', 'done',             3, 5, 'shown',    null),
      ( 2, 'I01', 'done',             0, 5, 'shown',    null),
      ( 3, 'I02', 'cancel_counselor', 0, null, null, 'Konselor sakit sehingga tidak dapat memberikan layanan pada jadwal ini.'),
      ( 4, 'K02', 'done',             2, 4, 'shown',    null),
      ( 5, 'I03', 'done',             0, null, null,    null),
      ( 6, 'K03', 'cancel_counselor', 3, null, null, 'Ada tugas dinas mendadak dari lembaga pada jam yang sama.'),
      ( 7, 'I04', 'done',             0, 4, 'pending',  null),
      ( 8, 'K04', 'done',             4, 5, 'pending',  null),
      ( 9, 'I05', 'cancel_client',    0, null, null, 'Ada ujian susulan yang bentrok dengan jadwal konseling.'),
      (10, 'K05', 'done',             2, null, null,    null),
      (11, 'I06', 'done',             0, 3, 'disabled', null),
      (12, 'K06', 'cancel_client',    3, null, null, 'Sebagian anggota kelompok berhalangan hadir.'),
      (13, 'K07', 'done',             3, 4, 'shown',    null),
      (14, 'I07', 'cancel_counselor', 0, null, null, 'Klien tidak hadir sampai 15 menit setelah jadwal dimulai.'),
      (15, 'K08', 'cancel_counselor', 2, null, null, 'Ruang konseling dipakai untuk kegiatan lembaga yang mendesak.'),
      (16, 'I08', 'done',             0, 5, 'shown',    null),
      (17, 'K09', 'done',             3, 4, 'pending',  null),
      (18, 'I09', 'done',             0, null, null,    null),
      (19, 'K10', 'done',             2, null, null,    null),
      (20, 'I10', 'done',             0, null, null,    null)   -- milik 24013037, belum feedback
    ) as t(ord, code, kind, guests, rating, moderation, reason)
  loop
    v_day := pg_temp.sicare_dummy_workday(v_first_day + ((v_sc.ord - 1) * v_span) / 19, 1);
    if v_day > v_last_day then v_day := v_last_day; end if;
    if v_sc.code <> 'I10' then
      v_pool_idx := v_pool_idx + 1;
    end if;

    insert into tmp_dummy_scenarios values (
      v_sc.code, v_sc.ord, v_sc.kind,
      case when v_sc.code = 'I10' then v_target_client
           else v_pool[1 + (v_pool_idx - 1) % v_n_pool] end,
      v_day, c_hours[1 + (v_sc.ord - 1) % array_length(c_hours, 1)],
      v_sc.guests, v_sc.rating, v_sc.moderation, v_sc.reason, v_sc.kind = 'done');
  end loop;

  -- 2.2: 2 sesi terjadwal Giovana dengan 24013037 pada dua hari kerja berbeda.
  v_day := pg_temp.sicare_dummy_workday(v_today + 2, 1);
  insert into tmp_dummy_scenarios values
    ('J1', 21, 'upcoming', v_target_client, v_day, 10, 0, null, null, null, true),
    ('J2', 22, 'upcoming', v_target_client, pg_temp.sicare_dummy_workday(v_day + 2, 1), 13, 0,
       null, null, null, false);

  -- ------------------------------------------------------------------ buat data per skenario
  for v_sc in select * from tmp_dummy_scenarios order by s_order loop
    if v_sc.s_day not between v_period.starts_on and v_period.ends_on then
      raise exception 'Skenario % jatuh pada % di luar periode % s.d. %.',
        v_sc.s_code, v_sc.s_day, v_period.starts_on, v_period.ends_on;
    end if;

    -- Geser jam bila konselor atau klien sudah punya slot/booking di jam yang sama.
    v_hour := v_sc.s_hour;
    loop
      v_starts := (v_sc.s_day + make_time(v_hour, 0, 0)) at time zone c_zone;
      v_ends := v_starts + interval '1 hour';
      exit when not exists (
          select 1 from public.availability_slots s
          where s.counselor_id = v_counselor and s.starts_at < v_ends and s.ends_at > v_starts)
        and not exists (
          select 1 from public.bookings b
          where b.client_id = v_sc.s_client and b.starts_at < v_ends and b.ends_at > v_starts);
      v_hour := v_hour + 1;
      if v_hour > 15 then
        raise exception 'Skenario %: tidak ada jam kosong pada %.', v_sc.s_code, v_sc.s_day;
      end if;
    end loop;

    select p.id as user_id, p.full_name, p.identity_code as nim, p.phone_e164 as phone,
           coalesce(p.member_category, 'other') as category,
           case p.gender when 'male' then 'Laki-laki' when 'female' then 'Perempuan' end as gender_id
    into v_client
    from public.profiles p where p.id = v_sc.s_client;

    v_created := least(v_starts - interval '5 days', v_now - interval '2 hours');
    v_confirmed := least(v_created + interval '1 day', v_now - interval '1 hour');
    v_cancelled := least(v_starts - interval '3 hours', v_now);

    insert into public.availability_slots (counselor_id, academic_period_id, starts_at, ends_at, status, created_at)
    values (v_counselor, v_period.id, v_starts, v_ends, 'available', least(v_starts - interval '14 days', v_now))
    returning id into v_slot_id;

    insert into public.bookings (
      client_id, counselor_id, availability_slot_id, service_type, group_name, participant_count,
      starts_at, ends_at, status, cancellation_reason, created_at, updated_at
    ) values (
      v_client.user_id, v_counselor, v_slot_id,
      case when v_sc.s_guests > 0 then 'group' else 'individual' end,
      case when v_sc.s_guests > 0 then 'Kelompok Dummy ' || v_sc.s_code end,
      1 + v_sc.s_guests,
      v_starts, v_ends,
      case when v_sc.s_kind like 'cancel%' then 'cancelled' else 'confirmed' end,
      v_sc.s_reason, v_created,
      case when v_sc.s_kind like 'cancel%' then v_cancelled else v_confirmed end
    ) returning id into v_booking_id;

    -- Peserta utama = akun pemesan, identitas dari profil.
    insert into public.booking_participants (
      booking_id, user_id, display_name, full_name, is_representative, is_primary,
      participant_type, participant_status, nim, gender, phone_e164, created_at
    ) values (
      v_booking_id, v_client.user_id, v_client.full_name, v_client.full_name, true, true,
      'primary_client', 'registered', v_client.nim, v_client.gender_id, v_client.phone, v_created
    );

    for v_k in 1 .. v_sc.s_guests loop
      insert into public.booking_participants (
        booking_id, display_name, full_name, phone_e164, is_representative, is_primary,
        participant_type, participant_status, created_at
      ) values (
        v_booking_id,
        c_guests[1 + (v_sc.s_order + v_k) % array_length(c_guests, 1)] || ' [DUMMY]',
        c_guests[1 + (v_sc.s_order + v_k) % array_length(c_guests, 1)] || ' [DUMMY]',
        '+628000000' || lpad((v_sc.s_order * 10 + v_k)::text, 4, '0'),
        false, false, 'guest_member', 'registered', v_created
      );
    end loop;

    -- Intake (format clientIntakeAnswersSchema di be/src/validators/booking.validator.js).
    if v_has_intakes then
      insert into public.booking_intakes (booking_id, client_id, answers, created_at)
      values (v_booking_id, v_client.user_id, jsonb_build_object(
        'selfHarm', 'Tidak', 'distress', 'Mungkin', 'abuse', 'Tidak', 'substance', 'Tidak',
        'sleep', 3, 'finance', 4,
        'topics', jsonb_build_array(case
          when v_sc.s_guests > 0 then 'Relasi di lingkungan sosial (teman, rekan kerja)'
          when v_client.category = 'student' then 'Motivasi'
          else 'Karir, pendidikan, dan pekerjaan' end),
        'other', '',
        'complaint', case when v_client.category = 'student'
          then '[DUMMY] Sulit fokus mengikuti perkuliahan beberapa minggu terakhir.'
          else '[DUMMY] Beban kerja menumpuk dan sulit membagi waktu.' end,
        'history', '[DUMMY] Mulai dirasakan sejak awal semester.',
        'reason', '[DUMMY] Ingin mendapat pandangan dan cara mengatasi.',
        'efforts', '[DUMMY] Sudah mencoba membuat jadwal harian.',
        'goal', '[DUMMY] Lebih teratur dan tenang menjalani kegiatan.',
        'strengths', '[DUMMY] Mau belajar dan terbuka pada masukan.',
        'weaknesses', '[DUMMY] Mudah menunda pekerjaan.'
      ), v_created);
    end if;

    -- Notifikasi pembuatan & konfirmasi booking.
    insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
    values
      (v_counselor, 'booking.created', 'Permintaan konseling baru',
       'Ada permintaan konseling yang perlu ditinjau.', 'booking', v_booking_id, v_created,
       v_created + interval '1 hour'),
      (v_client.user_id, 'booking.submitted', 'Permintaan konseling terkirim',
       'Permintaan konseling menunggu konfirmasi konselor.', 'booking', v_booking_id, v_created,
       v_created + interval '10 minutes'),
      (v_client.user_id, 'booking.confirmed', 'Konseling dikonfirmasi',
       'Permintaan konseling diterima. Periksa detail sesi.', 'booking', v_booking_id, v_confirmed,
       case when v_sc.s_kind <> 'upcoming' then v_confirmed + interval '1 hour' end);

    if v_has_format_col then
      execute 'insert into public.counseling_sessions (
                 booking_id, counselor_id, starts_at, ends_at, status, format, room,
                 started_at, completed_at, created_at, updated_at
               ) values ($1, $2, $3, $4, $5, ''offline'', $6, $7, $8, $9, $10)
               returning id'
        into v_session_id
        using v_booking_id, v_counselor, v_starts, v_ends,
              case when v_sc.s_kind = 'done' then 'completed'
                   when v_sc.s_kind like 'cancel%' then 'cancelled' else 'scheduled' end,
              c_room,
              case when v_sc.s_kind = 'done' then v_starts + interval '3 minutes' end,
              case when v_sc.s_kind = 'done' then v_ends - interval '5 minutes' end,
              v_confirmed,
              case when v_sc.s_kind = 'done' then v_ends - interval '5 minutes'
                   when v_sc.s_kind like 'cancel%' then v_cancelled else v_confirmed end;
    else
      insert into public.counseling_sessions (
        booking_id, counselor_id, starts_at, ends_at, status, room,
        started_at, completed_at, created_at, updated_at
      ) values (
        v_booking_id, v_counselor, v_starts, v_ends,
        case when v_sc.s_kind = 'done' then 'completed'
             when v_sc.s_kind like 'cancel%' then 'cancelled' else 'scheduled' end,
        c_room,
        case when v_sc.s_kind = 'done' then v_starts + interval '3 minutes' end,
        case when v_sc.s_kind = 'done' then v_ends - interval '5 minutes' end,
        v_confirmed,
        case when v_sc.s_kind = 'done' then v_ends - interval '5 minutes'
             when v_sc.s_kind like 'cancel%' then v_cancelled else v_confirmed end
      ) returning id into v_session_id;
    end if;

    -- Dibatalkan: notifikasi ke pihak lain; tanpa consent (batal sebelum ditandatangani).
    if v_sc.s_kind = 'cancel_counselor' then
      insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
      values (v_client.user_id, 'session.cancelled', 'Sesi konseling dibatalkan',
              'Sesi konseling dibatalkan oleh konselor.', 'session', v_session_id, v_cancelled,
              v_cancelled + interval '1 hour');
      continue;
    elsif v_sc.s_kind = 'cancel_client' then
      insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
      values (v_counselor, 'booking.cancelled', 'Konseling dibatalkan',
              'Status permintaan konseling berubah menjadi dibatalkan.', 'booking', v_booking_id,
              v_cancelled, v_cancelled + interval '1 hour');
      continue;
    end if;

    -- Informed consent per peserta.
    v_signed := v_sc.s_signed;
    for v_part in
      select * from public.booking_participants where booking_id = v_booking_id order by is_primary desc
    loop
      v_c_status   := case when v_signed then 'signed' else 'pending' end;
      v_c_signer   := case when v_signed then v_part.user_id end;
      v_c_name     := case when v_signed then v_part.full_name end;
      v_c_identity := case when v_signed then jsonb_strip_nulls(jsonb_build_object(
                        'full_name', v_part.full_name, 'nim', v_part.nim, 'gender', v_part.gender))
                      else '{}'::jsonb end;
      v_c_viewed   := case when v_signed then v_confirmed + interval '2 minutes' end;
      v_c_signed   := case when v_signed then v_confirmed + interval '5 minutes' end;
      v_c_method   := case when v_signed then 'electronic_canvas' end;

      if v_has_template_col then
        execute 'insert into public.informed_consents (
                   booking_id, session_id, booking_participant_id, consent_template_id,
                   consent_statement_version, status, signer_user_id, signer_name_snapshot,
                   identity_snapshot, viewed_at, signed_at, signature_method, created_at
                 ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)'
          using v_booking_id, v_session_id, v_part.id, v_template_id, v_version, v_c_status,
                v_c_signer, v_c_name, v_c_identity, v_c_viewed, v_c_signed, v_c_method, v_confirmed;
      else
        insert into public.informed_consents (
          booking_id, session_id, booking_participant_id, consent_statement_version, status,
          signer_user_id, signer_name_snapshot, identity_snapshot, viewed_at, signed_at,
          signature_method, created_at
        ) values (
          v_booking_id, v_session_id, v_part.id, v_version, v_c_status, v_c_signer, v_c_name,
          v_c_identity, v_c_viewed, v_c_signed, v_c_method, v_confirmed
        );
      end if;
    end loop;

    continue when v_sc.s_kind <> 'done';

    if v_has_notes then
      insert into public.session_notes (session_id, counselor_id, counselor_note, client_note, follow_up, created_at)
      values (
        v_session_id, v_counselor,
        '[DUMMY] Catatan konselor untuk pengujian. Bukan data klinis nyata.',
        '[DUMMY] Klien diajak menyusun jadwal mingguan dan teknik relaksasi sederhana.',
        '[DUMMY] Evaluasi progres pada sesi berikutnya bila diperlukan.',
        v_ends
      );
    end if;

    -- Sesi selesai -> notifikasi ke klien; belum dibaca bila feedback belum diisi.
    insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
    values (v_client.user_id, 'session.completed', 'Sesi konseling selesai',
            'Sesi konseling selesai. Kamu dapat memberikan feedback.', 'session', v_session_id,
            v_ends - interval '5 minutes',
            case when v_sc.s_rating is not null then v_ends + interval '2 hours' end);

    continue when v_sc.s_rating is null;  -- selesai tetapi belum mengisi feedback

    insert into public.feedback (
      session_id, client_id, counselor_id, rating, comment, moderation_status, review_status,
      disabled_reason, created_at
    ) values (
      v_session_id, v_client.user_id, v_counselor, v_sc.s_rating,
      case v_sc.s_rating
        when 5 then '[DUMMY] Konselor sangat membantu dan mendengarkan dengan baik.'
        when 4 then '[DUMMY] Sesi terasa nyaman, kami mendapat langkah konkret untuk dicoba.'
        else '[DUMMY] Cukup membantu, semoga waktunya bisa sedikit lebih panjang.'
      end,
      v_sc.s_moderation,
      case v_sc.s_moderation when 'pending' then 'new' when 'shown' then 'reviewed' else 'resolved' end,
      case when v_sc.s_moderation = 'disabled' then '[DUMMY] Contoh feedback yang dinonaktifkan admin.' end,
      v_ends + interval '3 hours'
    ) returning id into v_feedback_id;

    -- Feedback baru -> notifikasi ke admin & Kepala LMI (sicare_submit_feedback).
    for v_admin in
      select p.id from public.profiles p
      where p.app_role in ('admin', 'head_lmi') and p.account_status = 'active'
    loop
      insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
      values (v_admin.id, 'feedback.submitted', 'Feedback baru', 'Feedback baru menunggu peninjauan.',
              'feedback', v_feedback_id, v_ends + interval '3 hours',
              case when v_sc.s_moderation <> 'pending' then v_ends + interval '1 day' end);
    end loop;
  end loop;

  select count(distinct s_client) into v_n from tmp_dummy_scenarios where s_code <> 'I10' and s_kind <> 'upcoming';
  raise notice 'Selesai: 20 sesi lewat (% klien berbeda + %) dan 2 sesi terjadwal untuk %.',
    v_n, c_target_client, c_target_client;
end;
$$;

commit;

-- Ringkasan hasil:
-- select b.service_type, s.status, (f.id is not null) as ada_feedback, count(*)
-- from public.counseling_sessions s
-- join public.bookings b on b.id = s.booking_id
-- left join public.feedback f on f.session_id = s.id
-- group by 1, 2, 3 order by 1, 2, 3;
--
-- select to_char(s.starts_at at time zone 'Asia/Makassar', 'YYYY-MM-DD HH24:MI') as mulai_wita,
--        b.service_type, s.status, uc.email as klien, f.rating, f.moderation_status, b.cancellation_reason
-- from public.counseling_sessions s
-- join public.bookings b on b.id = s.booking_id
-- join auth.users uc on uc.id = b.client_id
-- left join public.feedback f on f.session_id = s.id
-- order by s.starts_at;
