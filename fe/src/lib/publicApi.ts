import { apiRequest } from "../services/api/apiClient";
import type { PublicHeroMotivationDto } from "../types/api";

export * from "../features/public/api/publicApi";

export function getPublicHeroMotivations(signal?: AbortSignal): Promise<PublicHeroMotivationDto[]> {
  return apiRequest<PublicHeroMotivationDto[]>("/public/hero-motivations", { signal });
}
