import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL("../../supabase/migrations/20261029100000_sicare_hero_motivations.sql", import.meta.url);
const adminRoutesUrl = new URL("../src/routes/admin.routes.js", import.meta.url);
const domainRoutesUrl = new URL("../src/routes/domain.routes.js", import.meta.url);
const adminPageUrl = new URL("../../fe/src/pages/admin/AdminPengaturanPage.tsx", import.meta.url);
const adminApiUrl = new URL("../../fe/src/lib/adminApi.ts", import.meta.url);
const homePageUrl = new URL("../../fe/src/pages/public/HomePage.tsx", import.meta.url);
const publicApiUrl = new URL("../../fe/src/lib/publicApi.ts", import.meta.url);

test("hero motivation migration stores a single sentence without created_by or paragraph fields", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create table public\.hero_motivations/i);
  assert.match(sql, /content text not null/i);
  assert.match(sql, /is_active boolean not null default true/i);
  assert.match(sql, /hero_motivations_content_length/i);
  assert.match(sql, /hero_motivations_single_line/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.hero_motivations from public, anon, authenticated/i);
  assert.match(sql, /grant all on public\.hero_motivations to service_role/i);
  assert.doesNotMatch(sql, /created_by\s+uuid/i);
  assert.doesNotMatch(sql, /paragraph\s+text/i);
});

test("admin hero motivation CRUD requires the admin role and exposes no creator field", async () => {
  const source = await readFile(adminRoutesUrl, "utf8");
  assert.match(source, /router\.get\("\/hero-motivations", authenticate, allowRoles\("admin"\)/);
  assert.match(source, /router\.post\("\/hero-motivations", authenticate, allowRoles\("admin"\)/);
  assert.match(source, /router\.patch\("\/hero-motivations\/:id", authenticate, allowRoles\("admin"\)/);
  assert.match(source, /router\.delete\("\/hero-motivations\/:id", authenticate, allowRoles\("admin"\)/);
  assert.match(source, /content: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(180\)/);
  assert.doesNotMatch(source, /created_by/);
});

test("public hero endpoint returns only active sentences", async () => {
  const source = await readFile(domainRoutesUrl, "utf8");
  assert.match(source, /router\.get\("\/public\/hero-motivations"/);
  assert.match(source, /\.from\("hero_motivations"\)[\s\S]*?\.select\("id,content"\)[\s\S]*?\.eq\("is_active", true\)/);
});

test("admin settings manages one motivational sentence per input through the admin API wrapper", async () => {
  const [page, api] = await Promise.all([
    readFile(adminPageUrl, "utf8"),
    readFile(adminApiUrl, "utf8"),
  ]);

  assert.match(page, /label="Kalimat motivasi"/);
  assert.match(page, /type="text"/);
  assert.doesNotMatch(page, /label="Paragraf"/);
  assert.doesNotMatch(page, /item\.paragraph/);
  assert.match(page, /adminApi\.listHeroMotivations\(\)/);
  assert.match(page, /adminApi\.createHeroMotivation\(/);
  assert.match(page, /adminApi\.updateHeroMotivation\(/);
  assert.match(page, /adminApi\.deleteHeroMotivation\(/);

  assert.match(api, /listHeroMotivations\(\): Promise<HeroMotivationAdminDto\[]>[\s\S]*?apiRequest<HeroMotivationAdminDto\[]>\("\/admin\/hero-motivations", \{ auth: true \}\)/);
  assert.match(api, /createHeroMotivation\([\s\S]*?apiRequest<HeroMotivationAdminDto>\("\/admin\/hero-motivations", \{ method: "POST", auth: true, body: input \}\)/);
  assert.match(api, /updateHeroMotivation\(id: string, input: UpdateHeroMotivationApi\): Promise<HeroMotivationAdminDto> \{[\s\S]*?method: "PATCH",[\s\S]*?auth: true,[\s\S]*?body: input,[\s\S]*?\n  \},/);
  assert.match(api, /deleteHeroMotivation\(id: string\): Promise<\{ deleted: true; id: string \}> \{[\s\S]*?method: "DELETE",[\s\S]*?auth: true,[\s\S]*?\n  \},/);
});

test("public home page loads and renders a motivational sentence through the public API wrapper", async () => {
  const [page, api] = await Promise.all([
    readFile(homePageUrl, "utf8"),
    readFile(publicApiUrl, "utf8"),
  ]);

  assert.match(page, /getPublicHeroMotivations/);
  assert.match(page, /void getPublicHeroMotivations\(\)/);
  assert.match(page, /setHeroMotivation\(selected\.content\)/);
  assert.match(page, /DEFAULT_HERO_MOTIVATION/);
  assert.match(page, /\{heroMotivation\}/);
  assert.match(api, /getPublicHeroMotivations\(signal\?: AbortSignal\): Promise<PublicHeroMotivationDto\[]>[\s\S]*?apiRequest<PublicHeroMotivationDto\[]>\("\/public\/hero-motivations", \{ signal \}\)/);
});
