-- SiCARE: data dummy untuk periode akademik yang sedang berjalan.
--
-- Jalankan di Supabase Dashboard -> SQL Editor pada project NON-PRODUKSI, sebaiknya setelah
-- be/scripts/reset-transactional-data.sql. Skrip manual, bukan migrasi.
--
-- TIDAK membuat akun admin, kepala LMI, maupun konselor. Skrip memakai konselor yang SUDAH ADA
-- (app_role = 'counselor', aktif, counselor_profiles.is_public = true) dan membuat/memakai ulang
-- 12 akun klien dummy (email @sicare-dummy.test, login dengan email atau NIM 2699xxxxxx).
-- Password akun klien dummy ada di konstanta c_password di bawah.
--
-- Yang dibuat:
--   - academic_periods : periode berjalan (dipakai bila sudah ada; dibuat bila belum).
--   - availability_slots: jadwal Senin-Jumat per konselor, ~5 minggu ke belakang s.d. 3 minggu
--                         ke depan (dibatasi tanggal periode), jam WITA.
--   - bookings + booking_participants + booking_intakes (individu & kelompok) dengan status
--     waiting_confirmation / confirmed / reschedule_requested / rejected / cancelled / expired.
--   - counseling_sessions: scheduled / completed / missed / cancelled.
--   - informed_consents  : signed / pending (TANPA file PDF & tanda tangan; unduh PDF consent
--                          dummy akan gagal dengan pesan "dokumen belum tersedia").
--   - session_notes, feedback, notifications.
-- Yang TIDAK dibuat: whatsapp_outbox (agar worker tidak mengirim pesan), consent_invitations,
-- audit log. Semua akun dummy whatsapp_opt_in = false dengan nomor +62800... (bukan nomor nyata).
--
-- Skrip menolak berjalan bila klien dummy sudah punya booking (jalankan reset dulu).
-- Hasil acak tetapi dapat diulang (setseed).

begin;

do $$
declare
  c_password constant text := 'DummySicare#2026';
  c_domain   constant text := 'sicare-dummy.test';
  c_zone     constant text := 'Asia/Makassar';

  v_now        timestamptz := now();
  v_today      date := (now() at time zone 'Asia/Makassar')::date;
  v_year       int := extract(year from (now() at time zone 'Asia/Makassar'))::int;
  v_month      int := extract(month from (now() at time zone 'Asia/Makassar'))::int;
  v_acad_year  text;
  v_semester   text;
  v_p_start    date;
  v_p_end      date;
  v_period     public.academic_periods%rowtype;
  v_template   uuid;

  v_uid        uuid;
  v_email      text;
  v_i          int;
  v_ci         int := 0;
  v_counselor  record;
  v_client     record;
  v_day        date;
  v_hour       int;
  v_hours      int[];
  v_slot_id    uuid;
  v_starts     timestamptz;
  v_ends       timestamptz;
  v_r          double precision;
  v_status     text;      -- status booking
  v_sstatus    text;      -- status sesi (null = tanpa sesi)
  v_missed     text;
  v_is_group   boolean;
  v_pcount     int;
  v_booking_id uuid;
  v_session_id uuid;
  v_created    timestamptz;
  v_format     text;
  v_signed     boolean;
  v_part       record;
  v_rating     int;
  v_mod        text;
  v_n_slots    int := 0;
  v_n_bookings int := 0;
  v_n_sessions int := 0;

  -- Data klien dummy: nama, gender profil, gender identitas, fakultas, prodi, tempat lahir,
  -- tanggal lahir, agama. NIM = 2699000101 + indeks.
  c_names   text[] := array[
    'Andreas Pangemanan','Brigita Sumampouw','Christian Rondonuwu','Debora Lumowa',
    'Elkana Wenas','Fransiska Tumbelaka','Gabriel Mandagi','Helena Kaunang',
    'Ignasius Supit','Juliana Rumengan','Kevin Lontoh','Lidya Tangkudung'];
  c_gender  text[] := array['male','female','male','female','male','female','male','female','male','female','male','female'];
  c_faculty text[] := array[
    'Fakultas Teknik','Fakultas Ekonomi dan Bisnis','Fakultas Hukum','Fakultas Keperawatan',
    'Fakultas Teknik','Fakultas Ilmu Pendidikan','Fakultas Pertanian','Fakultas Ekonomi dan Bisnis',
    'Fakultas Hukum','Fakultas Keperawatan','Fakultas Teknik','Fakultas Ilmu Pendidikan'];
  c_prodi   text[] := array[
    'Teknik Informatika','Manajemen','Ilmu Hukum','Ilmu Keperawatan',
    'Teknik Sipil','Pendidikan Bahasa Inggris','Agroteknologi','Akuntansi',
    'Ilmu Hukum','Ilmu Keperawatan','Sistem Informasi','Pendidikan Guru SD'];
  c_city    text[] := array['Manado','Tomohon','Bitung','Tondano','Airmadidi','Kotamobagu','Manado','Tomohon','Bitung','Manado','Tondano','Amurang'];
  c_religion text[] := array['Katolik','Kristen Protestan','Katolik','Kristen Protestan','Katolik','Katolik','Kristen Protestan','Katolik','Islam','Katolik','Kristen Protestan','Katolik'];
  c_guests  text[] := array['Yohanes Karundeng','Maria Sondakh','Paulus Watung','Agnes Pinontoan','Stevanus Lengkong','Natalia Tuwaidan','Rio Palar','Grace Mamahit'];
  c_topics  text[] := array['Akademik','Relasi','Keluarga','Karier','Kecemasan','Manajemen waktu','Motivasi belajar','Adaptasi kampus'];
  c_cancel  text[] := array['Ada jadwal ujian yang bentrok.','Sedang sakit dan perlu istirahat.','Ada urusan keluarga mendadak.'];
  c_comment text[] := array[
    'Konselor sangat membantu dan mendengarkan dengan baik.',
    'Sesi terasa nyaman, saya mendapat langkah konkret untuk dicoba.',
    'Terima kasih, saya merasa lebih tenang setelah sesi.',
    'Cukup membantu, semoga waktunya bisa sedikit lebih panjang.',
    'Penjelasannya jelas dan tidak menghakimi.'];
