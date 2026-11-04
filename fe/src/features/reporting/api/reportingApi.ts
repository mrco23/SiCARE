import { apiRequest } from "../../../services/api/apiClient";
import type { AdminDashboardDto, AdminReportDto } from "../../../types/api";

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
};

