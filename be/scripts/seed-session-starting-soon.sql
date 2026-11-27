-- SiCARE: SESI MULAI 2 MENIT LAGI (giovana@unikadelasalle.ac.id dengan 24013037) untuk uji
-- tombol "Mulai Sesi" dan alur berikutnya. Snippet TERPISAH dari Seed Dummy; tidak mensyaratkan
-- tabel bookings kosong. Simpan di Supabase Dashboard -> SQL Editor (project NON-PRODUKSI).
-- Bukan migrasi. Tidak membuat atau mengubah akun. Berlaku di hari apa pun, termasuk hari libur
-- (database tidak memeriksa hari kerja).
--
-- Yang dibuat: 1 slot + 1 booking individu 'confirmed' + peserta + intake [DUMMY] + sesi 'scheduled'
-- (mulai c_starts_in_minutes menit setelah skrip dijalankan, durasi c_duration_minutes menit)
-- + informed consent berstatus 'pending' (belum ditandatangani) + notifikasi booking.created,
-- booking.submitted, booking.confirmed.
-- Tidak membuat whatsapp_outbox.
--
-- Catatan:
--   - Consent TIDAK diisi otomatis (c_consent_signed = false): dibuat berstatus 'pending', sehingga
--     klien perlu menandatanganinya di aplikasi. Tombol "Mulai Sesi" aktif 15 menit sebelum jam
--     mulai sampai jam selesai, dan hanya setelah consent ditandatangani. Set true bila ingin
--     consent langsung lengkap.
--   - Bila tidak dimulai, sesi ditandai 'missed' oleh worker 30 menit setelah jam selesai
--     (alasan 'consent_unsigned' bila consent masih belum ditandatangani).
--   - Skrip menolak berjalan bila konselor sudah punya slot, atau klien sudah punya booking aktif,
--     yang bentrok dengan jam sesi ini.
--   - Bersama 2 sesi terjadwal dari Seed Dummy, 24013037 akan memiliki 3 booking aktif; aplikasi
--     membatasi 2 booking aktif per klien, jadi akun ini tidak bisa memesan baru sampai salah
--     satunya selesai/dibatalkan.
--   - Untuk membersihkan: jalankan snippet Reset Dummy.
--   - Tahan terhadap skema lama: counseling_sessions.format, informed_consents.consent_template_id,
--     dan academic_periods.is_published diisi bila kolomnya masih ada.

begin;

do $$
declare
  c_client_email    constant text := '24013037@unikadelasalle.ac.id';
  c_counselor_email constant text := 'giovana@unikadelasalle.ac.id';
  c_starts_in_minutes  constant int := 2;
  c_duration_minutes   constant int := 60;
  c_consent_signed     constant boolean := false;
  c_room            constant text := 'Ruang Konseling LMI';
  -- Harus sama dengan OFFICIAL_TEMPLATE_VERSION di be/src/services/consentPdf.service.js
  c_consent_version constant text := 'v1.0';

  v_now        timestamptz := now();
  v_today      date := (now() at time zone 'Asia/Makassar')::date;
  v_year       int := extract(year from (now() at time zone 'Asia/Makassar'))::int;
  v_month      int := extract(month from (now() at time zone 'Asia/Makassar'))::int;
  v_acad_year  text;
  v_semester   text;
  v_p_start    date;
  v_p_end      date;
  v_period     public.academic_periods%rowtype;

  v_has_template_col boolean;
  v_has_format_col   boolean;
  v_has_publish_col  boolean;
  v_has_intakes boolean := to_regclass('public.booking_intakes') is not null;
  v_template_id uuid;
  v_version    text := c_consent_version;

  v_client     record;
  v_counselor  uuid;
  v_starts     timestamptz;
  v_ends       timestamptz;
  v_created    timestamptz;
  v_confirmed  timestamptz;
  v_slot_id    uuid;
  v_booking_id uuid;
  v_session_id uuid;
  v_part_id    uuid;
  v_identity   jsonb;
  v_active     int;
