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
      "Supabase belum dikonfigurasi pada backend.",
    );
  return getSupabaseAdminClient();
};

export const adminAccountsService = {
  async listAccounts(filters) {
    let query = supa()
      .from("profiles")
      .select(
        "id,identity_code,full_name,app_role,member_category,account_status,phone_e164,gender,siap_number,sipp_silp_number,sipp_silp_valid_until,sipp_silp_updated_at,whatsapp_opt_in,created_at,updated_at",
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

    const ids = (data ?? []).map((p) => p.id);
    const emails = new Map();
    for (const id of ids) {
      const { data: authUser, error: authError } = await supa().auth.admin.getUserById(id);
      if (!authError && authUser?.user) emails.set(id, authUser.user.email ?? null);
    }

    return (data ?? []).map((p) => ({ ...p, email: emails.get(p.id) ?? null }));
  },

  async getAccount(id) {
    const { data, error } = await supa()
      .from("profiles")
      .select(
        "id,identity_code,full_name,app_role,member_category,account_status,phone_e164,gender,siap_number,sipp_silp_number,sipp_silp_valid_until,sipp_silp_updated_at,whatsapp_opt_in,created_at,updated_at",
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

    const profilePatch = {
      full_name: input.full_name,
      identity_code: input.identity_code ?? null,
      member_category: input.member_category ?? null,
      app_role: input.app_role,
      account_status: input.account_status,
      gender: input.gender ?? null,
      siap_number: input.app_role === "counselor" ? input.siap_number : null,
      sipp_silp_number: input.app_role === "counselor" ? input.sipp_silp_number : null,
      sipp_silp_valid_until:
        input.app_role === "counselor" ? (input.sipp_silp_valid_until ?? null) : null,
    };

    const { data, error } = await supa()
      .from("profiles")
      .update(profilePatch)
      .eq("id", created.user.id)
      .select(
        "id,identity_code,full_name,app_role,member_category,account_status,phone_e164,gender,siap_number,sipp_silp_number,sipp_silp_valid_until,sipp_silp_updated_at,created_at,updated_at",
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

    await writeAudit({
      actorUserId,
      action: "admin.account.create",
      entityType: "profile",
      entityId: data.id,
      metadata: { role: input.app_role, status: input.account_status },
    });

    return { ...data, email: created.user.email ?? input.email };
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

    // Akun konselor lama boleh belum lengkap (mis. saat hanya mengubah status), tetapi
    // menjadi konselor atau mengubah data ini harus menghasilkan data yang lengkap.
    const finalRole = input.app_role ?? current.app_role;
    const touchesCounselorData = ["gender", "siap_number", "sipp_silp_number"].some(
      (field) => input[field] !== undefined,
    );
    if (finalRole === "counselor" && (current.app_role !== "counselor" || touchesCounselorData)) {
      const merged = { ...current, ...input };
      if (!merged.gender || !merged.siap_number || !merged.sipp_silp_number) {
        throw new HttpError(
          400,
          "COUNSELOR_DATA_REQUIRED",
          "Jenis kelamin, No. SIAP, dan No. SIPP/SILP wajib diisi untuk akun konselor.",
        );
      }
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

    const { data, error } = await supa()
      .from("profiles")
      .update(input)
      .eq("id", id)
      .select(
        "id,identity_code,full_name,app_role,member_category,account_status,phone_e164,gender,siap_number,sipp_silp_number,sipp_silp_valid_until,sipp_silp_updated_at,whatsapp_opt_in,created_at,updated_at",
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
    return { ...data, cancelled_bookings: closed.cancelled, ongoing_bookings_kept: closed.skipped, booking_cleanup_failed: closed.failed };
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

