-- SiCARE: SEED DUMMY untuk konselor giovana@unikadelasalle.ac.id pada periode akademik berjalan.
-- Simpan sebagai snippet di Supabase Dashboard -> SQL Editor (project NON-PRODUKSI) dan jalankan
-- SETELAH snippet "Reset Dummy" (be/scripts/reset-transactional-data.sql). Bukan migrasi.
-- Skrip TIDAK membuat atau mengubah akun (tidak menyentuh auth.users maupun profiles).
--
-- Akun yang dipakai (konstanta di bawah):
--   konselor : giovana@unikadelasalle.ac.id (wajib ada, role counselor, aktif)
--   klien    : 24013031@unikadelasalle.ac.id (wajib ada, role client, aktif) untuk sesi berlangsung
--   klien lain: semua akun client aktif lainnya, urut tanggal dibuat. Akun 24013031 dipakai
--               paling akhir, hanya bila klien lain kurang.
--
-- Kriteria:
--   a. 9 sesi SELESAI dengan giovana, masing-masing klien berbeda (bila akun cukup):
--        6 sudah mengisi feedback (rating & status moderasi bervariasi; 1 di antaranya kelompok),
--        3 belum mengisi feedback (notifikasi "Sesi konseling selesai" belum dibaca).
--   b. 2 jadwal MENDATANG (2 klien): +2 hari kerja (consent lengkap) dan +4 hari kerja (consent
--      belum ditandatangani).
--   c. 1 sesi BERLANGSUNG giovana dengan 24013031: mulai 15 menit sebelum skrip dijalankan,
--      60 menit. worker-run menutupnya otomatis 2 jam setelah jam selesai, jadi jalankan seed
--      tidak lama sebelum pengujian.
--   d. 3 sesi TIDAK TERJADI karena dibatalkan konselor, masing-masing dengan alasan berbeda
--      (booking.cancellation_reason, seperti yang ditulis lewat "Hentikan/Batalkan Sesi").
--   e. Sesi selesai (a) tersebar di BULAN-BULAN SEBELUMNYA dalam periode akademik ini (dibagi
--      rata per bulan; 1 sesi tanpa feedback per bulan bila ada 3 bulan). Bila periode baru
--      dimulai bulan ini, dipakai hari-hari yang sudah lewat di bulan ini (NOTICE).
--   Tambahan opsional: 3 slot kosong mendatang untuk giovana (c_include_empty_slots) dan uji
--   tombol Mulai Sesi (c_include_session_tests, default mati).
--
-- Notifikasi in-app memakai type yang dibuat backend/RPC: booking.created, booking.submitted,
-- booking.confirmed, session.ongoing, session.cancelled, session.completed, feedback.submitted
-- (ke admin & Kepala LMI aktif).
-- Identitas peserta diambil dari profil (nama, NIM/NIP, gender, nomor); fakultas, prodi, TTL,
-- agama, alamat tidak ada di profil sehingga kosong.
-- Yang TIDAK dibuat: whatsapp_outbox (tidak ada WhatsApp ke nomor asli), consent_invitations,
-- audit log. Consent dummy tidak punya file PDF/tanda tangan; unduh PDF consent dummy gagal.
-- Skrip menolak berjalan bila tabel bookings belum kosong.
-- Tahan terhadap skema lama: counseling_sessions.format, informed_consents.consent_template_id,
-- dan academic_periods.is_published diisi bila kolomnya masih ada; booking_intakes dan
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
  c_target_client    constant text := '24013031@unikadelasalle.ac.id';
  c_target_counselor constant text := 'giovana@unikadelasalle.ac.id';
  c_zone     constant text := 'Asia/Makassar';
  -- Harus sama dengan OFFICIAL_TEMPLATE_VERSION di be/src/services/consentPdf.service.js
  c_consent_version constant text := 'v1.0';
  c_include_empty_slots   constant boolean := true;
  -- Uji tombol Mulai Sesi: 2 sesi terjadwal ~10 menit lagi (consent lengkap / belum).
  c_include_session_tests constant boolean := false;
  c_room     constant text := 'Ruang Konseling LMI';

  -- Kompatibilitas skema lama.
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
  v_month_start date := date_trunc('month', (now() at time zone 'Asia/Makassar'))::date;
  v_year       int := extract(year from (now() at time zone 'Asia/Makassar'))::int;
  v_month      int := extract(month from (now() at time zone 'Asia/Makassar'))::int;
  v_acad_year  text;
  v_semester   text;
  v_p_start    date;
  v_p_end      date;
  v_period     public.academic_periods%rowtype;
  v_months     date[];
  v_n_months   int;

  v_target_client    uuid;
  v_counselor        uuid;
  v_pool       uuid[];
  v_n_pool     int;
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
  v_bstatus    text;
  v_sstatus    text;
  v_signed     boolean;
  v_offsets    int[] := array[3, 5, 7];
  v_hours      int[] := array[9, 11, 14];
  v_n_empty    int := 0;

  -- a. 9 sesi selesai: rating null = belum mengisi feedback.
  -- Bulan ke-(i-1) mod jumlah bulan; dengan 3 bulan, indeks 3/5/7 jatuh di bulan berbeda.
  c_done_rating int[]  := array[5, 4, null, 5, null, 3, null, 4, 5];
  c_done_mod    text[] := array['shown', 'shown', null, 'pending', null, 'disabled', null, 'shown', 'pending'];
  c_done_group  boolean[] := array[false, false, false, true, false, false, false, false, false];
  c_done_hour   int[]  := array[9, 10, 13, 14, 9, 10, 13, 14, 9];
  -- d. alasan pembatalan oleh konselor (berbeda-beda).
  c_cancel_reason text[] := array[
    'Konselor sakit sehingga tidak dapat memberikan layanan pada jadwal ini.',
    'Ada tugas dinas mendadak dari lembaga pada jam yang sama.',
    'Klien tidak hadir sampai 15 menit setelah jadwal dimulai.'];
  c_cancel_offset int[] := array[-8, -5, -2];
  c_cancel_hour   int[] := array[10, 13, 9];
  c_guests   text[] := array['Yohanes Karundeng','Maria Sondakh'];
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
    raise notice 'Skema lama: consent memakai consent_templates (versi %).', v_version;
  end if;
  if v_has_format_col then
    raise notice 'Skema lama: counseling_sessions.format masih ada; diisi ''offline''.';
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
  if not exists (select 1 from public.counselor_profiles where profile_id = v_counselor
                 and is_public = true and nullif(btrim(public_name), '') is not null) then
    raise notice 'Konselor % belum publik; data tetap dibuat, tetapi jadwalnya tidak muncul di direktori publik.', c_target_counselor;
  end if;

  select p.id into v_target_client
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(c_target_client)
    and p.app_role = 'client' and p.account_status = 'active';
  if v_target_client is null then
    raise exception 'Klien aktif % tidak ditemukan.', c_target_client;
  end if;

  -- Klien lain dulu (urut dibuat), akun target paling akhir.
  select array_agg(p.id order by p.created_at) into v_pool
  from public.profiles p
  where p.app_role = 'client' and p.account_status = 'active' and p.id <> v_target_client;
  v_pool := coalesce(v_pool, '{}') || v_target_client;
  v_n_pool := array_length(v_pool, 1);
  if v_n_pool < 9 then
    raise notice 'Hanya % akun klien aktif; 9 sesi selesai tidak semuanya klien berbeda (akun dipakai bergiliran).', v_n_pool;
  end if;

  -- ------------------------------------------------------------------ periode berjalan
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

  raise notice 'Periode: % % (% s.d. %).',
    v_period.academic_year, v_period.semester, v_period.starts_on, v_period.ends_on;

  -- Bulan-bulan sebelumnya yang masih di dalam periode (kriteria e).
  select array_agg(m::date order by m) into v_months
  from generate_series(date_trunc('month', v_period.starts_on::timestamp),
                       (v_month_start - interval '1 month')::timestamp,
                       interval '1 month') m;
  if v_months is null then
    v_months := array[v_month_start];
    raise notice 'Periode dimulai bulan ini; sesi selesai memakai hari-hari yang sudah lewat di bulan ini.';
  end if;
  v_n_months := array_length(v_months, 1);

  -- ------------------------------------------------------------------ daftar skenario
  -- s_kind: completed | ongoing | counselor_cancelled | upcoming | start_test
  create temp table tmp_dummy_scenarios (
    s_code text primary key, s_kind text, s_client uuid, s_day date, s_hour int,
    s_group boolean, s_rating int, s_moderation text, s_reason text, s_signed boolean,
    s_start_in interval
  ) on commit drop;

  -- a + e. 9 sesi selesai, dibagi rata ke bulan-bulan sebelumnya.
  for v_i in 1 .. 9 loop
    v_k := (v_i - 1) / v_n_months;                -- urutan sesi di dalam bulannya
    v_day := v_months[1 + (v_i - 1) % v_n_months] + 5 + 7 * (v_k % 4);
    v_day := pg_temp.sicare_dummy_workday(v_day, 1);
    if v_day < v_period.starts_on then
      v_day := pg_temp.sicare_dummy_workday(v_period.starts_on, 1);
    end if;
    if v_months[1] = v_month_start then
      -- Periode baru mulai bulan ini: tetap di masa lalu.
      v_day := least(v_day, pg_temp.sicare_dummy_workday(v_today - 1, -1));
    elsif v_day >= v_month_start then
      v_day := pg_temp.sicare_dummy_workday(v_month_start - 1, -1);
    end if;

    insert into tmp_dummy_scenarios values (
      'A' || v_i, 'completed', v_pool[1 + (v_i - 1) % v_n_pool], v_day, c_done_hour[v_i],
      c_done_group[v_i], c_done_rating[v_i], c_done_mod[v_i], null, true, null);
  end loop;

  -- b. 2 jadwal mendatang.
  insert into tmp_dummy_scenarios values
    ('B1', 'upcoming', v_pool[1 + 9 % v_n_pool],
       pg_temp.sicare_dummy_workday(v_today + 2, 1), 10, false, null, null, null, true, null),
    ('B2', 'upcoming', v_pool[1 + 10 % v_n_pool],
       pg_temp.sicare_dummy_workday(v_today + 4, 1), 13, false, null, null, null, false, null);

  -- c. sesi berlangsung dengan akun target.
  insert into tmp_dummy_scenarios values
    ('C1', 'ongoing', v_target_client, v_today, null, false, null, null, null, true, interval '-15 minutes');

  -- d. 3 sesi dibatalkan konselor dengan alasan berbeda.
  for v_i in 1 .. 3 loop
    v_day := pg_temp.sicare_dummy_workday(v_today + c_cancel_offset[v_i], -1);
    insert into tmp_dummy_scenarios values (
      'D' || v_i, 'counselor_cancelled', v_pool[1 + (10 + v_i) % v_n_pool],
      greatest(v_day, v_period.starts_on), c_cancel_hour[v_i], false, null, null,
      c_cancel_reason[v_i], false, null);
  end loop;

  -- Opsional: uji tombol Mulai Sesi (jendela mulai 15 menit sebelum jadwal).
  if c_include_session_tests then
    insert into tmp_dummy_scenarios values
      ('T1', 'start_test', v_pool[1 + 14 % v_n_pool], v_today, null, false, null, null, null, true,  interval '10 minutes'),
      ('T2', 'start_test', v_pool[1 + 15 % v_n_pool], v_today, null, true,  null, null, null, false, interval '10 minutes');
  end if;

  -- ------------------------------------------------------------------ buat data per skenario
  for v_sc in select * from tmp_dummy_scenarios order by s_day, s_code loop
    if v_sc.s_day not between v_period.starts_on and v_period.ends_on then
      raise exception 'Skenario % jatuh pada % di luar periode % s.d. %.',
        v_sc.s_code, v_sc.s_day, v_period.starts_on, v_period.ends_on;
    end if;

    if v_sc.s_start_in is not null then
      v_starts := date_trunc('minute', v_now) + v_sc.s_start_in;
      v_ends := v_starts + interval '60 minutes';
    else
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
        if v_hour > 16 then
          raise exception 'Skenario %: tidak ada jam kosong pada %.', v_sc.s_code, v_sc.s_day;
        end if;
      end loop;
    end if;

    select p.id as user_id, p.full_name, p.identity_code as nim, p.phone_e164 as phone,
           coalesce(p.member_category, 'other') as category,
           case p.gender when 'male' then 'Laki-laki' when 'female' then 'Perempuan' end as gender_id
    into v_client
    from public.profiles p where p.id = v_sc.s_client;

    v_created := least(v_starts - interval '5 days', v_now - interval '2 hours');
    v_confirmed := least(v_created + interval '1 day', v_now - interval '1 hour');
    v_cancelled := least(v_starts - interval '2 hours', v_now);

    v_bstatus := case v_sc.s_kind when 'counselor_cancelled' then 'cancelled' else 'confirmed' end;
    v_sstatus := case v_sc.s_kind
      when 'completed' then 'completed'
      when 'ongoing' then 'ongoing'
      when 'counselor_cancelled' then 'cancelled'
      else 'scheduled'
    end;

    insert into public.availability_slots (counselor_id, academic_period_id, starts_at, ends_at, status, created_at)
    values (v_counselor, v_period.id, v_starts, v_ends, 'available', least(v_starts - interval '14 days', v_now))
    returning id into v_slot_id;

    insert into public.bookings (
      client_id, counselor_id, availability_slot_id, service_type, group_name, participant_count,
      starts_at, ends_at, status, cancellation_reason, created_at, updated_at
    ) values (
      v_client.user_id, v_counselor, v_slot_id,
      case when v_sc.s_group then 'group' else 'individual' end,
      case when v_sc.s_group then 'Kelompok Dummy ' || v_sc.s_code end,
      case when v_sc.s_group then 1 + array_length(c_guests, 1) else 1 end,
      v_starts, v_ends, v_bstatus, v_sc.s_reason, v_created,
      case when v_bstatus = 'cancelled' then v_cancelled else v_confirmed end
    ) returning id into v_booking_id;

    -- Peserta utama = akun pemesan, identitas dari profil.
    insert into public.booking_participants (
      booking_id, user_id, display_name, full_name, is_representative, is_primary,
      participant_type, participant_status, nim, gender, phone_e164, created_at
    ) values (
      v_booking_id, v_client.user_id, v_client.full_name, v_client.full_name, true, true,
      'primary_client', 'registered', v_client.nim, v_client.gender_id, v_client.phone, v_created
    );

    if v_sc.s_group then
      for v_k in 1 .. array_length(c_guests, 1) loop
        insert into public.booking_participants (
          booking_id, display_name, full_name, phone_e164, is_representative, is_primary,
          participant_type, participant_status, created_at
        ) values (
          v_booking_id, c_guests[v_k] || ' [DUMMY]', c_guests[v_k] || ' [DUMMY]',
          '+6280000001' || lpad(v_k::text, 2, '0'),
          false, false, 'guest_member', 'registered', v_created
        );
      end loop;
    end if;

    -- Intake (format clientIntakeAnswersSchema di be/src/validators/booking.validator.js:
    -- selfHarm Ya/Tidak, tepat satu topik dari INTAKE_TOPIC_OPTIONS).
    if v_has_intakes then
      insert into public.booking_intakes (booking_id, client_id, answers, created_at)
      values (v_booking_id, v_client.user_id, jsonb_build_object(
        'selfHarm', 'Tidak', 'distress', 'Mungkin', 'abuse', 'Tidak', 'substance', 'Tidak',
        'sleep', 3, 'finance', 4,
        'topics', jsonb_build_array(case
          when v_sc.s_group then 'Relasi di lingkungan sosial (teman, rekan kerja)'
          when v_client.category = 'student' then 'Motivasi'
          else 'Karir, pendidikan, dan pekerjaan' end),
        'other', '',
        'complaint', case when v_client.category = 'student'
          then '[DUMMY] Sulit fokus mengikuti perkuliahan beberapa minggu terakhir.'
          else '[DUMMY] Beban kerja menumpuk dan sulit membagi waktu.' end,
        'history', '[DUMMY] Mulai dirasakan sejak awal semester.',
        'reason', '[DUMMY] Ingin mendapat pandangan dan cara mengatasi.',
        'efforts', case when v_client.category = 'student'
          then '[DUMMY] Sudah mencoba membuat jadwal belajar.'
          else '[DUMMY] Sudah mencoba menyusun daftar prioritas pekerjaan.' end,
        'goal', case when v_client.category = 'student'
          then '[DUMMY] Lebih teratur dan tenang menjalani kuliah.'
          else '[DUMMY] Lebih seimbang antara pekerjaan dan waktu pribadi.' end,
        'strengths', '[DUMMY] Mau belajar dan terbuka pada masukan.',
        'weaknesses', '[DUMMY] Mudah menunda pekerjaan.'
      ), v_created);
    end if;

    -- Notifikasi pembuatan & konfirmasi booking (sicare_create_booking, sicare_transition_booking).
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
       case when v_sc.s_kind not in ('upcoming', 'start_test') then v_confirmed + interval '1 hour' end);

    if v_has_format_col then
      -- Skema lama (format wajib). SQL dinamis agar tetap valid setelah kolomnya dihapus.
      execute 'insert into public.counseling_sessions (
                 booking_id, counselor_id, starts_at, ends_at, status, format, room,
                 started_at, completed_at, created_at, updated_at
               ) values ($1, $2, $3, $4, $5, ''offline'', $6, $7, $8, $9, $10)
               returning id'
        into v_session_id
        using v_booking_id, v_counselor, v_starts, v_ends, v_sstatus, c_room,
              case when v_sstatus in ('completed', 'ongoing') then v_starts + interval '3 minutes' end,
              case when v_sstatus = 'completed' then v_ends - interval '5 minutes' end,
              v_confirmed,
              case when v_sstatus = 'completed' then v_ends - interval '5 minutes'
                   when v_sstatus = 'ongoing' then v_starts + interval '3 minutes'
                   when v_sstatus = 'cancelled' then v_cancelled
                   else v_confirmed end;
    else
      insert into public.counseling_sessions (
        booking_id, counselor_id, starts_at, ends_at, status, room,
        started_at, completed_at, created_at, updated_at
      ) values (
        v_booking_id, v_counselor, v_starts, v_ends, v_sstatus, c_room,
        case when v_sstatus in ('completed', 'ongoing') then v_starts + interval '3 minutes' end,
        case when v_sstatus = 'completed' then v_ends - interval '5 minutes' end,
        v_confirmed,
        case when v_sstatus = 'completed' then v_ends - interval '5 minutes'
             when v_sstatus = 'ongoing' then v_starts + interval '3 minutes'
             when v_sstatus = 'cancelled' then v_cancelled
             else v_confirmed end
      ) returning id into v_session_id;
    end if;

    -- Dibatalkan konselor -> notifikasi ke klien (sicare_transition_session -> cancelled).
    -- Tidak ada consent: sesi dibatalkan sebelum consent ditandatangani.
    if v_sstatus = 'cancelled' then
      insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
      values (v_client.user_id, 'session.cancelled', 'Sesi konseling dibatalkan',
              'Sesi konseling dibatalkan oleh konselor.', 'session', v_session_id, v_cancelled, null);
      continue;
    end if;

    -- Informed consent per peserta: signed untuk selesai/berlangsung (wajib untuk memulai sesi)
    -- dan jadwal dengan s_signed; pending untuk sisanya.
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

    -- Berlangsung -> notifikasi ke klien (sicare_transition_session -> ongoing).
    if v_sstatus = 'ongoing' then
      insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
      values (v_client.user_id, 'session.ongoing', 'Sesi konseling dimulai',
              'Sesi konseling sedang berlangsung.', 'session', v_session_id,
              v_starts + interval '3 minutes', null);
      continue;
    end if;

    continue when v_sstatus <> 'completed';

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
        when 4 then '[DUMMY] Sesi terasa nyaman, saya mendapat langkah konkret untuk dicoba.'
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

  -- ------------------------------------------------------------------ opsional: slot kosong
  if c_include_empty_slots then
    for v_k in 1 .. array_length(v_offsets, 1) loop
      v_day := v_today + v_offsets[v_k];
      loop
        v_starts := (v_day + make_time(v_hours[v_k], 0, 0)) at time zone c_zone;
        v_ends := v_starts + interval '1 hour';
        exit when extract(isodow from v_day) <= 5 and not exists (
          select 1 from public.availability_slots s
          where s.counselor_id = v_counselor and s.starts_at < v_ends and s.ends_at > v_starts);
        v_day := v_day + 1;
      end loop;

      if v_day > v_period.ends_on then
        raise notice 'Slot kosong % dilewati: % di luar periode.', v_k, v_day;
        continue;
      end if;

      insert into public.availability_slots (counselor_id, academic_period_id, starts_at, ends_at, status)
      values (v_counselor, v_period.id, v_starts, v_ends, 'available');
      v_n_empty := v_n_empty + 1;
    end loop;
  end if;

  select count(distinct s_client) into v_n from tmp_dummy_scenarios where s_kind = 'completed';
  raise notice 'Selesai: % booking untuk giovana (9 selesai oleh % klien berbeda), % slot kosong.',
    (select count(*) from tmp_dummy_scenarios), v_n, v_n_empty;
end;
$$;

commit;

-- Ringkasan hasil:
-- select b.status as booking, s.status as sesi, b.service_type,
--        b.starts_at at time zone 'Asia/Makassar' as mulai_wita, uc.email as klien,
--        f.rating, f.moderation_status, b.cancellation_reason
-- from public.bookings b
-- join auth.users uc on uc.id = b.client_id
-- left join public.counseling_sessions s on s.booking_id = b.id
-- left join public.feedback f on f.session_id = s.id
-- order by b.starts_at;
--
-- select to_char(s.starts_at at time zone 'Asia/Makassar', 'YYYY-MM') as bulan,
--        count(*) as selesai, count(f.id) as dengan_feedback
-- from public.counseling_sessions s left join public.feedback f on f.session_id = s.id
-- where s.status = 'completed' group by 1 order by 1;
--
-- select type, count(*) from public.notifications group by 1 order by 1;
