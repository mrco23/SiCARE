-- SiCARE: data dummy terarah untuk semester (periode akademik) yang sedang berjalan.
--
-- Jalankan di Supabase Dashboard -> SQL Editor pada project NON-PRODUKSI, SETELAH
-- be/scripts/reset-transactional-data.sql. Skrip manual, bukan migrasi.
--
-- TIDAK membuat akun admin, Kepala LMI, maupun konselor. Skrip memakai konselor yang SUDAH ADA
-- (app_role = 'counselor', aktif, counselor_profiles.is_public = true) dan membuat/memakai ulang
-- 10 akun klien dummy klien01..10@sicare-dummy.test (login dengan email atau NIM/NIP):
--   - 70% mahasiswa  : klien01..07, member_category 'student',       NIM dummy 2699000101..07
--   - 30% dosen/staf : klien08..10, member_category 'faculty_staff', NIP dummy 2699100108..10
-- Password akun klien dummy ada di konstanta c_password di bawah.
--
-- Skenario (konselor dibagi bergiliran; jam dalam WITA; tanggal relatif terhadap hari ini dan
-- digeser ke hari kerja):
--   A. Konseling SELESAI + feedback (4):
--        C1 individu  klien01 (mhs)    -21 hari 09.00  rating 5  feedback shown
--        C2 individu  klien08 (dosen)  -14 hari 10.00  rating 4  feedback shown
--        C3 kelompok  klien03 (mhs)    -10 hari 13.00  rating 4  feedback pending (3 peserta)
--        C4 individu  klien04 (mhs)     -7 hari 14.00  rating 3  feedback disabled
--      Masing-masing: booking confirmed, sesi completed, consent signed per peserta,
--      catatan sesi [DUMMY], intake [DUMMY].
--   B. Konseling DIURUNGKAN (2):
--        X1 dibatalkan klien     klien09 (staf)  -5 hari 09.00  booking cancelled saat masih
--                                                               menunggu konfirmasi (tanpa sesi)
--        X2 dibatalkan konselor  klien02 (mhs)   -3 hari 10.00  booking & sesi cancelled
--   C. Jadwal KOSONG: 3 slot per konselor, +2 / +5 / +7 hari kerja, jam 09.00 / 11.00 / 14.00.
--   D. Alur aktif (opsional, c_include_active_flows):
--        W1 menunggu konfirmasi   klien05 (mhs)    +3 hari 10.00  (uji Terima/Tolak konselor)
--        U1 terkonfirmasi         klien10 (dosen)  +4 hari 13.00  consent pending (uji tanda
--                                                                tangan consent & mulai sesi)
--   klien06, klien07 sengaja tanpa booking: akun bersih untuk uji pemesanan baru.
--   E. Notifikasi in-app sesuai A, B, D dengan type yang memang dibuat backend/RPC.
--      Jadwal kosong (C) tidak punya jenis notifikasi di sistem, jadi tidak dibuat.
--
-- Yang TIDAK dibuat: whatsapp_outbox (agar worker tidak mengirim pesan), consent_invitations,
-- audit log. Klien dummy whatsapp_opt_in = false dengan nomor +62800... (bukan nomor nyata).
-- Consent dummy tidak punya file PDF/tanda tangan; unduh PDF consent dummy akan gagal.
-- Skrip menolak berjalan bila klien dummy sudah punya booking (jalankan reset dulu).

begin;

