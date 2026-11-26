// @ts-check
import { getSupabaseAdminClient, isSupabaseConfigured } from "../../config/supabase.js";
import { HttpError, supabaseError } from "../../lib/http.js";
import { writeAudit } from "../../lib/audit.js";
import { cancelActiveBookingsForProfile } from "../bookingClosure.service.js";

const COUNSELOR_UNAVAILABLE_REASON =
  "Konselor tidak lagi tersedia di SiCARE. Silakan buat booking baru dengan konselor lain.";
const CLIENT_INACTIVE_REASON = "Akun klien dinonaktifkan sehingga booking dibatalkan otomatis.";

/**
 * Cancels the active bookings of an account that can no longer take part, so they do not
 * hang without a counselor or client. Returns the number cancelled (0 when nothing applies).
 * @param {{ id: string, app_role: string, account_status: string }} before
 * @param {{ id: string, app_role: string, account_status: string }} after
 * @param {string} actorUserId
 */
async function closeBookingsAfterAccountChange(before, after, actorUserId) {
  try {
    return await cancelBookingsForAccount(before, after, actorUserId);
  } catch (error) {
    // The account change itself already succeeded; report the cleanup failure instead of 500.
    console.warn("[Admin] Pembatalan booking akun gagal:", error instanceof Error ? error.name : "Error");
    return { cancelled: 0, skipped: 0, failed: true };
  }
}

/** @param {any} before @param {any} after @param {string} actorUserId */
async function cancelBookingsForAccount(before, after, actorUserId) {
  let result = null;
  if (
    before.app_role === "counselor" &&
    (after.app_role !== "counselor" || after.account_status !== "active")
  ) {
    result = await cancelActiveBookingsForProfile({
      supabaseClient: supa(),
      profileId: after.id,
      side: "counselor",
      reason: COUNSELOR_UNAVAILABLE_REASON,
      actorUserId,
    });
  } else if (before.app_role === "client" && after.account_status !== "active") {
    result = await cancelActiveBookingsForProfile({
      supabaseClient: supa(),
      profileId: after.id,
      side: "client",
      reason: CLIENT_INACTIVE_REASON,
      actorUserId,
    });
  }
  if (!result) return { cancelled: 0, skipped: 0, failed: false };
  if (result.errors.length) {
    console.warn("[Admin] Pembatalan booking akun sebagian gagal:", result.errors.join(","));
  }
  return { cancelled: result.cancelled, skipped: result.skipped, failed: result.errors.length > 0 };
}

const supa = () => {
  if (!isSupabaseConfigured())
    throw new HttpError(
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Supabase belum dikonfigurasi pada server.",
    );
  return getSupabaseAdminClient();
};

/**
 * Hanya satu Kepala LMI aktif. Mengaktifkan `profileId` sekaligus menonaktifkan Kepala LMI
 * aktif lainnya secara atomik lewat RPC sicare_activate_head_lmi. Bila migrasinya belum
 * diterapkan, langkah yang sama dijalankan berurutan (nonaktifkan dulu, lalu aktifkan).
 * @param {string} profileId
 * @param {string} actorUserId
 * @returns {Promise<string[]>} ID Kepala LMI yang dinonaktifkan
 */
export async function activateHeadLmi(profileId, actorUserId, client = supa()) {
  let deactivated = [];
  const { data, error } = await client.rpc("sicare_activate_head_lmi", { p_profile_id: profileId });
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    deactivated = row?.deactivated_ids ?? [];
  } else if (error.code === "PGRST202" || error.code === "42883") {
    const { data: disabled, error: disableError } = await client
      .from("profiles")
      .update({ account_status: "disabled" })
      .eq("app_role", "head_lmi")
      .eq("account_status", "active")
      .neq("id", profileId)
      .select("id");
    if (disableError) supabaseError(disableError, "Kepala LMI aktif tidak dapat dinonaktifkan.");
    const { error: activateError } = await client
      .from("profiles")
      .update({ account_status: "active" })
      .eq("id", profileId)
      .eq("app_role", "head_lmi");
    if (activateError) supabaseError(activateError, "Akun Kepala LMI tidak dapat diaktifkan.");
    deactivated = (disabled ?? []).map((row) => row.id);
  } else {
    supabaseError(error, "Akun Kepala LMI tidak dapat diaktifkan.");
  }

  for (const id of deactivated) {
    await writeAudit({
      actorUserId,
      action: "admin.account.update",
      entityType: "profile",
      entityId: id,
      metadata: { role: "head_lmi", status: "disabled" },
    });
  }
  return deactivated;
}