begin
  perform setseed(0.2026);

  -- ------------------------------------------------------------------ prasyarat
  select id into v_template from public.consent_templates
  where template_code = 'SICARE_IC_STD' and is_active = true limit 1;
  if v_template is null then
    raise exception 'Template consent aktif SICARE_IC_STD tidak ditemukan.';
  end if;

  if not exists (
    select 1 from public.profiles p join public.counselor_profiles cp on cp.profile_id = p.id
    where p.app_role = 'counselor' and p.account_status = 'active' and cp.is_public = true
      and nullif(btrim(cp.public_name), '') is not null
  ) then
    raise exception 'Tidak ada konselor aktif & publik. Buat/aktifkan akun konselor terlebih dahulu.';
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

  raise notice 'Periode: % % (% s.d. %)', v_period.academic_year, v_period.semester, v_period.starts_on, v_period.ends_on;

  -- ------------------------------------------------------------------ klien dummy
  create temp table tmp_dummy_clients (
    idx int primary key, user_id uuid not null, full_name text, nim text, gender_db text,
    gender_id text, faculty text, study_program text, birthplace text, dob date,
    religion text, phone text, address text
  ) on commit drop;

  for v_i in 1 .. array_length(c_names, 1) loop
    v_email := 'klien' || lpad(v_i::text, 2, '0') || '@' || c_domain;
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
      identity_code = (2699000100 + v_i)::text,
      member_category = 'student',
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
      v_i, v_uid, c_names[v_i], (2699000100 + v_i)::text, c_gender[v_i],
      case c_gender[v_i] when 'male' then 'Laki-laki' else 'Perempuan' end,
      c_faculty[v_i], c_prodi[v_i], c_city[v_i],
      make_date(2003 + (v_i % 4), 1 + (v_i % 12), 1 + (v_i * 2 % 27)),
      c_religion[v_i], '+6280000000' || lpad(v_i::text, 2, '0'),
      'Jl. Dummy No. ' || v_i || ', ' || c_city[v_i]
    );
  end loop;

  -- ------------------------------------------------------------------ jadwal, booking, sesi
  for v_counselor in
    select p.id, coalesce(cp.public_name, p.full_name) as name
    from public.profiles p join public.counselor_profiles cp on cp.profile_id = p.id
    where p.app_role = 'counselor' and p.account_status = 'active' and cp.is_public = true
      and nullif(btrim(cp.public_name), '') is not null
    order by p.created_at
  loop
    v_ci := v_ci + 1;
    v_hours := case when v_ci % 2 = 1 then array[9, 13] else array[10, 14] end;

    for v_day in
      select d::date from generate_series(
        greatest(v_period.starts_on, v_today - 35),
        least(v_period.ends_on, v_today + 21),
        interval '1 day') d
      where extract(isodow from d) between 1 and 5
    loop
      foreach v_hour in array v_hours loop
        if random() < 0.15 then continue; end if; -- sebagian hari tidak dibuka

        v_starts := (v_day + make_time(v_hour, 0, 0)) at time zone c_zone;
        v_ends := v_starts + interval '1 hour';

        insert into public.availability_slots (counselor_id, academic_period_id, starts_at, ends_at, status, created_at)
        values (v_counselor.id, v_period.id, v_starts, v_ends, 'available',
                least(v_starts - interval '14 days', v_now))
        returning id into v_slot_id;
        v_n_slots := v_n_slots + 1;

        -- Tentukan status booking (null = slot tidak dipesan).
        v_r := random();
        v_status := null; v_sstatus := null; v_missed := null;
        if v_ends < v_now then
          if v_r >= 0.45 then
            v_r := random();
            if    v_r < 0.60 then v_status := 'confirmed'; v_sstatus := 'completed';
            elsif v_r < 0.72 then v_status := 'confirmed'; v_sstatus := 'missed';
                  v_missed := case when random() < 0.6 then 'consent_unsigned' else 'not_started' end;
            elsif v_r < 0.82 then v_status := 'cancelled';
                  v_sstatus := case when random() < 0.5 then 'cancelled' else null end;
            elsif v_r < 0.90 then v_status := 'rejected';
            else                  v_status := 'expired';
            end if;
          end if;
        elsif v_r >= 0.55 then
          v_r := random();
          if    v_r < 0.40 then v_status := 'waiting_confirmation';
          elsif v_r < 0.85 then v_status := 'confirmed'; v_sstatus := 'scheduled';
          else                  v_status := 'reschedule_requested';
          end if;
        end if;

        continue when v_status is null;

        -- Pilih klien: tidak bentrok dengan booking aktif/terkonfirmasi miliknya, dan untuk
        -- booking mendatang yang aktif maksimal 2 per klien (aturan sicare_create_booking).
        select c.* into v_client from tmp_dummy_clients c
        where not exists (
          select 1 from public.bookings b
          where b.client_id = c.user_id
            and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
            and b.starts_at < v_ends and b.ends_at > v_starts)
          and (v_ends < v_now
               or v_status not in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
               or (select count(*) from public.bookings b
                   where b.client_id = c.user_id
                     and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
                     and b.ends_at > v_now) < 2)
        order by random() limit 1;

        continue when not found;

        v_is_group := random() < 0.2;
        v_pcount := case when v_is_group then 3 + (random() < 0.5)::int else 1 end;
        v_created := least(v_starts - make_interval(days => 2 + floor(random() * 6)::int), v_now - interval '1 hour');
        v_format := case when random() < 0.65 then 'offline' else 'online' end;

        insert into public.bookings (
          client_id, counselor_id, availability_slot_id, service_type, group_name, participant_count,
          starts_at, ends_at, status, cancellation_reason, reschedule_reason, expired_at, expired_reason,
          created_at, updated_at
        ) values (
          v_client.user_id, v_counselor.id, v_slot_id,
          case when v_is_group then 'group' else 'individual' end,
          case when v_is_group then 'Kelompok ' || v_client.study_program else null end,
          v_pcount, v_starts, v_ends, v_status,
          case v_status
            when 'cancelled' then c_cancel[1 + floor(random() * 3)::int]
            when 'rejected' then 'Konselor berhalangan pada jadwal tersebut.'
          end,
          case when v_status = 'reschedule_requested' then 'Ada agenda mendadak; mohon pilih jadwal pengganti.' end,
          case when v_status = 'expired' then v_starts end,
          case when v_status = 'expired' then 'not_confirmed' end,
          v_created, least(v_created + interval '1 day', v_now)
        ) returning id into v_booking_id;
        v_n_bookings := v_n_bookings + 1;

        -- Peserta utama (klien pemesan) dengan identitas lengkap.
        insert into public.booking_participants (
          booking_id, user_id, display_name, full_name, is_representative, is_primary,
          participant_type, participant_status, faculty, study_program, nim, birthplace,
          date_of_birth, gender, phone_e164, religion, education, address, created_at
        ) values (
          v_booking_id, v_client.user_id, v_client.full_name, v_client.full_name, true, true,
          'primary_client', 'registered', v_client.faculty, v_client.study_program, v_client.nim,
          v_client.birthplace, v_client.dob, v_client.gender_id, v_client.phone, v_client.religion,
          'S1 (sedang menempuh)', v_client.address, v_created
        );

        -- Anggota kelompok (tamu).
        if v_is_group then
          for v_i in 1 .. v_pcount - 1 loop
            insert into public.booking_participants (
              booking_id, display_name, full_name, is_representative, is_primary,
              participant_type, participant_status, created_at
            ) values (
              v_booking_id, c_guests[1 + ((v_n_bookings + v_i) % array_length(c_guests, 1))],
              c_guests[1 + ((v_n_bookings + v_i) % array_length(c_guests, 1))],
              false, false, 'guest_member', 'registered', v_created
            );
          end loop;
        end if;

        -- Intake (format clientIntakeAnswersSchema di be/src/validators/booking.validator.js).
        insert into public.booking_intakes (booking_id, client_id, answers, created_at)
        values (v_booking_id, v_client.user_id, jsonb_build_object(
          'selfHarm', 'Tidak',
          'distress', (array['Ya','Mungkin','Tidak'])[1 + floor(random() * 3)::int],
          'abuse', 'Tidak',
          'substance', 'Tidak',
          'sleep', 2 + floor(random() * 4)::int,
          'finance', 2 + floor(random() * 4)::int,
          'topics', jsonb_build_array(c_topics[1 + floor(random() * 8)::int]),
          'other', '',
          'complaint', '[DUMMY] Sulit fokus mengikuti perkuliahan beberapa minggu terakhir.',
          'history', '[DUMMY] Mulai dirasakan sejak awal semester.',
          'reason', '[DUMMY] Ingin mendapat pandangan dan cara mengatasi.',
          'efforts', '[DUMMY] Sudah mencoba membuat jadwal belajar.',
          'goal', '[DUMMY] Lebih teratur dan tenang menjalani kuliah.',
          'strengths', '[DUMMY] Mau belajar dan terbuka pada masukan.',
          'weaknesses', '[DUMMY] Mudah menunda pekerjaan.'
        ), v_created);

        -- Notifikasi in-app.
        insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
        values (v_counselor.id, 'booking.created', 'Permintaan konseling baru',
                'Ada permintaan konseling yang perlu ditinjau.', 'booking', v_booking_id, v_created,
                case when v_status <> 'waiting_confirmation' then v_created + interval '2 hours' end);

        insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at, read_at)
        values (
          v_client.user_id,
          case v_status
            when 'waiting_confirmation' then 'booking.submitted'
            when 'confirmed' then 'booking.confirmed'
            when 'rejected' then 'booking.rejected'
            when 'cancelled' then 'booking.cancelled'
            when 'expired' then 'booking.expired'
            else 'booking.reschedule_requested'
          end,
          case v_status
            when 'waiting_confirmation' then 'Permintaan konseling terkirim'
            when 'confirmed' then 'Konseling dikonfirmasi'
            when 'rejected' then 'Permintaan konseling ditolak'
            when 'cancelled' then 'Booking dibatalkan'
            when 'expired' then 'Permintaan konseling kedaluwarsa'
            else 'Penjadwalan ulang diminta'
          end,
          case v_status
            when 'waiting_confirmation' then 'Permintaan konseling menunggu konfirmasi konselor.'
            when 'confirmed' then 'Permintaan konseling diterima. Periksa detail sesi.'
            when 'rejected' then 'Permintaan konseling tidak dapat diterima.'
            when 'cancelled' then 'Booking konseling telah dibatalkan.'
            when 'expired' then 'Permintaanmu tidak sempat dikonfirmasi konselor sampai jadwalnya tiba.'
            else 'Konselor meminta penjadwalan ulang. Pilih slot pengganti pada detail booking.'
          end,
          'booking', v_booking_id, least(v_created + interval '1 day', v_now),
          case when v_ends < v_now then least(v_created + interval '1 day', v_now) end
        );

        continue when v_sstatus is null;

        -- Sesi konseling.
        insert into public.counseling_sessions (
          booking_id, counselor_id, starts_at, ends_at, status, format, room,
          started_at, completed_at, missed_reason, missed_at, created_at
        ) values (
          v_booking_id, v_counselor.id, v_starts, v_ends, v_sstatus, v_format,
          case when v_format = 'offline' then 'Ruang Konseling LMI ' || (1 + v_ci % 2)
               else 'https://meet.google.com/dummy-sicare' end,
          case when v_sstatus = 'completed' then v_starts + interval '3 minutes' end,
          case when v_sstatus = 'completed' then v_ends - interval '5 minutes' end,
          v_missed,
          case when v_sstatus = 'missed' then v_ends + interval '30 minutes' end,
          least(v_created + interval '1 day', v_now)
        ) returning id into v_session_id;
        v_n_sessions := v_n_sessions + 1;

        -- Informed consent per peserta. completed / missed(not_started) => signed;
        -- missed(consent_unsigned) => pending; scheduled => 60% signed; cancelled => tidak ada.
        if v_sstatus <> 'cancelled' then
          v_signed := case
            when v_sstatus = 'completed' then true
            when v_sstatus = 'missed' then v_missed = 'not_started'
            else random() < 0.6
          end;

          for v_part in
            select * from public.booking_participants where booking_id = v_booking_id order by is_primary desc
          loop
            insert into public.informed_consents (
              booking_id, session_id, booking_participant_id, consent_template_id, status,
              signer_user_id, signer_name_snapshot, identity_snapshot, viewed_at, signed_at,
              signature_method, created_at
            ) values (
              v_booking_id, v_session_id, v_part.id, v_template,
              case when v_signed then 'signed' else 'pending' end,
              case when v_signed then v_part.user_id end,
              case when v_signed then v_part.full_name end,
              case when v_signed then jsonb_strip_nulls(jsonb_build_object(
                'full_name', v_part.full_name, 'nim', v_part.nim, 'faculty', v_part.faculty,
                'study_program', v_part.study_program, 'gender', v_part.gender))
              else '{}'::jsonb end,
              case when v_signed then least(v_created + interval '1 day', v_now) end,
              case when v_signed then least(v_created + interval '1 day 1 hour', v_now) end,
              case when v_signed then 'electronic_canvas' end,
              least(v_created + interval '1 day', v_now)
            );
          end loop;
        end if;

        if v_sstatus = 'completed' then
          insert into public.session_notes (session_id, counselor_id, counselor_note, client_note, follow_up, created_at)
          values (
            v_session_id, v_counselor.id,
            '[DUMMY] Catatan konselor untuk pengujian. Bukan data klinis nyata.',
            '[DUMMY] Klien diajak menyusun jadwal belajar mingguan dan teknik relaksasi sederhana.',
            '[DUMMY] Evaluasi progres pada sesi berikutnya bila diperlukan.',
            v_ends
          );

          if random() < 0.7 then
            v_rating := case when random() < 0.15 then 3 when random() < 0.5 then 4 else 5 end;
            v_mod := case when random() < 0.5 then 'shown' when random() < 0.8 then 'pending' else 'disabled' end;
            insert into public.feedback (
              session_id, client_id, counselor_id, rating, comment, moderation_status,
              review_status, disabled_reason, created_at
            ) values (
              v_session_id, v_client.user_id, v_counselor.id, v_rating,
              c_comment[1 + floor(random() * array_length(c_comment, 1))::int], v_mod,
              case when v_mod = 'pending' then 'new' when random() < 0.5 then 'reviewed' else 'resolved' end,
              case when v_mod = 'disabled' then 'Data dummy: contoh feedback yang dinonaktifkan.' end,
              least(v_ends + interval '3 hours', v_now)
            );
          end if;

          insert into public.notifications (recipient_user_id, type, title, body, entity_type, entity_id, created_at)
          values (v_client.user_id, 'session.completed', 'Sesi konseling selesai',
                  'Sesi konseling selesai. Kamu dapat memberikan feedback.', 'session', v_session_id,
                  least(v_ends, v_now));
        end if;
      end loop;
    end loop;
  end loop;

  raise notice 'Selesai: % konselor, % slot, % booking, % sesi, % klien dummy.',
    v_ci, v_n_slots, v_n_bookings, v_n_sessions, array_length(c_names, 1);
end;
$$;

commit;

-- Ringkasan hasil:
-- select status, count(*) from public.bookings group by 1 order by 1;
-- select status, missed_reason, count(*) from public.counseling_sessions group by 1, 2 order by 1, 2;
-- select status, count(*) from public.informed_consents group by 1;
-- select u.email, p.identity_code, p.full_name from auth.users u join public.profiles p on p.id = u.id
--   where u.email like '%@sicare-dummy.test' order by u.email;
--
-- Opsional — hapus akun klien dummy SETELAH reset-transactional-data.sql (booking mereferensikan
-- profil dengan ON DELETE RESTRICT, jadi data transaksinya harus sudah bersih):
-- delete from auth.users where email like '%@sicare-dummy.test';
