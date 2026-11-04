import { adminApi as featureAdminApi } from "../features/admin/api/adminApi";
import { apiRequest } from "../services/api/apiClient";
import type {
  HeroMotivationAdminDto,
  CreateHeroMotivationApi,
  UpdateHeroMotivationApi,
} from "../types/api";

export * from "../features/admin/api/adminApi";

export const adminApi = {
  ...featureAdminApi,
  listHeroMotivations(): Promise<HeroMotivationAdminDto[]> {
    return apiRequest<HeroMotivationAdminDto[]>("/admin/hero-motivations", { auth: true });
  },

  createHeroMotivation(input: CreateHeroMotivationApi): Promise<HeroMotivationAdminDto> {
    return apiRequest<HeroMotivationAdminDto>("/admin/hero-motivations", { method: "POST", auth: true, body: input });
  },

  updateHeroMotivation(id: string, input: UpdateHeroMotivationApi): Promise<HeroMotivationAdminDto> {
    return apiRequest<HeroMotivationAdminDto>(`/admin/hero-motivations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      auth: true,
      body: input,
    });
  },

  deleteHeroMotivation(id: string): Promise<{ deleted: true; id: string }> {
    return apiRequest<{ deleted: true; id: string }>(`/admin/hero-motivations/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: true,
    });
  },
};
