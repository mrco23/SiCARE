-- SiCARE: data dummy terarah untuk semester (periode akademik) yang sedang berjalan,
-- memakai AKUN YANG SUDAH ADA di website.
--
-- Jalankan di Supabase Dashboard -> SQL Editor pada project NON-PRODUKSI, SETELAH
-- be/scripts/reset-transactional-data.sql. Skrip manual, bukan migrasi.
--
-- Skrip TIDAK membuat akun apa pun (tidak menyentuh auth.users maupun profiles). Yang dipakai:
--   - Konselor : app_role = 'counselor', aktif, counselor_profiles.is_public = true, ada public_name.
--   - Klien    : app_role = 'client', aktif. Dibagi menurut profiles.member_category:
--                'student' (mahasiswa) dan 'faculty_staff' (dosen/staf); 'other'/kosong menjadi
--                cadangan. Bila salah satu kelompok kosong, skenarionya memakai kelompok lain.
--   - Admin & Kepala LMI aktif hanya menerima notifikasi feedback baru.
-- Identitas peserta diambil dari profil (nama, NIM/NIP = identity_code, gender, nomor). Fakultas,
-- prodi, tempat/tanggal lahir, agama, dan alamat tidak ada di profil, jadi dibiarkan kosong.
--
-- Skenario (8 booking: ±70% mahasiswa, ±30% dosen/staf; konselor dibagi bergiliran; jam WITA;
-- tanggal relatif terhadap hari ini dan digeser ke hari kerja):
--   A. Konseling SELESAI + feedback (4):
--        C1 individu  mahasiswa ke-1  -21 hari 09.00  rating 5  feedback shown
--        C2 individu  dosen/staf ke-1 -14 hari 10.00  rating 4  feedback shown
--        C3 kelompok  mahasiswa ke-2  -10 hari 13.00  rating 4  feedback pending (3 peserta)
--        C4 individu  mahasiswa ke-3   -7 hari 14.00  rating 3  feedback disabled
--      Masing-masing: booking confirmed, sesi completed, consent signed per peserta,
--      catatan sesi [DUMMY], intake [DUMMY].
--   B. Konseling DIURUNGKAN (2):
--        X1 dibatalkan klien     mahasiswa ke-4  -5 hari 09.00  booking cancelled saat masih
--                                                               menunggu konfirmasi (tanpa sesi)
--        X2 dibatalkan konselor  mahasiswa ke-5  -3 hari 10.00  booking & sesi cancelled
--   C. Jadwal KOSONG: 3 slot per konselor, +2 / +5 / +7 hari kerja, jam 09.00 / 11.00 / 14.00.
--   D. Alur aktif (opsional, c_include_active_flows):
--        W1 menunggu konfirmasi  mahasiswa ke-6   +3 hari 10.00  (uji Terima/Tolak konselor)
--        U1 terkonfirmasi        dosen/staf ke-2  +4 hari 13.00  consent pending (uji tanda
--                                                                tangan consent & mulai sesi)
--      "ke-n" berputar bila akun di kelompok itu lebih sedikit (mis. 2 mahasiswa -> ke-3 = ke-1).
--   E. Notifikasi in-app sesuai A, B, D dengan type yang memang dibuat backend/RPC.
--      Jadwal kosong (C) tidak punya jenis notifikasi di sistem, jadi tidak dibuat.
--
-- Yang TIDAK dibuat: whatsapp_outbox (agar worker tidak mengirim WhatsApp ke nomor akun asli),
-- consent_invitations, audit log. Consent dummy tidak punya file PDF/tanda tangan; unduh PDF
-- consent dummy akan gagal.
-- Skrip menolak berjalan bila tabel bookings belum kosong (jalankan reset dulu).
-- Tahan terhadap skema lama: kolom counseling_sessions.format dan
-- informed_consents.consent_template_id diisi bila masih ada; tabel booking_intakes dan
-- session_notes dilewati bila belum ada.

begin;

