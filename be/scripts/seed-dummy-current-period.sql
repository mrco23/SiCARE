-- SiCARE: data dummy terarah untuk semester (periode akademik) yang sedang berjalan,
-- memakai AKUN YANG SUDAH ADA di website.
--
-- Jalankan di Supabase Dashboard -> SQL Editor pada project NON-PRODUKSI, SETELAH
-- be/scripts/reset-transactional-data.sql. Skrip manual, bukan migrasi.
-- Skrip TIDAK membuat akun apa pun (tidak menyentuh auth.users maupun profiles).
--
-- 1. AKUN TARGET (email di konstanta c_target_client & c_target_counselor):
--    klien 24013031@unikadelasalle.ac.id dengan konselor giovana@unikadelasalle.ac.id
--      G1 selesai + feedback (rating 5, shown)   bulan lalu, hari kerja ke-2 minggu kedua, 10.00
--      G2 selesai + feedback (rating 4, pending) 9 hari lalu (hari kerja), 13.00
--      G3 selesai, BELUM mengisi feedback        2 hari lalu (hari kerja), 14.00
--      G4 sedang BERLANGSUNG (ongoing)           mulai 15 menit sebelum skrip dijalankan, 60 menit
--    PENTING (G4): worker-run menutup otomatis sesi ongoing 2 jam setelah jam selesai
--    (sicare_auto_complete_sessions). Jalankan seed tidak lama sebelum pengujian; sesudah
--    ±2 jam 45 menit G4 akan berubah menjadi completed.
--
-- 2. AKUN DUMMY LAIN (klien aktif selain akun target; dibagi menurut profiles.member_category):
--      D1-D4 selesai + feedback, semuanya pada BULAN SEBELUMNYA di periode ini
--            (rating 5/4/4/3, moderasi shown/shown/pending/disabled; D3 kelompok 3 peserta)
--      X1 dibatalkan klien (menunggu konfirmasi, tanpa sesi)     5 hari lalu
--      X2 dibatalkan konselor (booking & sesi cancelled)         3 hari lalu
--      W1 menunggu konfirmasi                                    +3 hari  (c_include_active_flows)
--      U1 terkonfirmasi, consent pending                         +4 hari  (c_include_active_flows)
--    Mahasiswa ('student') diutamakan untuk D1, D3, D4, X1, X2, W1; dosen/staf ('faculty_staff')
--    untuk D2 dan U1. Kelompok kosong memakai kelompok lain; akun berputar bila kurang.
--    Bila tidak ada klien lain selain akun target, bagian 2 dilewati.
--    Bila bulan lalu di luar periode (mis. bulan pertama semester), D1-D4 memakai
--    beberapa minggu terakhir dan NOTICE memberi tahu.
--
-- 3. JADWAL KOSONG: 3 slot per konselor aktif & publik, +2 / +5 / +7 hari kerja,
--    jam 09.00 / 11.00 / 14.00 WITA.
--
-- Notifikasi in-app mengikuti type yang dibuat backend/RPC (booking.created, booking.submitted,
-- booking.confirmed, booking.cancelled, session.ongoing, session.cancelled, session.completed,
-- feedback.submitted ke admin & Kepala LMI). Jadwal kosong tidak punya jenis notifikasi.
-- Identitas peserta diambil dari profil (nama, NIM/NIP, gender, nomor); fakultas, prodi, TTL,
-- agama, alamat tidak ada di profil sehingga kosong.
-- Yang TIDAK dibuat: whatsapp_outbox (tidak ada WhatsApp ke nomor asli), consent_invitations,
-- audit log. Consent dummy tidak punya file PDF/tanda tangan; unduh PDF consent dummy gagal.
-- Skrip menolak berjalan bila tabel bookings belum kosong (jalankan reset dulu).
-- Tahan terhadap skema lama: counseling_sessions.format dan informed_consents.consent_template_id
-- diisi bila masih ada; booking_intakes dan session_notes dilewati bila belum ada.

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
  c_include_active_flows constant boolean := true;
  -- Skenario uji alur sesi konselor target (mulai sesi, consent, selesai, hentikan dengan alasan).
  -- Sengaja dijadwalkan di sekitar jam saat skrip dijalankan, sehingga dapat tumpang-tindih
  -- dengan sesi lain konselor yang sama. Set false bila tidak diperlukan.
  c_include_session_tests constant boolean := true;
  c_room     constant text := 'Ruang Konseling LMI';

  -- Kompatibilitas skema lama.
  v_has_template_col boolean;
  v_has_format_col   boolean;
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
  v_prev_start date;
  v_year       int := extract(year from (now() at time zone 'Asia/Makassar'))::int;
  v_month      int := extract(month from (now() at time zone 'Asia/Makassar'))::int;
  v_acad_year  text;
  v_semester   text;
  v_p_start    date;
  v_p_end      date;
  v_period     public.academic_periods%rowtype;

  v_target_client    uuid;
  v_target_counselor uuid;
  v_counselors uuid[];
  v_n_couns    int;
  v_students   uuid[];
  v_staff      uuid[];
  v_others     uuid[];
  v_pool       uuid[];
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
  v_slot_id    uuid;
  v_booking_id uuid;
  v_session_id uuid;
  v_feedback_id uuid;
  v_bstatus    text;
  v_sstatus    text;
  v_reason     text;
  v_signed     boolean;
  v_offsets    int[] := array[2, 5, 7];
  v_hours      int[] := array[9, 11, 14];
  v_n_empty    int := 0;

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

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'counseling_sessions' and column_name = 'format'
  ) into v_has_format_col;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'informed_consents' and column_name = 'consent_template_id'
  ) into v_has_template_col;

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
    raise exception 'Tabel bookings belum kosong. Jalankan reset-transactional-data.sql dulu.';
  end if;

  -- ------------------------------------------------------------------ akun target
  select p.id into v_target_client
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(c_target_client);
  if v_target_client is null then
    raise exception 'Akun klien % tidak ditemukan.', c_target_client;
  end if;
  if not exists (select 1 from public.profiles where id = v_target_client
                 and app_role = 'client' and account_status = 'active') then
    raise exception 'Akun % bukan klien aktif.', c_target_client;
  end if;

  select p.id into v_target_counselor
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(c_target_counselor);
  if v_target_counselor is null then
    raise exception 'Akun konselor % tidak ditemukan.', c_target_counselor;
  end if;
  if not exists (select 1 from public.profiles where id = v_target_counselor
                 and app_role = 'counselor' and account_status = 'active') then
    raise exception 'Akun % bukan konselor aktif.', c_target_counselor;
  end if;
  if not exists (select 1 from public.counselor_profiles where profile_id = v_target_counselor
                 and is_public = true and nullif(btrim(public_name), '') is not null) then
    raise notice 'Konselor % belum publik; data tetap dibuat, tetapi tidak muncul di direktori publik.', c_target_counselor;
  end if;

  -- ------------------------------------------------------------------ akun lain yang ada
  select array_agg(p.id order by p.created_at) into v_counselors
  from public.profiles p join public.counselor_profiles cp on cp.profile_id = p.id
  where p.app_role = 'counselor' and p.account_status = 'active' and cp.is_public = true
    and nullif(btrim(cp.public_name), '') is not null;
  if v_counselors is null or not (v_target_counselor = any(v_counselors)) then
    v_counselors := array_prepend(v_target_counselor, coalesce(v_counselors, '{}'));
  end if;
  v_n_couns := array_length(v_counselors, 1);

  select
    array_agg(p.id order by p.created_at) filter (where p.member_category = 'student'),
    array_agg(p.id order by p.created_at) filter (where p.member_category = 'faculty_staff'),
    array_agg(p.id order by p.created_at) filter (where p.member_category is null or p.member_category = 'other')
  into v_students, v_staff, v_others
  from public.profiles p
  where p.app_role = 'client' and p.account_status = 'active' and p.id <> v_target_client;

  raise notice 'Klien lain aktif: % mahasiswa, % dosen/staf, % lainnya; % konselor.',
    coalesce(array_length(v_students, 1), 0), coalesce(array_length(v_staff, 1), 0),
    coalesce(array_length(v_others, 1), 0), v_n_couns;

  -- ------------------------------------------------------------------ periode berjalan
  select * into v_period from public.academic_periods
  where v_today between starts_on and ends_on
  order by is_published desc, starts_on desc limit 1;

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

    insert into public.academic_periods (academic_year, semester, starts_on, ends_on, is_published)
    values (v_acad_year, v_semester, v_p_start, v_p_end, true)
    on conflict (academic_year, semester) do update
      set starts_on = least(public.academic_periods.starts_on, excluded.starts_on),
          ends_on = greatest(public.academic_periods.ends_on, excluded.ends_on),
          is_published = true
    returning * into v_period;
  elsif not v_period.is_published then
    update public.academic_periods set is_published = true where id = v_period.id
    returning * into v_period;
  end if;

  raise notice 'Periode: % % (% s.d. %).',
    v_period.academic_year, v_period.semester, v_period.starts_on, v_period.ends_on;

  v_prev_start := (v_month_start - interval '1 month')::date;

  -- ------------------------------------------------------------------ daftar skenario
  -- s_kind: completed (s_rating null = belum feedback) | ongoing | client_cancelled |
  --         counselor_cancelled | waiting | confirmed_upcoming |
  --         start_ready (terjadwal ~10 menit lagi, consent lengkap -> "Mulai Sesi" aktif) |
  --         start_consent_pending (terjadwal ~10 menit lagi, consent belum ditandatangani)
  create temp table tmp_dummy_scenarios (
    s_code text primary key, s_kind text, s_client uuid, s_counselor uuid, s_day date,
    s_hour int, s_group boolean, s_rating int, s_moderation text
  ) on commit drop;

  -- 1. Akun target dengan konselor target.
  v_day := pg_temp.sicare_dummy_workday(v_prev_start + 8, 1);
  if v_day < v_period.starts_on then
    v_day := pg_temp.sicare_dummy_workday(v_today - 20, -1);
    raise notice 'G1: bulan lalu di luar periode; memakai %.', v_day;
  end if;
  insert into tmp_dummy_scenarios values
    ('G1', 'completed', v_target_client, v_target_counselor, v_day, 10, false, 5, 'shown'),
    ('G2', 'completed', v_target_client, v_target_counselor,
       pg_temp.sicare_dummy_workday(v_today - 9, -1), 13, false, 4, 'pending'),
    ('G3', 'completed', v_target_client, v_target_counselor,
       pg_temp.sicare_dummy_workday(v_today - 2, -1), 14, false, null, null),
    ('G4', 'ongoing',   v_target_client, v_target_counselor, v_today, null, false, null, null);

  -- 1b. Uji alur sesi konselor target, memakai klien dummy lain (bila ada) agar tidak bentrok
  --     dengan sesi berlangsung G4 milik akun target:
  --     T1 berlangsung (uji "Hentikan Sesi" dengan alasan; G4 untuk uji "Selesaikan Sesi"),
  --     T2 terjadwal + consent lengkap (uji "Mulai Sesi"),
  --     T3 terjadwal + consent belum ditandatangani (uji status consent; "Mulai Sesi" terkunci).
  if c_include_session_tests then
    v_pool := coalesce(v_students, v_staff, v_others, array[v_target_client]);
    insert into tmp_dummy_scenarios values
      ('T1', 'ongoing',               v_pool[1],
         v_target_counselor, v_today, null, false, null, null),
      ('T2', 'start_ready',           v_pool[1 + (1 % array_length(v_pool, 1))],
         v_target_counselor, v_today, null, false, null, null),
      ('T3', 'start_consent_pending', v_pool[1 + (2 % array_length(v_pool, 1))],
         v_target_counselor, v_today, null, true,  null, null);
  end if;

  -- 2. Akun dummy lain.
  if coalesce(array_length(v_students, 1), 0) + coalesce(array_length(v_staff, 1), 0)
     + coalesce(array_length(v_others, 1), 0) = 0 then
    raise notice 'Tidak ada klien aktif selain %; skenario akun dummy lain dilewati.', c_target_client;
  else
    for v_sc in
      select * from (values
        ('D1', 'completed',           'student', 1, 1,  6,  9, false, 5,    'shown'),
        ('D2', 'completed',           'staff',   1, 2, 12, 10, false, 4,    'shown'),
        ('D3', 'completed',           'student', 2, 3, 18, 13, true,  4,    'pending'),
        ('D4', 'completed',           'student', 3, 4, 24, 14, false, 3,    'disabled'),
        ('X1', 'client_cancelled',    'student', 4, 2, -5,  9, false, null, null),
        ('X2', 'counselor_cancelled', 'student', 5, 3, -3, 10, false, null, null),
        ('W1', 'waiting',             'student', 6, 1,  3, 10, false, null, null),
        ('U1', 'confirmed_upcoming',  'staff',   2, 2,  4, 13, false, null, null)
      ) as t(code, kind, role, nth, couns, dayn, hr, grp, rating, moderation)
    loop
      continue when v_sc.code in ('W1', 'U1') and not c_include_active_flows;

      v_pool := case when v_sc.role = 'student'
        then coalesce(v_students, v_staff, v_others)
        else coalesce(v_staff, v_students, v_others) end;

      if v_sc.code like 'D%' then
        -- Bulan sebelumnya: hari ke-dayn sejak awal bulan lalu, tetap di dalam bulan lalu.
        v_day := pg_temp.sicare_dummy_workday(v_prev_start + v_sc.dayn, 1);
        if v_day >= v_month_start then
          v_day := pg_temp.sicare_dummy_workday(v_month_start - 1, -1);
        end if;
        if v_day < v_period.starts_on then
          v_day := pg_temp.sicare_dummy_workday(v_today - (30 - v_sc.dayn), -1);
          raise notice '%: bulan lalu di luar periode; memakai %.', v_sc.code, v_day;
        end if;
      else
        v_day := pg_temp.sicare_dummy_workday(v_today + v_sc.dayn,
                   case when v_sc.dayn < 0 then -1 else 1 end);
      end if;

      insert into tmp_dummy_scenarios values (
        v_sc.code, v_sc.kind, v_pool[1 + ((v_sc.nth - 1) % array_length(v_pool, 1))],
        v_counselors[1 + ((v_sc.couns - 1) % v_n_couns)], v_day, v_sc.hr, v_sc.grp,
        v_sc.rating, v_sc.moderation
      );
    end loop;
  end if;

  -- ------------------------------------------------------------------ buat data per skenario
  for v_sc in select * from tmp_dummy_scenarios order by s_day, s_code loop
    if v_sc.s_day not between v_period.starts_on and v_period.ends_on then
      raise exception 'Skenario % jatuh pada % di luar periode % s.d. %.',
        v_sc.s_code, v_sc.s_day, v_period.starts_on, v_period.ends_on;
    end if;

    if v_sc.s_kind = 'ongoing' then
      v_starts := date_trunc('minute', v_now) - interval '15 minutes';
      v_ends := v_starts + interval '60 minutes';
    elsif v_sc.s_kind in ('start_ready', 'start_consent_pending') then
      -- Jendela "Mulai Sesi" dibuka 15 menit sebelum jadwal sampai jadwal selesai.
      v_starts := date_trunc('minute', v_now) + interval '10 minutes';
      v_ends := v_starts + interval '60 minutes';
    else
      -- Geser jam bila konselor atau klien sudah punya slot/booking di jam yang sama.
      v_hour := v_sc.s_hour;
      loop
        v_starts := (v_sc.s_day + make_time(v_hour, 0, 0)) at time zone c_zone;
        v_ends := v_starts + interval '1 hour';
        exit when not exists (
            select 1 from public.availability_slots s
            where s.counselor_id = v_sc.s_counselor and s.starts_at < v_ends and s.ends_at > v_starts)
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

    v_bstatus := case v_sc.s_kind
      when 'completed' then 'confirmed'
      when 'ongoing' then 'confirmed'
      when 'client_cancelled' then 'cancelled'
      when 'counselor_cancelled' then 'cancelled'
      when 'waiting' then 'waiting_confirmation'
      when 'confirmed_upcoming' then 'confirmed'
      when 'start_ready' then 'confirmed'
      when 'start_consent_pending' then 'confirmed'
    end;
    v_sstatus := case v_sc.s_kind
      when 'completed' then 'completed'
      when 'ongoing' then 'ongoing'
      when 'counselor_cancelled' then 'cancelled'
      when 'confirmed_upcoming' then 'scheduled'
      when 'start_ready' then 'scheduled'
      when 'start_consent_pending' then 'scheduled'
    end;
    v_reason := case v_sc.s_kind
      when 'client_cancelled' then 'Ada jadwal yang bentrok.'
      when 'counselor_cancelled' then 'Sesi dibatalkan oleh konselor'
    end;

    insert into public.availability_slots (counselor_id, academic_period_id, starts_at, ends_at, status, created_at)
    values (v_sc.s_counselor, v_period.id, v_starts, v_ends, 'available', least(v_starts - interval '14 days', v_now))
    returning id into v_slot_id;

    insert into public.bookings (
      client_id, counselor_id, availability_slot_id, service_type, group_name, participant_count,
      starts_at, ends_at, status, cancellation_reason, created_at, updated_at
    ) values (
      v_client.user_id, v_sc.s_counselor, v_slot_id,
      case when v_sc.s_group then 'group' else 'individual' end,
      case when v_sc.s_group then 'Kelompok Dummy ' || v_sc.s_code end,
      case when v_sc.s_group then 1 + array_length(c_guests, 1) else 1 end,
      v_starts, v_ends, v_bstatus, v_reason, v_created,
      case when v_bstatus = 'waiting_confirmation' then v_created else v_confirmed end
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

    -- Notifikasi pembuatan booking (sama seperti sicare_create_booking).
    insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
    values
      (v_sc.s_counselor, 'booking.created', 'Permintaan konseling baru',
       'Ada permintaan konseling yang perlu ditinjau.', 'booking', v_booking_id, v_created,
       case when v_sc.s_kind <> 'waiting' then v_created + interval '1 hour' end),
      (v_client.user_id, 'booking.submitted', 'Permintaan konseling terkirim',
       'Permintaan konseling menunggu konfirmasi konselor.', 'booking', v_booking_id, v_created,
       v_created + interval '10 minutes');

    -- Notifikasi konfirmasi konselor (sicare_transition_booking -> confirmed).
    if v_sc.s_kind in ('completed', 'ongoing', 'counselor_cancelled', 'confirmed_upcoming',
                       'start_ready', 'start_consent_pending') then
      insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
      values (v_client.user_id, 'booking.confirmed', 'Konseling dikonfirmasi',
              'Permintaan konseling diterima. Periksa detail sesi.', 'booking', v_booking_id, v_confirmed,
              case when v_sc.s_kind not in ('confirmed_upcoming', 'start_ready', 'start_consent_pending')
                   then v_confirmed + interval '1 hour' end);
    end if;

    -- Pembatalan oleh klien -> notifikasi ke konselor (sicare_transition_booking -> cancelled).
    if v_sc.s_kind = 'client_cancelled' then
      insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
      values (v_sc.s_counselor, 'booking.cancelled', 'Konseling dibatalkan',
              'Status permintaan konseling berubah menjadi dibatalkan.', 'booking', v_booking_id,
              v_confirmed, null);
    end if;

    continue when v_sstatus is null;

    if v_has_format_col then
      -- Skema lama (format wajib). SQL dinamis agar tetap valid setelah kolomnya dihapus.
      execute 'insert into public.counseling_sessions (
                 booking_id, counselor_id, starts_at, ends_at, status, format, room,
                 started_at, completed_at, created_at, updated_at
               ) values ($1, $2, $3, $4, $5, ''offline'', $6, $7, $8, $9, $10)
               returning id'
        into v_session_id
        using v_booking_id, v_sc.s_counselor, v_starts, v_ends, v_sstatus, c_room,
              case when v_sstatus in ('completed', 'ongoing') then v_starts + interval '3 minutes' end,
              case when v_sstatus = 'completed' then v_ends - interval '5 minutes' end,
              v_confirmed,
              case when v_sstatus = 'completed' then v_ends - interval '5 minutes'
                   when v_sstatus = 'ongoing' then v_starts + interval '3 minutes'
                   when v_sstatus = 'cancelled' then least(v_starts - interval '1 day', v_now)
                   else v_confirmed end;
    else
      insert into public.counseling_sessions (
        booking_id, counselor_id, starts_at, ends_at, status, room,
        started_at, completed_at, created_at, updated_at
      ) values (
        v_booking_id, v_sc.s_counselor, v_starts, v_ends, v_sstatus, c_room,
        case when v_sstatus in ('completed', 'ongoing') then v_starts + interval '3 minutes' end,
        case when v_sstatus = 'completed' then v_ends - interval '5 minutes' end,
        v_confirmed,
        case when v_sstatus = 'completed' then v_ends - interval '5 minutes'
             when v_sstatus = 'ongoing' then v_starts + interval '3 minutes'
             when v_sstatus = 'cancelled' then least(v_starts - interval '1 day', v_now)
             else v_confirmed end
      ) returning id into v_session_id;
    end if;

    -- Pembatalan sesi oleh konselor -> notifikasi ke klien (sicare_transition_session -> cancelled).
    if v_sstatus = 'cancelled' then
      insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
      values (v_client.user_id, 'session.cancelled', 'Sesi konseling dibatalkan',
              'Sesi konseling dibatalkan oleh konselor.', 'session', v_session_id,
              least(v_starts - interval '1 day', v_now), null);
      continue;
    end if;

    -- Informed consent per peserta: selesai / berlangsung / start_ready => signed (wajib untuk
    -- memulai sesi); mendatang dan start_consent_pending => pending.
    v_signed := v_sstatus in ('completed', 'ongoing') or v_sc.s_kind = 'start_ready';
    for v_part in
      select * from public.booking_participants where booking_id = v_booking_id order by is_primary desc
    loop
      v_c_status   := case when v_signed then 'signed' else 'pending' end;
      v_c_signer   := case when v_signed then v_part.user_id end;
      v_c_name     := case when v_signed then v_part.full_name end;
      v_c_identity := case when v_signed then jsonb_strip_nulls(jsonb_build_object(
                        'full_name', v_part.full_name, 'nim', v_part.nim, 'gender', v_part.gender))
                      else '{}'::jsonb end;
      v_c_viewed   := case when v_signed then v_confirmed + interval '2 hours' end;
      v_c_signed   := case when v_signed then v_confirmed + interval '3 hours' end;
      v_c_method   := case when v_signed then 'electronic_canvas' end;

      if v_has_template_col then
        -- Skema lama (consent_template_id wajib). SQL dinamis agar tetap valid di skema baru.
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

    -- Sesi berlangsung -> notifikasi ke klien (sicare_transition_session -> ongoing).
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
        v_session_id, v_sc.s_counselor,
        '[DUMMY] Catatan konselor untuk pengujian. Bukan data klinis nyata.',
        '[DUMMY] Klien diajak menyusun jadwal mingguan dan teknik relaksasi sederhana.',
        '[DUMMY] Evaluasi progres pada sesi berikutnya bila diperlukan.',
        v_ends
      );
    end if;

    -- Sesi selesai -> notifikasi ke klien. Belum dibaca bila feedback belum diisi.
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
      v_session_id, v_client.user_id, v_sc.s_counselor, v_sc.s_rating,
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

  -- ------------------------------------------------------------------ 3. jadwal kosong
  for v_i in 1 .. v_n_couns loop
    for v_k in 1 .. array_length(v_offsets, 1) loop
      v_day := v_today + v_offsets[v_k];
      loop
        v_starts := (v_day + make_time(v_hours[v_k], 0, 0)) at time zone c_zone;
        v_ends := v_starts + interval '1 hour';
        exit when extract(isodow from v_day) <= 5 and not exists (
          select 1 from public.availability_slots s
          where s.counselor_id = v_counselors[v_i]
            and s.starts_at < v_ends and s.ends_at > v_starts);
        v_day := v_day + 1;
      end loop;

      if v_day > v_period.ends_on then
        raise notice 'Slot kosong % untuk konselor % dilewati: % di luar periode.', v_k, v_counselors[v_i], v_day;
        continue;
      end if;

      insert into public.availability_slots (counselor_id, academic_period_id, starts_at, ends_at, status)
      values (v_counselors[v_i], v_period.id, v_starts, v_ends, 'available');
      v_n_empty := v_n_empty + 1;
    end loop;
  end loop;

  select count(*) into v_n from tmp_dummy_scenarios;
  raise notice 'Selesai: % booking dummy (% untuk akun target), % slot kosong.',
    v_n, (select count(*) from tmp_dummy_scenarios where s_client = v_target_client), v_n_empty;
