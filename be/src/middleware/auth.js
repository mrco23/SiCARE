import { getSupabaseAdminClient, isSupabaseConfigured } from "../config/supabase.js";
import { asyncHandler, HttpError } from "../lib/http.js";

export const authenticate = asyncHandler(async (request, _response, next) => {
  const header = request.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new HttpError(401, "AUTH_REQUIRED", "Token autentikasi diperlukan.");

  if (!isSupabaseConfigured()) {
    throw new HttpError(503, "SUPABASE_NOT_CONFIGURED", "Supabase belum dikonfigurasi pada backend.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !authData?.user) {
    throw new HttpError(401, "INVALID_TOKEN", "Sesi tidak valid atau sudah berakhir.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,identity_code,full_name,app_role,member_category,account_status,phone_e164,whatsapp_opt_in,created_at,updated_at")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) throw new HttpError(503, "PROFILE_LOOKUP_FAILED", "Profil pengguna tidak dapat diverifikasi.");
  if (!profile || profile.account_status !== "active") {
    throw new HttpError(403, "ACCOUNT_INACTIVE", "Akun belum aktif atau telah dinonaktifkan.");
  }

  request.auth = { user: authData.user, profile, token: match[1] };
  next();
});

export function allowRoles(...roles) {
  return (request, _response, next) => {
    if (!request.auth) return next(new HttpError(401, "AUTH_REQUIRED", "Autentikasi diperlukan."));
    if (!roles.includes(request.auth.profile.app_role)) {
      return next(new HttpError(403, "FORBIDDEN", "Role tidak memiliki akses ke fitur ini."));
    }
    next();
  };
}