begin
  if c_starts_in_minutes < 0 or c_duration_minutes <= 0 then
    raise exception 'c_starts_in_minutes harus >= 0 dan c_duration_minutes > 0.';
  end if;

  -- ------------------------------------------------------------------ skema
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'counseling_sessions' and column_name = 'format')
  into v_has_format_col;
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'informed_consents' and column_name = 'consent_template_id')
  into v_has_template_col;
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_periods' and column_name = 'is_published')
  into v_has_publish_col;

  if v_has_template_col then
    execute 'select id, version from public.consent_templates
             where template_code = $1 and is_active = true limit 1'
      into v_template_id, v_version using 'SICARE_IC_STD';
    if v_template_id is null then
      raise exception 'Template consent aktif SICARE_IC_STD tidak ditemukan.';
    end if;
  end if;

  -- ------------------------------------------------------------------ akun
  select p.id into v_counselor
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(c_counselor_email)
    and p.app_role = 'counselor' and p.account_status = 'active';
  if v_counselor is null then
    raise exception 'Konselor aktif % tidak ditemukan.', c_counselor_email;
  end if;

  select p.id as user_id, p.full_name, p.identity_code as nim, p.phone_e164 as phone,
         coalesce(p.member_category, 'other') as category,
         case p.gender when 'male' then 'Laki-laki' when 'female' then 'Perempuan' end as gender_id
  into v_client
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(c_client_email)
    and p.app_role = 'client' and p.account_status = 'active';
  if v_client.user_id is null then
    raise exception 'Klien aktif % tidak ditemukan.', c_client_email;
  end if;

  -- ------------------------------------------------------------------ waktu & bentrok
  v_starts := date_trunc('minute', v_now) + make_interval(mins => c_starts_in_minutes);
  v_ends := v_starts + make_interval(mins => c_duration_minutes);
  v_created := v_now - interval '3 days';
  v_confirmed := v_now - interval '2 days';

  if exists (
    select 1 from public.availability_slots s
    where s.counselor_id = v_counselor and s.status = 'available'
      and s.starts_at < v_ends and s.ends_at > v_starts
  ) then
    raise exception 'Konselor % sudah punya slot yang bentrok dengan % s.d. % WITA. Jalankan Reset Dummy atau ubah c_starts_in_minutes.',
      c_counselor_email,
      to_char(v_starts at time zone 'Asia/Makassar', 'YYYY-MM-DD HH24:MI'),
      to_char(v_ends at time zone 'Asia/Makassar', 'HH24:MI');
  end if;

  if exists (
    select 1 from public.bookings b
    where b.client_id = v_client.user_id
      and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
      and b.starts_at < v_ends and b.ends_at > v_starts
  ) then
    raise exception 'Klien % sudah punya booking aktif yang bentrok dengan jam ini.', c_client_email;
  end if;

  select count(*) into v_active from public.bookings b
  where b.client_id = v_client.user_id
    and b.status in ('waiting_confirmation', 'confirmed', 'reschedule_requested')
    and b.ends_at > v_now;
  if v_active >= 2 then
    raise notice 'Klien % sudah punya % booking aktif; setelah skrip ini batas 2 booking aktif terlampaui.',
      c_client_email, v_active;
  end if;

  -- ------------------------------------------------------------------ periode hari ini
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

  -- ------------------------------------------------------------------ data
  insert into public.availability_slots (counselor_id, academic_period_id, starts_at, ends_at, status, created_at)
  values (v_counselor, v_period.id, v_starts, v_ends, 'available', v_created - interval '1 day')
  returning id into v_slot_id;

  insert into public.bookings (
    client_id, counselor_id, availability_slot_id, service_type, participant_count,
    starts_at, ends_at, status, created_at, updated_at
  ) values (
    v_client.user_id, v_counselor, v_slot_id, 'individual', 1,
    v_starts, v_ends, 'confirmed', v_created, v_confirmed
  ) returning id into v_booking_id;

  insert into public.booking_participants (
    booking_id, user_id, display_name, full_name, is_representative, is_primary,
    participant_type, participant_status, nim, gender, phone_e164, created_at
  ) values (
    v_booking_id, v_client.user_id, v_client.full_name, v_client.full_name, true, true,
    'primary_client', 'registered', v_client.nim, v_client.gender_id, v_client.phone, v_created
  ) returning id into v_part_id;

  if v_has_intakes then
    insert into public.booking_intakes (booking_id, client_id, answers, created_at)
    values (v_booking_id, v_client.user_id, jsonb_build_object(
      'selfHarm', 'Tidak', 'distress', 'Mungkin', 'abuse', 'Tidak', 'substance', 'Tidak',
      'sleep', 3, 'finance', 4,
      'topics', jsonb_build_array(case when v_client.category = 'student'
        then 'Motivasi' else 'Karir, pendidikan, dan pekerjaan' end),
      'other', '',
      'complaint', '[DUMMY] Sulit membagi waktu beberapa minggu terakhir.',
      'history', '[DUMMY] Mulai dirasakan sejak awal semester.',
      'reason', '[DUMMY] Ingin mendapat pandangan dan cara mengatasi.',
      'efforts', '[DUMMY] Sudah mencoba membuat jadwal harian.',
      'goal', '[DUMMY] Lebih teratur dan tenang.',
      'strengths', '[DUMMY] Mau belajar dan terbuka pada masukan.',
      'weaknesses', '[DUMMY] Mudah menunda pekerjaan.'
    ), v_created);
  end if;

  if v_has_format_col then
    execute 'insert into public.counseling_sessions (
               booking_id, counselor_id, starts_at, ends_at, status, format, room, created_at, updated_at
             ) values ($1, $2, $3, $4, ''scheduled'', ''offline'', $5, $6, $6)
             returning id'
      into v_session_id
      using v_booking_id, v_counselor, v_starts, v_ends, c_room, v_confirmed;
  else
    insert into public.counseling_sessions (
      booking_id, counselor_id, starts_at, ends_at, status, room, created_at, updated_at
    ) values (
      v_booking_id, v_counselor, v_starts, v_ends, 'scheduled', c_room, v_confirmed, v_confirmed
    ) returning id into v_session_id;
  end if;

  v_identity := case when c_consent_signed then jsonb_strip_nulls(jsonb_build_object(
    'full_name', v_client.full_name, 'nim', v_client.nim, 'gender', v_client.gender_id))
    else '{}'::jsonb end;

  if v_has_template_col then
    execute 'insert into public.informed_consents (
               booking_id, session_id, booking_participant_id, consent_template_id,
               consent_statement_version, status, signer_user_id, signer_name_snapshot,
               identity_snapshot, viewed_at, signed_at, signature_method, created_at
             ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)'
      using v_booking_id, v_session_id, v_part_id, v_template_id, v_version,
            case when c_consent_signed then 'signed' else 'pending' end,
            case when c_consent_signed then v_client.user_id end,
            case when c_consent_signed then v_client.full_name end,
            v_identity,
            case when c_consent_signed then v_confirmed + interval '2 minutes' end,
            case when c_consent_signed then v_confirmed + interval '5 minutes' end,
            case when c_consent_signed then 'electronic_canvas' end,
            v_confirmed;
  else
    insert into public.informed_consents (
      booking_id, session_id, booking_participant_id, consent_statement_version, status,
      signer_user_id, signer_name_snapshot, identity_snapshot, viewed_at, signed_at,
      signature_method, created_at
    ) values (
      v_booking_id, v_session_id, v_part_id, v_version,
      case when c_consent_signed then 'signed' else 'pending' end,
      case when c_consent_signed then v_client.user_id end,
      case when c_consent_signed then v_client.full_name end,
      v_identity,
      case when c_consent_signed then v_confirmed + interval '2 minutes' end,
      case when c_consent_signed then v_confirmed + interval '5 minutes' end,
      case when c_consent_signed then 'electronic_canvas' end,
      v_confirmed
    );
  end if;

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
     null);

  raise notice 'Sesi terjadwal dibuat: % dengan % pada % s.d. % WITA (consent %). Mulai Sesi bisa ditekan sampai % WITA; bila tidak dimulai, ditandai terlewat sekitar % WITA.',
    c_client_email, c_counselor_email,
    to_char(v_starts at time zone 'Asia/Makassar', 'YYYY-MM-DD HH24:MI'),
    to_char(v_ends at time zone 'Asia/Makassar', 'HH24:MI'),
    case when c_consent_signed then 'lengkap' else 'belum ditandatangani' end,
    to_char(v_ends at time zone 'Asia/Makassar', 'HH24:MI'),
    to_char((v_ends + interval '30 minutes') at time zone 'Asia/Makassar', 'HH24:MI');
end;
$$;

commit;

-- Cek hasil:
-- select s.status, s.starts_at at time zone 'Asia/Makassar' as mulai_wita,
--        s.ends_at at time zone 'Asia/Makassar' as selesai_wita, uc.email as klien
-- from public.counseling_sessions s
-- join public.bookings b on b.id = s.booking_id
-- join auth.users uc on uc.id = b.client_id
-- where s.status = 'scheduled' and s.starts_at > now() - interval '1 hour'
-- order by s.starts_at;