end;
$$;

commit;

-- Uji alur sesi konselor (giovana@unikadelasalle.ac.id) di Aktivitas Konselor:
--   G4 (akun target, berlangsung)  -> "Selesaikan Sesi".
--   T1 (klien dummy, berlangsung)  -> "Hentikan Sesi", wajib alasan.
--   T2 (terjadwal ~10 menit lagi, consent lengkap) -> "Mulai Sesi" aktif.
--   T3 (kelompok, terjadwal ~10 menit lagi, consent belum ditandatangani) -> tombol
--      "Persetujuan" menampilkan status per peserta; "Mulai Sesi" terkunci dengan alasan consent.
-- Jendela uji: T2/T3 dapat dimulai sampai 70 menit setelah skrip dijalankan; G4/T1 berakhir
-- 45 menit setelah skrip dijalankan dan otomatis ditutup 2 jam setelahnya bila tidak diakhiri.

-- Ringkasan hasil:
-- select b.status as booking, s.status as sesi, b.service_type,
--        b.starts_at at time zone 'Asia/Makassar' as mulai_wita,
--        uc.email as klien, ux.email as konselor, f.rating, f.moderation_status
-- from public.bookings b
-- join auth.users uc on uc.id = b.client_id
-- join auth.users ux on ux.id = b.counselor_id
-- left join public.counseling_sessions s on s.booking_id = b.id
-- left join public.feedback f on f.session_id = s.id
-- order by b.starts_at;
--
-- select ux.email as konselor, count(*) as slot_kosong_mendatang
-- from public.availability_slots a join auth.users ux on ux.id = a.counselor_id
-- where a.starts_at > now() and a.status = 'available'
--   and not exists (select 1 from public.bookings b where b.availability_slot_id = a.id
--                   and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested'))
-- group by 1;
--
-- select type, count(*) from public.notifications group by 1 order by 1;
