// @ts-check
import { getSupabaseAdminClient, isSupabaseConfigured } from "../../config/supabase.js";
import { env } from "../../config/env.js";
import { HttpError, parseBody, sendData, supabaseError } from "../../lib/http.js";
import { writeAudit } from "../../lib/audit.js";
import {
  initPasswordSchema,
  verifyPasswordSchema,
  changePasswordSchema,
} from "../../validators/counselor.validator.js";
import {
  checkRateLimit,
  comparePassword,
  createHistoryGrantToken,
  hashPassword,
  recordFailedAttempt,
  resetFailedAttempts,
  verifyHistoryGrantToken,
} from "../../services/counselorCredential.service.js";

const supa = () => {
  if (!isSupabaseConfigured())
    throw new HttpError(
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Supabase belum dikonfigurasi pada server."
    );
  return getSupabaseAdminClient();
};

// Foto klien disimpan sebagai path bucket `avatars` di user_metadata.avatar_url
// (lihat POST /profile/photo); URL eksternal (mis. OAuth) diteruskan apa adanya.
const toAvatarPublicUrl = (value) => {
  if (typeof value !== "string" || !value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const baseUrl = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  if (!baseUrl) return null;
  const path = value.replace(/^avatars\//, "").replace(/^\/+/, "");
  return `${baseUrl}/storage/v1/object/public/avatars/${path}`;
};

const loadClientPhotoUrls = async (client, clientIds) => {
  const entries = await Promise.all(
    clientIds.map(async (id) => {
      try {
        const { data, error } = await client.auth.admin.getUserById(id);
        if (error) return [id, null];
        return [id, toAvatarPublicUrl(data?.user?.user_metadata?.avatar_url)];
      } catch {
        return [id, null];
      }
    })
  );
  return new Map(entries);
};

// Hash sandi riwayat disimpan di counselor_profiles.history_password_hash. Kolom ini tidak
// di-grant ke anon/authenticated (lihat migrasi 20261124120000) dan tidak boleh ikut dikirim
// ke client; hanya dibaca di sini lewat service_role.
const loadHistoryCredential = async (client, counselorId) => {
  const { data, error } = await client
    .from("counselor_profiles")
    .select("profile_id,history_password_hash")
    .eq("profile_id", counselorId)
    .maybeSingle();
  return { profile: data ?? null, hash: data?.history_password_hash ?? null, error };
};

const profileNotReady = () =>
  new HttpError(
    404,
    "COUNSELOR_PROFILE_NOT_FOUND",
    "Profil konselor belum disiapkan oleh admin. Kata sandi riwayat belum dapat diatur."
  );

export const counselorHistoryCredentialController = {
  async getPasswordStatus(req, res) {
    const { hash, error } = await loadHistoryCredential(supa(), req.auth.user.id);

    if (error) supabaseError(error, "Gagal memeriksa status sandi riwayat.");

    return sendData(res, { configured: Boolean(hash) });
  },

  async initPassword(req, res) {
    const input = parseBody(initPasswordSchema, req.body);
    const client = supa();

    const alreadyConfigured = () =>
      new HttpError(
        409,
        "CREDENTIAL_ALREADY_CONFIGURED",
        "Kata sandi riwayat sudah dikonfigurasi. Gunakan menu ganti kata sandi."
      );

    const existing = await loadHistoryCredential(client, req.auth.user.id);
    if (existing.error) supabaseError(existing.error, "Gagal memeriksa status sandi riwayat.");
    if (!existing.profile) throw profileNotReady();
    if (existing.hash) throw alreadyConfigured();

    const hash = await hashPassword(input.password);
    // Hanya mengisi bila masih kosong, sehingga dua permintaan init bersamaan tidak saling menimpa.
    const { data: saved, error: saveError } = await client
      .from("counselor_profiles")
      .update({ history_password_hash: hash, history_password_updated_at: new Date().toISOString() })
      .eq("profile_id", req.auth.user.id)
      .is("history_password_hash", null)
      .select("profile_id")
      .maybeSingle();

    if (saveError) supabaseError(saveError, "Gagal menyimpan kata sandi riwayat.");
    if (!saved) throw alreadyConfigured();
    resetFailedAttempts(req.auth.user.id);

    await writeAudit({
      actorUserId: req.auth.user.id,
      action: "counselor.history_password.init",
      entityType: "counselor_history_credential",
      entityId: req.auth.user.id,
      metadata: { role: "counselor" },
    });

    return sendData(
      res,
      { success: true, message: "Kata sandi riwayat berhasil dikonfigurasi." },
      201
    );
  },

  async verifyPassword(req, res) {
    checkRateLimit(req.auth.user.id);
    const input = parseBody(verifyPasswordSchema, req.body);

    const { hash: storedHash, error } = await loadHistoryCredential(supa(), req.auth.user.id);

    if (error) supabaseError(error, "Gagal memverifikasi kata sandi riwayat.");
    if (!storedHash) {
      throw new HttpError(
        404,
        "CREDENTIAL_NOT_CONFIGURED",
        "Kata sandi riwayat belum dikonfigurasi."
      );
    }

    const valid = await comparePassword(input.password, storedHash);
    if (!valid) {
      const remaining = recordFailedAttempt(req.auth.user.id);
      throw new HttpError(
        401,
        "INVALID_CREDENTIALS",
        `Kata sandi riwayat salah. Sisa percobaan: ${remaining}`
      );
    }

    resetFailedAttempts(req.auth.user.id);
    const grant = createHistoryGrantToken(req.auth.user.id, 1800);

    await writeAudit({
      actorUserId: req.auth.user.id,
      action: "counselor.history_password.verify",
      entityType: "counselor_history_credential",
      entityId: req.auth.user.id,
      metadata: { role: "counselor" },
    });

    return sendData(res, { success: true, grant_token: grant.token, ...grant });
  },

  async changePassword(req, res) {
    const input = parseBody(changePasswordSchema, req.body);
    const client = supa();

    const { hash: storedHash, error } = await loadHistoryCredential(client, req.auth.user.id);

    if (error) supabaseError(error, "Gagal memverifikasi kata sandi riwayat.");
    if (!storedHash) {
      throw new HttpError(
        404,
        "CREDENTIAL_NOT_CONFIGURED",
        "Kata sandi riwayat belum dikonfigurasi. Silakan atur kata sandi terlebih dahulu."
      );
    }

    const valid = await comparePassword(input.current_password, storedHash);
    if (!valid) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Kata sandi riwayat saat ini salah.");
    }

    const newHash = await hashPassword(input.new_password);
    const { error: updateError } = await client
      .from("counselor_profiles")
      .update({ history_password_hash: newHash, history_password_updated_at: new Date().toISOString() })
      .eq("profile_id", req.auth.user.id);

    if (updateError) supabaseError(updateError, "Gagal memperbarui kata sandi riwayat.");
    resetFailedAttempts(req.auth.user.id);

    await writeAudit({
      actorUserId: req.auth.user.id,
      action: "counselor.history_password.change",
      entityType: "counselor_history_credential",
      entityId: req.auth.user.id,
      metadata: { role: "counselor" },
    });

    return sendData(res, { success: true, message: "Kata sandi riwayat berhasil diperbarui." });
  },

  async getHistory(req, res) {
    const client = supa();
    const { hash: storedHash, error: credError } = await loadHistoryCredential(client, req.auth.user.id);
    if (credError) supabaseError(credError, "Gagal memeriksa status sandi riwayat.");

    if (!storedHash) {
      return sendData(res, {
        configured: false,
        sessions: [],
        bookings: [],
        clients: [],
        message: "Kata sandi riwayat belum dikonfigurasi.",
      });
    }

    const grantToken = req.headers["x-counselor-history-grant"] || req.query.grant_token;
    if (!grantToken || !verifyHistoryGrantToken(String(grantToken), req.auth.user.id)) {
      throw new HttpError(
        403,
        "HISTORY_ACCESS_LOCKED",
        "Akses riwayat konseling terkunci. Masukkan kata sandi riwayat untuk membuka."
      );
    }

    // Penanda otomatis dijalankan cron worker tiap menit (internal/worker-run), tidak lagi
    // menahan respons daftar: tiap panggilan RPC menambah waktu tunggu halaman.
    const { data: sessions, error: sessionError } = await client
      .from("counseling_sessions")
      .select(
        "id,booking_id,counselor_id,starts_at,ends_at,status,room,started_at,completed_at,created_at,updated_at"
      )
      .eq("counselor_id", req.auth.user.id)
      .order("starts_at", { ascending: false })
      .limit(200);

    if (sessionError) supabaseError(sessionError, "Riwayat sesi tidak dapat dibaca.");

    const bookingIds = Array.from(
      new Set((sessions ?? []).map((s) => s.booking_id).filter(Boolean))
    );
    let bookings = [];
    if (bookingIds.length > 0) {
      const { data: bData, error: bError } = await client
        .from("bookings")
        .select(
          "id,client_id,counselor_id,service_type,group_name,participant_count,starts_at,ends_at,status,booking_participants(id,display_name,is_representative)"
        )
        .in("id", bookingIds);

      if (bError) supabaseError(bError, "Data booking riwayat tidak dapat dibaca.");
      bookings = bData ?? [];
    }

    const clientIds = Array.from(new Set(bookings.map((b) => b.client_id).filter(Boolean)));
    let clientProfiles = [];
    if (clientIds.length > 0) {
      const { data: pData, error: pError } = await client
        .from("profiles")
        .select("id,full_name,identity_code,phone_e164")
        .in("id", clientIds);

      if (pError) supabaseError(pError, "Data profil klien riwayat tidak dapat dibaca.");
      const photoUrls = await loadClientPhotoUrls(client, clientIds);
      clientProfiles = (pData ?? []).map((p) => ({
        ...p,
        photo_url: photoUrls.get(p.id) ?? null,
      }));
    }

    const sessionIds = (sessions ?? []).map((s) => s.id);
    let sessionNotes = [];
    if (sessionIds.length > 0) {
      const { data: nData, error: nError } = await client
        .from("session_notes")
        .select("session_id,counselor_note,client_note,follow_up")
        .eq("counselor_id", req.auth.user.id)
        .in("session_id", sessionIds);

      if (nError) supabaseError(nError, "Catatan sesi riwayat tidak dapat dibaca.");
      sessionNotes = nData ?? [];
    }

    await writeAudit({
      actorUserId: req.auth.user.id,
      action: "counselor.history.read",
      entityType: "counselor_history",
      entityId: req.auth.user.id,
      metadata: { role: "counselor", count: sessions?.length ?? 0 },
    });

    return sendData(res, {
      configured: true,
      sessions: sessions ?? [],
      bookings,
      clients: clientProfiles,
      session_notes: sessionNotes,
    });
  },
};