do $$
declare
  c_password constant text := 'DummySicare#2026';
  c_domain   constant text := 'sicare-dummy.test';
  c_zone     constant text := 'Asia/Makassar';
  -- Harus sama dengan OFFICIAL_TEMPLATE_VERSION di be/src/services/consentPdf.service.js
  c_consent_version constant text := 'v1.0';
  c_include_active_flows constant boolean := true;

  -- Database yang belum menerapkan migrasi 20261119120000_sicare_drop_consent_templates.sql
  -- masih punya kolom wajib informed_consents.consent_template_id.
  v_has_template_col boolean;
  v_template_id uuid;
  v_version    text;
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

  v_counselors uuid[];
  v_n_couns    int;
  v_counselor  uuid;
  v_uid        uuid;
  v_email      text;
  v_i          int;
  v_k          int;
  v_sc         record;
  v_client     record;
  v_part       record;
  v_admin      record;
  v_day        date;
  v_step       int;
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
  v_is_group   boolean;
  v_signed     boolean;
  v_offsets    int[] := array[2, 5, 7];
  v_hours      int[] := array[9, 11, 14];
  v_n_empty    int := 0;

  -- 10 akun klien dummy: indeks 1-7 mahasiswa (70%), 8-10 dosen/staf (30%).
  c_names    text[] := array[
    'Andreas Pangemanan','Brigita Sumampouw','Christian Rondonuwu','Debora Lumowa',
    'Elkana Wenas','Fransiska Tumbelaka','Gabriel Mandagi',
    'Helena Kaunang, M.Kom.','Ignasius Supit, S.E.','Juliana Rumengan, M.Kep.'];
  c_category text[] := array[
    'student','student','student','student','student','student','student',
    'faculty_staff','faculty_staff','faculty_staff'];
  c_gender   text[] := array['male','female','male','female','male','female','male','female','male','female'];
  c_faculty  text[] := array[
    'Fakultas Teknik','Fakultas Ekonomi dan Bisnis','Fakultas Hukum','Fakultas Keperawatan',
    'Fakultas Teknik','Fakultas Ilmu Pendidikan','Fakultas Pertanian',
    'Fakultas Teknik','Biro Administrasi Akademik','Fakultas Keperawatan'];
  -- Mahasiswa: program studi. Dosen/staf: jabatan/unit kerja.
  c_prodi    text[] := array[
    'Teknik Informatika','Manajemen','Ilmu Hukum','Ilmu Keperawatan',
    'Teknik Sipil','Pendidikan Bahasa Inggris','Agroteknologi',
    'Dosen Teknik Informatika','Staf Administrasi Akademik','Dosen Ilmu Keperawatan'];
  c_education text[] := array[
    'S1 (sedang menempuh)','S1 (sedang menempuh)','S1 (sedang menempuh)','S1 (sedang menempuh)',
    'S1 (sedang menempuh)','S1 (sedang menempuh)','S1 (sedang menempuh)',
    'S2','S1','S2'];
  c_birthyear int[] := array[2004, 2005, 2004, 2003, 2005, 2004, 2003, 1986, 1990, 1984];
  c_city     text[] := array['Manado','Tomohon','Bitung','Tondano','Airmadidi','Kotamobagu','Manado','Tomohon','Bitung','Manado'];
  c_religion text[] := array['Katolik','Kristen Protestan','Katolik','Kristen Protestan','Katolik','Katolik','Kristen Protestan','Katolik','Islam','Katolik'];
  c_guests   text[] := array['Yohanes Karundeng','Maria Sondakh'];
  v_code     text;
  v_has_intakes boolean := to_regclass('public.booking_intakes') is not null;
  v_has_notes   boolean := to_regclass('public.session_notes') is not null;
  v_missing  text;
