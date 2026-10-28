import { getSupabaseAdminClient } from "../config/supabase.js";

const SAFE_ACTIONS = new Set(["auth.register", "profile.update"]);
const SAFE_METADATA_KEYS = new Set(["status", "role", "field", "count"]);

export async function writeAudit({ actorUserId = null, action, entityType, entityId = null, metadata = {} }) {
  if (!SAFE_ACTIONS.has(action)) return;

  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) =>
      SAFE_METADATA_KEYS.has(key) && ["string", "number", "boolean"].includes(typeof value),
    ),
  );

  try {
    await getSupabaseAdminClient().from("audit_events").insert({
      actor_user_id: actorUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: safeMetadata,
    });
  } catch {
    // Audit failures must not expose credentials or change the main response.
    console.error("Audit write failed", { action, entityType });
  }
}