do $$
declare
  c_zone     constant text := 'Asia/Makassar';
  -- Harus sama dengan OFFICIAL_TEMPLATE_VERSION di be/src/services/consentPdf.service.js
  c_consent_version constant text := 'v1.0';
  c_include_active_flows constant boolean := true;
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
  v_students   uuid[];
  v_staff      uuid[];
  v_others     uuid[];
  v_pool       uuid[];
  v_client_id  uuid;
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
  v_used       uuid[] := '{}';
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

  -- ------------------------------------------------------------------ akun yang ada
  select array_agg(p.id order by p.created_at) into v_counselors
  from public.profiles p join public.counselor_profiles cp on cp.profile_id = p.id
  where p.app_role = 'counselor' and p.account_status = 'active' and cp.is_public = true
    and nullif(btrim(cp.public_name), '') is not null;
  v_n_couns := coalesce(array_length(v_counselors, 1), 0);
  if v_n_couns = 0 then
    raise exception 'Tidak ada konselor aktif & publik. Aktifkan/publikasikan akun konselor terlebih dahulu.';
  end if;

  select
    array_agg(p.id order by p.created_at) filter (where p.member_category = 'student'),
    array_agg(p.id order by p.created_at) filter (where p.member_category = 'faculty_staff'),
    array_agg(p.id order by p.created_at) filter (where p.member_category is null or p.member_category = 'other')
  into v_students, v_staff, v_others
  from public.profiles p
  where p.app_role = 'client' and p.account_status = 'active';

  if coalesce(array_length(v_students, 1), 0) + coalesce(array_length(v_staff, 1), 0)
     + coalesce(array_length(v_others, 1), 0) = 0 then
    raise exception 'Tidak ada akun klien aktif. Daftarkan minimal satu akun klien di website.';
  end if;

  raise notice 'Akun klien aktif: % mahasiswa, % dosen/staf, % lainnya; % konselor.',
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

  -- ------------------------------------------------------------------ skenario A, B, D
  -- s_role: kelompok akun yang diutamakan; s_nth: urutan akun di kelompok itu.
  create temp table tmp_dummy_scenarios (
    s_code text primary key, s_kind text, s_role text, s_nth int, s_counselor int,
    s_offset int, s_hour int, s_group boolean, s_rating int, s_moderation text
  ) on commit drop;

  insert into tmp_dummy_scenarios values
    ('C1', 'completed',           'student', 1, 1, -21,  9, false, 5, 'shown'),
    ('C2', 'completed',           'staff',   1, 2, -14, 10, false, 4, 'shown'),
    ('C3', 'completed',           'student', 2, 3, -10, 13, true,  4, 'pending'),
    ('C4', 'completed',           'student', 3, 4,  -7, 14, false, 3, 'disabled'),
    ('X1', 'client_cancelled',    'student', 4, 2,  -5,  9, false, null, null),
    ('X2', 'counselor_cancelled', 'student', 5, 3,  -3, 10, false, null, null);

  if c_include_active_flows then
    insert into tmp_dummy_scenarios values
      ('W1', 'waiting',            'student', 6, 1, 3, 10, false, null, null),
      ('U1', 'confirmed_upcoming', 'staff',   2, 2, 4, 13, false, null, null);
  end if;

  for v_sc in select * from tmp_dummy_scenarios order by s_offset loop
    -- Pilih akun: kelompok yang diutamakan, lalu kelompok lain bila kosong.
    v_pool := case when v_sc.s_role = 'student'
      then coalesce(v_students, v_staff, v_others)
      else coalesce(v_staff, v_students, v_others) end;
    if v_pool is null then
      v_pool := coalesce(v_students, '{}') || coalesce(v_staff, '{}') || coalesce(v_others, '{}');
    end if;
    v_client_id := v_pool[1 + ((v_sc.s_nth - 1) % array_length(v_pool, 1))];
    v_used := array_append(v_used, v_client_id);

    select p.id as user_id, p.full_name, p.identity_code as nim, p.phone_e164 as phone,
           coalesce(p.member_category, 'other') as category,
           case p.gender when 'male' then 'Laki-laki' when 'female' then 'Perempuan' end as gender_id
    into v_client
    from public.profiles p where p.id = v_client_id;

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
      when 'client_cancelled' then 'Ada jadwal yang bentrok.'
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
      case when v_is_group then 'Kelompok Dummy ' || v_sc.s_code end,
      case when v_is_group then 1 + array_length(c_guests, 1) else 1 end,
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

    if v_is_group then
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
          when v_is_group then 'Relasi di lingkungan sosial (teman, rekan kerja)'
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

    if v_has_format_col then
      -- Skema lama (format wajib). SQL dinamis agar tetap valid setelah kolomnya dihapus.
      execute 'insert into public.counseling_sessions (
                 booking_id, counselor_id, starts_at, ends_at, status, format, room,
                 started_at, completed_at, created_at, updated_at
               ) values ($1, $2, $3, $4, $5, ''offline'', $6, $7, $8, $9, $10)
               returning id'
        into v_session_id
        using v_booking_id, v_counselor, v_starts, v_ends, v_sstatus, c_room,
              case when v_sstatus = 'completed' then v_starts + interval '3 minutes' end,
              case when v_sstatus = 'completed' then v_ends - interval '5 minutes' end,
              v_confirmed,
              case when v_sstatus = 'completed' then v_ends - interval '5 minutes'
                   when v_sstatus = 'cancelled' then least(v_starts - interval '1 day', v_now)
                   else v_confirmed end;
    else
      insert into public.counseling_sessions (
        booking_id, counselor_id, starts_at, ends_at, status, room,
        started_at, completed_at, created_at, updated_at
      ) values (
        v_booking_id, v_counselor, v_starts, v_ends, v_sstatus, c_room,
        case when v_sstatus = 'completed' then v_starts + interval '3 minutes' end,
        case when v_sstatus = 'completed' then v_ends - interval '5 minutes' end,
        v_confirmed,
        case when v_sstatus = 'completed' then v_ends - interval '5 minutes'
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

    -- Informed consent per peserta: selesai => signed; mendatang => pending.
    v_signed := v_sstatus = 'completed';
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
        when 5 then '[DUMMY] Konselor sangat membantu dan mendengarkan dengan baik.'
        when 4 then '[DUMMY] Sesi terasa nyaman, saya mendapat langkah konkret untuk dicoba.'
        else '[DUMMY] Cukup membantu, semoga waktunya bisa sedikit lebih panjang.'
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

  raise notice 'Selesai: % booking dummy untuk % akun klien berbeda, % slot kosong.',
    (select count(*) from tmp_dummy_scenarios),
    (select count(distinct u) from unnest(v_used) u), v_n_empty;
end;
$$;

commit;

-- Ringkasan hasil:
-- select b.status as booking, s.status as sesi, b.service_type,
--        b.starts_at at time zone 'Asia/Makassar' as mulai_wita,
--        p.full_name as klien, p.member_category, f.rating, f.moderation_status
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