export const adminAccountsService = {
  async listAccounts(filters) {
    let query = supa()
      .from("profiles")
      .select(
        "id,identity_code,full_name,app_role,member_category,account_status,phone_e164,gender,siap_number,sipp_silp_number,sipp_silp_updated_at,created_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(filters.limit);

    if (filters.role) query = query.eq("app_role", filters.role);
    if (filters.status) query = query.eq("account_status", filters.status);
    if (filters.search) {
      query = query.or(
        `full_name.ilike.%${filters.search.replace(/[^\p{L}\p{N}\s_-]/gu, " ")}%,identity_code.ilike.%${filters.search.replace(/[^\p{L}\p{N}\s_-]/gu, " ")}%`,
      );
    }

    const { data, error } = await query;
    if (error) supabaseError(error, "Daftar akun tidak dapat dibaca.");

    // Email dan status verifikasi email ada di Supabase Auth, bukan di profiles.
    // Diambil paralel (per 10) agar daftar akun tidak menunggu satu per satu.
    const ids = (data ?? []).map((p) => p.id);
    const authInfo = new Map();
    for (let start = 0; start < ids.length; start += 10) {
      await Promise.all(
        ids.slice(start, start + 10).map(async (id) => {
          const { data: authUser, error: authError } = await supa().auth.admin.getUserById(id);
          if (!authError && authUser?.user) {
            authInfo.set(id, {
              email: authUser.user.email ?? null,
              emailVerified: Boolean(authUser.user.email_confirmed_at || authUser.user.confirmed_at),
            });
          }
        }),
      );
    }

    return (data ?? []).map((p) => ({
      ...p,
      email: authInfo.get(p.id)?.email ?? null,
      // null bila data Auth tidak dapat dibaca (jangan dianggap belum terverifikasi).
      email_verified: authInfo.has(p.id) ? authInfo.get(p.id).emailVerified : null,
    }));
  },

  async getAccount(id) {
    const { data, error } = await supa()
      .from("profiles")
      .select(
        "id,identity_code,full_name,app_role,member_category,account_status,phone_e164,gender,siap_number,sipp_silp_number,sipp_silp_updated_at,created_at,updated_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (error) supabaseError(error, "Detail akun tidak dapat dibaca.");
    if (!data) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");

    const { data: authUser, error: authError } = await supa().auth.admin.getUserById(data.id);
    if (authError) {
      throw new HttpError(503, "AUTH_USER_LOOKUP_FAILED", "Email akun tidak dapat diverifikasi.");
    }

    return { ...data, email: authUser?.user?.email ?? null };
  },

  async createAccount(input, actorUserId) {
    const { data: created, error: createError } = await supa().auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });

    if (createError || !created?.user) {
      if (/already|exists/i.test(createError?.message ?? "")) {
        throw new HttpError(409, "ACCOUNT_EXISTS", "Email sudah terdaftar.");
      }
      throw new HttpError(
        400,
        "ACCOUNT_CREATE_FAILED",
        "Akun tidak dapat dibuat. Periksa konfigurasi Supabase Auth.",
      );
    }

    // Kepala LMI baru yang aktif diaktifkan lewat activateHeadLmi agar Kepala LMI lama nonaktif.
    const activatesHeadLmi = input.app_role === "head_lmi" && input.account_status === "active";
    const profilePatch = {
      full_name: input.full_name,
      identity_code: input.identity_code ?? null,
      member_category: input.member_category ?? null,
      app_role: input.app_role,
      account_status: activatesHeadLmi ? "disabled" : input.account_status,
      gender: input.gender ?? null,
    };

    const { data, error } = await supa()
      .from("profiles")
      .update(profilePatch)
      .eq("id", created.user.id)
      .select(
        "id,identity_code,full_name,app_role,member_category,account_status,phone_e164,gender,siap_number,sipp_silp_number,sipp_silp_updated_at,created_at,updated_at",
      )
      .single();

    if (error) {
      await supa().auth.admin.deleteUser(created.user.id);
      supabaseError(error, "Profil akun tidak dapat dibuat.");
    }

    if (input.app_role === "counselor") {
      const isCounselorActive = (input.account_status ?? "active") === "active";
      const { error: counselorError } = await supa()
        .from("counselor_profiles")
        .upsert(
          {
            profile_id: data.id,
            public_name: input.full_name,
            is_public: isCounselorActive,
          },
          { onConflict: "profile_id" },
        );
      if (counselorError) {
        await supa().auth.admin.deleteUser(created.user.id);
        supabaseError(counselorError, "Profil konselor tidak dapat disiapkan.");
      }
    }

    let deactivatedHeadLmi = [];
    if (activatesHeadLmi) {
      try {
        deactivatedHeadLmi = await activateHeadLmi(data.id, actorUserId);
        data.account_status = "active";
      } catch (activationError) {
        await supa().auth.admin.deleteUser(created.user.id);
        throw activationError;
      }
    }

    await writeAudit({
      actorUserId,
      action: "admin.account.create",
      entityType: "profile",
      entityId: data.id,
      metadata: { role: input.app_role, status: input.account_status },
    });

    return { ...data, email: created.user.email ?? input.email, deactivated_head_lmi: deactivatedHeadLmi.length };
  },

  async updateAccount(id, input, actorUserId) {
    if (!Object.keys(input).length) {
      throw new HttpError(400, "VALIDATION_ERROR", "Minimal satu field harus dikirim.");
    }
    if (
      id === actorUserId &&
      ((input.app_role && input.app_role !== "admin") ||
        (input.account_status && input.account_status !== "active"))
    ) {
      throw new HttpError(
        409,
        "SELF_ADMIN_CHANGE_BLOCKED",
        "Admin tidak dapat menurunkan role atau menonaktifkan akunnya sendiri.",
      );
    }

    const { data: current, error: currentError } = await supa()
      .from("profiles")
      .select("id,app_role,account_status,gender,siap_number,sipp_silp_number")
      .eq("id", id)
      .maybeSingle();

    if (currentError) supabaseError(currentError);
    if (!current) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");

    if (
      input.app_role &&
      !["counselor", "head_lmi"].includes(current.app_role)
    ) {
      throw new HttpError(
        400,
        "ROLE_CHANGE_NOT_ALLOWED",
        "Role akun ini tidak dapat diubah dari halaman admin.",
      );
    }

    // No. SIAP dan No. SIPP/SILP tidak lagi diwajibkan di sini: konselor mengisinya sendiri.
    const finalRole = input.app_role ?? current.app_role;
    if (finalRole === "counselor" && current.app_role !== "counselor" && !(input.gender ?? current.gender)) {
      throw new HttpError(400, "COUNSELOR_DATA_REQUIRED", "Jenis kelamin wajib diisi untuk akun konselor.");
    }

    const losingAdmin =
      current.app_role === "admin" &&
      current.account_status === "active" &&
      ((input.app_role && input.app_role !== "admin") ||
        (input.account_status && input.account_status !== "active"));

    if (losingAdmin) {
      const { count, error: countError } = await supa()
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("app_role", "admin")
        .eq("account_status", "active");
      if (countError) supabaseError(countError);
      if ((count ?? 0) <= 1) {
        throw new HttpError(
          409,
          "LAST_ADMIN",
          "Tidak dapat menonaktifkan atau menurunkan role admin aktif terakhir.",
        );
      }
    }

    // Mengaktifkan Kepala LMI menonaktifkan Kepala LMI yang sedang aktif.
    let deactivatedHeadLmi = [];
    const activatesHeadLmi =
      finalRole === "head_lmi" && input.account_status === "active" && current.account_status !== "active";
    if (activatesHeadLmi) {
      deactivatedHeadLmi = await activateHeadLmi(id, actorUserId);
    }

    const { data, error } = await supa()
      .from("profiles")
      .update(input)
      .eq("id", id)
      .select(
        "id,identity_code,full_name,app_role,member_category,account_status,phone_e164,gender,siap_number,sipp_silp_number,sipp_silp_updated_at,created_at,updated_at",
      )
      .maybeSingle();

    if (error) supabaseError(error, "Akun tidak dapat diperbarui.");
    if (!data) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");

    if (input.app_role === "counselor" || current.app_role === "counselor") {
      if (data.app_role === "counselor") {
        const isCounselorActive = data.account_status === "active";
        const { error: counselorError } = await supa()
          .from("counselor_profiles")
          .upsert(
            {
              profile_id: data.id,
              public_name: data.full_name,
              is_public: isCounselorActive,
            },
            { onConflict: "profile_id", ignoreDuplicates: true },
          );
        if (counselorError) supabaseError(counselorError, "Profil konselor tidak dapat disiapkan.");
        // Mengaktifkan kembali akun yang dinonaktifkan tidak otomatis menampilkan profil di
        // halaman publik (admin mungkin sengaja menyembunyikannya); gunakan pengaturan publikasi.
        const reactivated = current.app_role === "counselor" && current.account_status === "disabled";
        if (!isCounselorActive || !reactivated) {
          const { error: hideError } = await supa()
            .from("counselor_profiles")
            .update({ is_public: isCounselorActive })
            .eq("profile_id", data.id);
          if (hideError) supabaseError(hideError, "Status profil konselor tidak dapat diperbarui.");
        }
      } else {
        const { error: hideError } = await supa()
          .from("counselor_profiles")
          .update({ is_public: false })
          .eq("profile_id", data.id);
        if (hideError) supabaseError(hideError, "Publikasi profil konselor tidak dapat dihentikan.");
      }
    }

    await writeAudit({
      actorUserId,
      action: "admin.account.update",
      entityType: "profile",
      entityId: data.id,
      metadata: { role: data.app_role, status: data.account_status },
    });

    const closed = await closeBookingsAfterAccountChange(current, data, actorUserId);
    return {
      ...data,
      cancelled_bookings: closed.cancelled,
      ongoing_bookings_kept: closed.skipped,
      booking_cleanup_failed: closed.failed,
      deactivated_head_lmi: deactivatedHeadLmi.length,
    };
  },

  async deactivateAccount(id, actorUserId) {
    if (id === actorUserId) {
      throw new HttpError(
        409,
        "SELF_ADMIN_CHANGE_BLOCKED",
        "Admin tidak dapat menonaktifkan akunnya sendiri.",
      );
    }

    const { data: current, error: currentError } = await supa()
      .from("profiles")
      .select("id,app_role,account_status")
      .eq("id", id)
      .maybeSingle();

    if (currentError) supabaseError(currentError);
    if (!current) throw new HttpError(404, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");

    if (current.app_role === "admin" && current.account_status === "active") {
      const { count, error } = await supa()
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("app_role", "admin")
        .eq("account_status", "active");
      if (error) supabaseError(error);
      if ((count ?? 0) <= 1) {
        throw new HttpError(
          409,
          "LAST_ADMIN",
          "Tidak dapat menonaktifkan admin aktif terakhir.",
        );
      }
    }

    const { data, error } = await supa()
      .from("profiles")
      .update({ account_status: "disabled" })
      .eq("id", id)
      .select("id,app_role,account_status")
      .single();

    if (error) supabaseError(error, "Akun tidak dapat dinonaktifkan.");

    if (data.app_role === "counselor") {
      const { error: hideError } = await supa()
        .from("counselor_profiles")
        .update({ is_public: false })
        .eq("profile_id", data.id);
      if (hideError) {
        supabaseError(
          hideError,
          "Akun dinonaktifkan tetapi publikasi konselor gagal dihentikan.",
        );
      }
    }

    await writeAudit({
      actorUserId,
      action: "admin.account.update",
      entityType: "profile",
      entityId: data.id,
      metadata: { role: data.app_role, status: "disabled" },
    });

    const closed = await closeBookingsAfterAccountChange(current, data, actorUserId);
    return { ...data, cancelled_bookings: closed.cancelled, ongoing_bookings_kept: closed.skipped, booking_cleanup_failed: closed.failed };
  },

  async setCounselorPublication(counselorId, isPublic, actorUserId) {
    const { data, error } = await supa()
      .from("counselor_profiles")
      .update({ is_public: isPublic })
      .eq("profile_id", counselorId)
      .select("profile_id,public_name,is_public")
      .maybeSingle();

    if (error) supabaseError(error, "Publikasi profil konselor tidak dapat diperbarui.");
    if (!data) throw new HttpError(404, "COUNSELOR_NOT_FOUND", "Profil konselor tidak ditemukan.");

    await writeAudit({
      actorUserId,
      action: "admin.counselor.publication",
      entityType: "counselor_profile",
      entityId: counselorId,
      metadata: { is_public: isPublic },
    });

    return data;
  },
};

