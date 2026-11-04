import { getSupabaseAdminClient, isSupabaseConfigured } from "../../config/supabase.js";
import { HttpError, sendData } from "../../lib/http.js";
import { fonnteService } from "../../services/fonnte.service.js";

const supa = () => {
  if (!isSupabaseConfigured())
    throw new HttpError(
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Supabase belum dikonfigurasi pada backend.",
    );
  return getSupabaseAdminClient();
};

export const adminWhatsAppController = {
  async getWhatsAppHealth(_req, res) {
    const fonnteConfig = fonnteService.checkConfiguration();

    let stats = {
      total: 0,
      pending: 0,
      processing: 0,
      accepted: 0,
      delivered: 0,
      retry_wait: 0,
      failed: 0,
      cancelled: 0,
      unknown: 0,
    };

    try {
      const { data: rpcStats, error: rpcError } = await supa().rpc(
        "sicare_get_whatsapp_stats",
      );
      if (!rpcError && rpcStats) {
        stats = rpcStats;
      } else {
        const { data: rows } = await supa()
          .from("whatsapp_outbox")
          .select("status");
        if (rows) {
          stats.total = rows.length;
          for (const row of rows) {
            if (row.status in stats) stats[row.status]++;
            else if (row.status === "queued") stats.pending++;
            else if (row.status === "sending") stats.processing++;
          }
        }
      }
    } catch {
      // Graceful fallback if database is inaccessible
    }

    const { data: recentErrors } = await supa()
      .from("whatsapp_outbox")
      .select(
        "id,message_type,status,last_error_code,last_error_message,attempt_count,error_category,updated_at",
      )
      .in("status", ["failed", "retry_wait", "unknown"])
      .order("updated_at", { ascending: false })
      .limit(10);

    return sendData(res, {
      provider: {
        name: "Fonnte",
        configured: fonnteConfig.configured,
        send_enabled: fonnteConfig.sendEnabled,
        test_mode: fonnteConfig.testMode,
        api_url: fonnteConfig.apiUrl,
        timeout_ms: fonnteConfig.timeoutMs,
        test_recipients_count: fonnteConfig.testRecipientsCount,
      },
      outbox: stats,
      recent_issues: recentErrors ?? [],
      timestamp: new Date().toISOString(),
    });
  },
};