begin
  -- ------------------------------------------------------------------ prasyarat
  -- Kolom yang dipakai skrip ini; bila belum ada, migrasi database belum lengkap.
  select string_agg(r.tbl || '.' || r.col, ', ') into v_missing
  from (values
    ('profiles', 'gender'),
    ('profiles', 'member_category'),
    ('booking_participants', 'full_name'),
    ('booking_participants', 'is_primary'),
    ('booking_participants', 'religion'),
    ('booking_participants', 'education'),
    ('booking_participants', 'address'),
    ('informed_consents', 'consent_statement_version')
  ) as r(tbl, col)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col
  );
  if v_missing is not null then
    raise exception 'Migrasi database belum lengkap; kolom tidak ditemukan: %. Terapkan migrasi supabase/migrations terlebih dahulu.', v_missing;
  end if;
  if not v_has_intakes then
    raise notice 'Tabel booking_intakes belum ada; intake dummy dilewati.';
  end if;
  if not v_has_notes then
    raise notice 'Tabel session_notes belum ada; catatan sesi dummy dilewati.';
  end if;

  select array_agg(p.id order by p.created_at) into v_counselors
  from public.profiles p join public.counselor_profiles cp on cp.profile_id = p.id
  where p.app_role = 'counselor' and p.account_status = 'active' and cp.is_public = true
    and nullif(btrim(cp.public_name), '') is not null;
  v_n_couns := coalesce(array_length(v_counselors, 1), 0);
  if v_n_couns = 0 then
    raise exception 'Tidak ada konselor aktif & publik. Buat/aktifkan akun konselor terlebih dahulu.';
  end if;

  v_version := c_consent_version;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'informed_consents'
      and column_name = 'consent_template_id'
  ) into v_has_template_col;

  if v_has_template_col then
    execute 'select id, version from public.consent_templates
             where template_code = $1 and is_active = true limit 1'
      into v_template_id, v_version using 'SICARE_IC_STD';
    if v_template_id is null then
      raise exception 'Template consent aktif SICARE_IC_STD tidak ditemukan.';
    end if;
    raise notice 'Skema lama: consent memakai consent_templates (versi %).', v_version;
  end if;

  if exists (
    select 1 from public.bookings b join auth.users u on u.id = b.client_id
    where u.email like '%@' || c_domain
  ) then
    raise exception 'Klien dummy sudah memiliki booking. Jalankan reset-transactional-data.sql dulu.';
  end if;

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

  raise notice 'Periode: % % (% s.d. %), % konselor.',
    v_period.academic_year, v_period.semester, v_period.starts_on, v_period.ends_on, v_n_couns;

  -- ------------------------------------------------------------------ klien dummy (7 + 3)
  create temp table tmp_dummy_clients (
    idx int primary key, user_id uuid not null, full_name text, nim text, gender_id text,
    faculty text, study_program text, birthplace text, dob date, religion text, phone text,
    address text, category text, education text
  ) on commit drop;

  for v_i in 1 .. array_length(c_names, 1) loop
    v_email := 'klien' || lpad(v_i::text, 2, '0') || '@' || c_domain;
    -- Mahasiswa: NIM dummy 2699000101..; dosen/staf: NIP dummy 2699100108..
    v_code := case when c_category[v_i] = 'student'
                then (2699000100 + v_i)::text else (2699100100 + v_i)::text end;
    select id into v_uid from auth.users where email = v_email;

    if v_uid is null then
      v_uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
        extensions.crypt(c_password, extensions.gen_salt('bf')), v_now,
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', c_names[v_i]), v_now, v_now, '', '', '', ''
      );
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (
        v_uid::text, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        'email', v_now, v_now, v_now
      );
    end if;

    -- Trigger on_auth_user_created_sicare membuat profil 'client'; lengkapi datanya.
    insert into public.profiles (id, full_name, app_role, account_status)
    values (v_uid, c_names[v_i], 'client', 'active')
    on conflict (id) do nothing;

    update public.profiles set
      full_name = c_names[v_i],
      identity_code = v_code,
      member_category = c_category[v_i],
      gender = c_gender[v_i],
      phone_e164 = '+6280000000' || lpad(v_i::text, 2, '0'),
      whatsapp_opt_in = false,
      whatsapp_opt_in_at = null,
      account_status = 'active'
    where id = v_uid and app_role = 'client';

    if not found then
      raise exception 'Akun % sudah ada tetapi bukan klien; skrip dihentikan.', v_email;
    end if;

    insert into tmp_dummy_clients values (
      v_i, v_uid, c_names[v_i], v_code,
      case c_gender[v_i] when 'male' then 'Laki-laki' else 'Perempuan' end,
      c_faculty[v_i], c_prodi[v_i], c_city[v_i],
      make_date(c_birthyear[v_i], 1 + (v_i % 12), 10 + v_i),
      c_religion[v_i], '+6280000000' || lpad(v_i::text, 2, '0'),
      'Jl. Dummy No. ' || v_i || ', ' || c_city[v_i],
      c_category[v_i], c_education[v_i]
    );
  end loop;

  -- ------------------------------------------------------------------ skenario A, B, D
  create temp table tmp_dummy_scenarios (
    s_code text primary key, s_kind text, s_client int, s_counselor int, s_offset int,
    s_hour int, s_group boolean, s_rating int, s_moderation text, s_format text
  ) on commit drop;

  insert into tmp_dummy_scenarios values
    ('C1', 'completed',           1, 1, -21,  9, false, 5, 'shown',    'offline'),  -- mahasiswa
    ('C2', 'completed',           8, 2, -14, 10, false, 4, 'shown',    'offline'),  -- dosen
    ('C3', 'completed',           3, 3, -10, 13, true,  4, 'pending',  'offline'),  -- mahasiswa (kelompok)
    ('C4', 'completed',           4, 4,  -7, 14, false, 3, 'disabled', 'offline'),  -- mahasiswa
    ('X1', 'client_cancelled',    9, 2,  -5,  9, false, null, null,    'offline'),  -- staf
    ('X2', 'counselor_cancelled', 2, 3,  -3, 10, false, null, null,    'offline');  -- mahasiswa

  if c_include_active_flows then
    insert into tmp_dummy_scenarios values
      ('W1', 'waiting',            5, 1, 3, 10, false, null, null, 'offline'),      -- mahasiswa
      ('U1', 'confirmed_upcoming', 10, 2, 4, 13, false, null, null, 'offline');     -- dosen
  end if;

  for v_sc in select * from tmp_dummy_scenarios order by s_offset loop
    select * into v_client from tmp_dummy_clients where idx = v_sc.s_client;
    v_counselor := v_counselors[1 + ((v_sc.s_counselor - 1) % v_n_couns)];

    -- Tanggal: hari ini + offset, digeser menjauhi hari ini sampai hari kerja.
    v_step := case when v_sc.s_offset < 0 then -1 else 1 end;
    v_day := v_today + v_sc.s_offset;
    while extract(isodow from v_day) > 5 loop v_day := v_day + v_step; end loop;
    if v_day not between v_period.starts_on and v_period.ends_on then
      raise exception 'Skenario % jatuh pada % di luar periode % s.d. %.',
        v_sc.s_code, v_day, v_period.starts_on, v_period.ends_on;
    end if;

    v_starts := (v_day + make_time(v_sc.s_hour, 0, 0)) at time zone c_zone;
    v_ends := v_starts + interval '1 hour';
    v_created := least(v_starts - interval '5 days', v_now - interval '2 hours');
    v_confirmed := least(v_created + interval '1 day', v_now - interval '1 hour');
    v_is_group := v_sc.s_group;

    v_bstatus := case v_sc.s_kind
      when 'completed' then 'confirmed'
      when 'client_cancelled' then 'cancelled'
      when 'counselor_cancelled' then 'cancelled'
      when 'waiting' then 'waiting_confirmation'
      when 'confirmed_upcoming' then 'confirmed'
    end;
    v_sstatus := case v_sc.s_kind
      when 'completed' then 'completed'
      when 'counselor_cancelled' then 'cancelled'
      when 'confirmed_upcoming' then 'scheduled'
    end;
    v_reason := case v_sc.s_kind
      when 'client_cancelled' then 'Ada jadwal ujian yang bentrok.'
      when 'counselor_cancelled' then 'Sesi dibatalkan oleh konselor'
    end;

    insert into public.availability_slots (counselor_id, academic_period_id, starts_at, ends_at, status, created_at)
    values (v_counselor, v_period.id, v_starts, v_ends, 'available', least(v_starts - interval '14 days', v_now))
    returning id into v_slot_id;

    insert into public.bookings (
      client_id, counselor_id, availability_slot_id, service_type, group_name, participant_count,
      starts_at, ends_at, status, cancellation_reason, created_at, updated_at
    ) values (
      v_client.user_id, v_counselor, v_slot_id,
      case when v_is_group then 'group' else 'individual' end,
      case when v_is_group then 'Kelompok Studi ' || v_client.study_program end,
      case when v_is_group then 1 + array_length(c_guests, 1) else 1 end,
      v_starts, v_ends, v_bstatus, v_reason, v_created,
      case when v_bstatus = 'waiting_confirmation' then v_created else v_confirmed end
    ) returning id into v_booking_id;

    -- Peserta utama (klien pemesan) dengan identitas lengkap.
    insert into public.booking_participants (
      booking_id, user_id, display_name, full_name, is_representative, is_primary,
      participant_type, participant_status, faculty, study_program, nim, birthplace,
      date_of_birth, gender, phone_e164, religion, education, address, created_at
    ) values (
      v_booking_id, v_client.user_id, v_client.full_name, v_client.full_name, true, true,
      'primary_client', 'registered', v_client.faculty, v_client.study_program, v_client.nim,
      v_client.birthplace, v_client.dob, v_client.gender_id, v_client.phone, v_client.religion,
      v_client.education, v_client.address, v_created
    );

    if v_is_group then
      for v_k in 1 .. array_length(c_guests, 1) loop
        insert into public.booking_participants (
          booking_id, display_name, full_name, phone_e164, is_representative, is_primary,
          participant_type, participant_status, created_at
        ) values (
          v_booking_id, c_guests[v_k], c_guests[v_k], '+6280000001' || lpad(v_k::text, 2, '0'),
          false, false, 'guest_member', 'registered', v_created
        );
      end loop;
    end if;

    -- Intake (format clientIntakeAnswersSchema di be/src/validators/booking.validator.js).
    if v_has_intakes then
      insert into public.booking_intakes (booking_id, client_id, answers, created_at)
      values (v_booking_id, v_client.user_id, jsonb_build_object(
        'selfHarm', 'Tidak', 'distress', 'Mungkin', 'abuse', 'Tidak', 'substance', 'Tidak',
        'sleep', 3, 'finance', 4,
        'topics', jsonb_build_array(case
          when v_is_group then 'Relasi'
          when v_client.category = 'student' then 'Akademik'
          else 'Karier' end),
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
      (v_counselor, 'booking.created', 'Permintaan konseling baru',
       'Ada permintaan konseling yang perlu ditinjau.', 'booking', v_booking_id, v_created,
       case when v_sc.s_kind <> 'waiting' then v_created + interval '1 hour' end),
      (v_client.user_id, 'booking.submitted', 'Permintaan konseling terkirim',
       'Permintaan konseling menunggu konfirmasi konselor.', 'booking', v_booking_id, v_created,
       v_created + interval '10 minutes');

    -- Notifikasi konfirmasi konselor (sicare_transition_booking -> confirmed).
    if v_sc.s_kind in ('completed', 'counselor_cancelled', 'confirmed_upcoming') then
      insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
      values (v_client.user_id, 'booking.confirmed', 'Konseling dikonfirmasi',
              'Permintaan konseling diterima. Periksa detail sesi.', 'booking', v_booking_id, v_confirmed,
              case when v_sc.s_kind <> 'confirmed_upcoming' then v_confirmed + interval '1 hour' end);
    end if;

    -- Pembatalan oleh klien -> notifikasi ke konselor (sicare_transition_booking -> cancelled).
    if v_sc.s_kind = 'client_cancelled' then
      insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
      values (v_counselor, 'booking.cancelled', 'Konseling dibatalkan',
              'Status permintaan konseling berubah menjadi dibatalkan.', 'booking', v_booking_id,
              v_confirmed, null);
    end if;

    continue when v_sstatus is null;

    insert into public.counseling_sessions (
      booking_id, counselor_id, starts_at, ends_at, status, room,
      started_at, completed_at, created_at, updated_at
    ) values (
      -- Kolom format dihapus (migrasi 20261123120000); layanan hanya tatap muka.
      v_booking_id, v_counselor, v_starts, v_ends, v_sstatus,
      'Ruang Konseling LMI',
      case when v_sstatus = 'completed' then v_starts + interval '3 minutes' end,
      case when v_sstatus = 'completed' then v_ends - interval '5 minutes' end,
      v_confirmed,
      case when v_sstatus = 'completed' then v_ends - interval '5 minutes'
           when v_sstatus = 'cancelled' then least(v_starts - interval '1 day', v_now)
           else v_confirmed end
    ) returning id into v_session_id;

    -- Pembatalan sesi oleh konselor -> notifikasi ke klien (sicare_transition_session -> cancelled).
    if v_sstatus = 'cancelled' then
      insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
      values (v_client.user_id, 'session.cancelled', 'Sesi konseling dibatalkan',
              'Sesi konseling dibatalkan oleh konselor.', 'session', v_session_id,
              least(v_starts - interval '1 day', v_now), null);
      continue;
    end if;

    -- Informed consent per peserta: selesai => signed; mendatang => pending.
    v_signed := v_sstatus = 'completed';
    for v_part in
      select * from public.booking_participants where booking_id = v_booking_id order by is_primary desc
    loop
      v_c_status   := case when v_signed then 'signed' else 'pending' end;
      v_c_signer   := case when v_signed then v_part.user_id end;
      v_c_name     := case when v_signed then v_part.full_name end;
      v_c_identity := case when v_signed then jsonb_strip_nulls(jsonb_build_object(
                        'full_name', v_part.full_name, 'nim', v_part.nim, 'faculty', v_part.faculty,
                        'study_program', v_part.study_program, 'gender', v_part.gender))
                      else '{}'::jsonb end;
      v_c_viewed   := case when v_signed then v_confirmed + interval '2 hours' end;
      v_c_signed   := case when v_signed then v_confirmed + interval '3 hours' end;
      v_c_method   := case when v_signed then 'electronic_canvas' end;

      if v_has_template_col then
        -- Skema lama (consent_template_id wajib). SQL dinamis agar skrip tetap valid di skema
        -- baru, tempat kolom ini sudah tidak ada.
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

    insert into public.feedback (
      session_id, client_id, counselor_id, rating, comment, moderation_status, review_status,
      disabled_reason, created_at
    ) values (
      v_session_id, v_client.user_id, v_counselor, v_sc.s_rating,
      case v_sc.s_rating
        when 5 then 'Konselor sangat membantu dan mendengarkan dengan baik.'
        when 4 then 'Sesi terasa nyaman, saya mendapat langkah konkret untuk dicoba.'
        else 'Cukup membantu, semoga waktunya bisa sedikit lebih panjang.'
      end,
      v_sc.s_moderation,
      case v_sc.s_moderation when 'pending' then 'new' when 'shown' then 'reviewed' else 'resolved' end,
      case when v_sc.s_moderation = 'disabled' then '[DUMMY] Contoh feedback yang dinonaktifkan admin.' end,
      v_ends + interval '3 hours'
    ) returning id into v_feedback_id;

    insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
    values (v_client.user_id, 'session.completed', 'Sesi konseling selesai',
            'Sesi konseling selesai. Kamu dapat memberikan feedback.', 'session', v_session_id,
            v_ends - interval '5 minutes', v_ends + interval '2 hours');

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

  -- ------------------------------------------------------------------ C. jadwal kosong
  for v_i in 1 .. v_n_couns loop
    for v_k in 1 .. array_length(v_offsets, 1) loop
      v_day := v_today + v_offsets[v_k];
      loop
        v_starts := (v_day + make_time(v_hours[v_k], 0, 0)) at time zone c_zone;
        v_ends := v_starts + interval '1 hour';
        exit when extract(isodow from v_day) <= 5 and not exists (
          select 1 from public.availability_slots s
          where s.counselor_id = v_counselors[v_i]
            and s.status = 'available'
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

  raise notice 'Selesai: % skenario booking, % slot kosong.',
    (select count(*) from tmp_dummy_scenarios), v_n_empty;
end;
$$;

commit;

-- Ringkasan hasil:
-- select b.status as booking, s.status as sesi, b.service_type, b.starts_at at time zone 'Asia/Makassar' as mulai_wita,
--        p.full_name as klien, f.rating, f.moderation_status
-- from public.bookings b
-- join public.profiles p on p.id = b.client_id
-- left join public.counseling_sessions s on s.booking_id = b.id
-- left join public.feedback f on f.session_id = s.id
-- order by b.starts_at;
--
-- select p.full_name as konselor, count(*) as slot_kosong_mendatang
-- from public.availability_slots a join public.profiles p on p.id = a.counselor_id
-- where a.starts_at > now() and a.status = 'available'
--   and not exists (select 1 from public.bookings b where b.availability_slot_id = a.id
--                   and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested'))
-- group by 1;
--
-- select type, count(*) from public.notifications group by 1 order by 1;
--
-- Opsional: hapus akun klien dummy SETELAH reset-transactional-data.sql (booking mereferensikan
-- profil dengan ON DELETE RESTRICT, jadi data transaksinya harus sudah bersih):
-- delete from auth.users where email like '%@sicare-dummy.test';
