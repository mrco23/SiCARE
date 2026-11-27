import { apiRequest } from "../../../services/api/apiClient";
import type { AdminDashboardDto, AdminReportDto } from "../../../types/api";
import type { ReportPrintData } from "../../../components/reports/CounselingReportPrint";

/** Isi PDF laporan: data agregat saja. Peran dari rute, penanda tangan dari profil di server. */
export type ReportPdfRequest = Omit<ReportPrintData, "role" | "signer">;

/** Dashboard/report endpoints are role-specific; backend still enforces the role. */
export const reportingApi = {
  getAdminDashboard(): Promise<AdminDashboardDto> {
    return apiRequest<AdminDashboardDto>("/admin/dashboard", { auth: true });
  },

  getHeadLmiDashboard(): Promise<AdminDashboardDto> {
    return apiRequest<AdminDashboardDto>("/head-lmi/dashboard", { auth: true });
  },

  getAdminReport(): Promise<AdminReportDto> {
    return apiRequest<AdminReportDto>("/admin/reports", { auth: true });
  },

  getHeadLmiReport(): Promise<AdminReportDto> {
    return apiRequest<AdminReportDto>("/head-lmi/reports", { auth: true });
  },

  /** Berkas PDF laporan yang disusun server, untuk diunduh langsung. */
  downloadReportPdf(role: "admin" | "headlmi", body: ReportPdfRequest): Promise<Blob> {
    const path = role === "headlmi" ? "/head-lmi/reports/pdf" : "/admin/reports/pdf";
    return apiRequest<Blob>(path, {
      method: "POST",
      auth: true,
      body,
      responseType: "blob",
      timeoutMs: 30_000,
    });
  },
};

