const SAFE_ACTIONS = new Set([
  "auth.register",
  "profile.update",
  "profile.whatsapp_consent",
  "booking.create",
  "booking.status",
  "booking.reschedule",
  "session.status",
  "feedback.submit",
  "feedback.moderate",
  "feedback.review",
  "notification.read",
  "admin.account.create",
  "admin.account.update",
  "admin.counselor.publication",
  "admin.period.create",
  "admin.period.update",
  "admin.period.delete",
  "admin.hero_motivation.create",
  "admin.hero_motivation.update",
  "admin.hero_motivation.delete",
  "counselor.profile.update",
  "counselor.availability.create",
  "counselor.availability.update",
  "counselor.availability.cancel",
]);
const SAFE_METADATA_KEYS = new Set(["status", "role", "field", "count"]);

/**
 * Best-effort audit logging. Audit failures are reported without changing the
 * primary API response. The optional client argument makes failure handling testable.
 */
export async function writeAudit(
  { actorUserId = null, action, entityType, entityId = null, metadata = {} },
  clientOverride,
) {
  if (!SAFE_ACTIONS.has(action)) return;

  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) =>
      SAFE_METADATA_KEYS.has(key) && ["string", "number", "boolean"].includes(typeof value),
    ),
  );

  try {
    let client = clientOverride;
    if (!client) {
      const { getSupabaseAdminClient } = await import("../config/supabase.js");
      client = getSupabaseAdminClient();
    }
    const { error } = await client.from("audit_events").insert({
      actor_user_id: actorUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: safeMetadata,
    });

    // Supabase returns database failures in { error }; it does not necessarily throw.
    if (error) {
      console.error("Audit write failed", {
        action,
        entityType,
        code: typeof error.code === "string" ? error.code : "UNKNOWN",
      });
    }
  } catch (error) {
    // Never log tokens, request bodies, notes, or full provider/database messages.
    console.error("Audit write failed", {
      action,
      entityType,
      code: typeof error?.code === "string" ? error.code : "UNKNOWN",
    });
  }
}
