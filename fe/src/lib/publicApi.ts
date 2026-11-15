import { apiRequest } from "../services/api/apiClient";
import type { HomepageLogoDto, PublicHeroMotivationDto } from "../types/api";

export * from "../features/public/api/publicApi";

export function getPublicHeroMotivations(signal?: AbortSignal): Promise<PublicHeroMotivationDto[]> {
  return apiRequest<PublicHeroMotivationDto[]>("/public/hero-motivations", { signal });
}

export function getPublicHomepageLogo(signal?: AbortSignal): Promise<HomepageLogoDto | null> {
  return apiRequest<HomepageLogoDto | null>("/public/homepage-logo", { signal });
}
