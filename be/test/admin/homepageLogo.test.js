import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  homepageLogoService,
  homepageLogoUpdateSchema,
  parseLogoDataUrl,
} from "../../src/services/homepageLogo.service.js";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20261115150000_sicare_homepage_logo.sql", import.meta.url),
  "utf8",
);
const adminRoutes = readFileSync(new URL("../../src/routes/admin.routes.js", import.meta.url), "utf8");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(16)]);
const pngUrl = `data:image/png;base64,${PNG.toString("base64")}`;
const webpUrl = `data:image/webp;base64,${WEBP.toString("base64")}`;

/* ---------------- Validasi file ---------------- */

test("accepts real PNG and WebP data", () => {
  assert.equal(parseLogoDataUrl(pngUrl).ext, "png");
  assert.equal(parseLogoDataUrl(webpUrl).ext, "webp");
});

test("rejects JPG, SVG, and files whose content does not match the declared type", () => {
  for (const bad of [
    `data:image/jpeg;base64,${PNG.toString("base64")}`,
    `data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`,
    `data:image/png;base64,${WEBP.toString("base64")}`,
    `data:image/webp;base64,${PNG.toString("base64")}`,
  ]) {
    assert.throws(() => parseLogoDataUrl(bad), (e) => e.code === "INVALID_LOGO_FORMAT", bad.slice(0, 30));
  }
});

test("rejects logos larger than 1 MB", () => {
  const big = Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]);
  assert.throws(() => parseLogoDataUrl(`data:image/png;base64,${big.toString("base64")}`), (e) => e.code === "LOGO_TOO_LARGE");
});

test("alt text is required and limited to 120 characters", () => {
  assert.equal(homepageLogoUpdateSchema.safeParse({ alt_text: "Logo Lasallian DNA 2026" }).success, true);
  assert.equal(homepageLogoUpdateSchema.safeParse({ alt_text: "  " }).success, false);
  assert.equal(homepageLogoUpdateSchema.safeParse({ alt_text: "x".repeat(121) }).success, false);
});

/* ---------------- Service ---------------- */

function mockClient({ current = null, saveError = null } = {}) {
  const state = { uploads: [], removed: [], saved: null, audits: [] };
  const client = {
    state,
    storage: {
      from: () => ({
        upload: async (path) => {
          state.uploads.push(path);
          return { error: null };
        },
        remove: async (paths) => {
          state.removed.push(...paths);
          return { error: null };
        },
      }),
    },
    from(table) {
      if (table === "audit_logs") {
        return { insert: async (row) => { state.audits.push(row); return { error: null }; } };
      }
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: current, error: null }),
        upsert: (row) => {
          state.saved = row;
          return {
            select: () => ({
              single: async () =>
                saveError
                  ? { data: null, error: saveError }
                  : { data: { storage_path: row.storage_path, alt_text: row.alt_text, updated_at: "2026-11-15T00:00:00Z" }, error: null },
            }),
          };
        },
      };
      return query;
    },
  };
  return client;
}

test("first upload stores the logo and returns its public URL", async () => {
  const client = mockClient();
  const dto = await homepageLogoService.updateLogo({ image_data: pngUrl, alt_text: "Logo Lasallian DNA 2026" }, "admin-1", client);
  assert.equal(client.state.uploads.length, 1);
  assert.match(client.state.uploads[0], /^homepage-logo\/lasallian-dna-\d+\.png$/);
  assert.equal(client.state.saved.id, 1);
  assert.match(dto.url, /\/storage\/v1\/object\/public\/site-assets\/homepage-logo\//);
  assert.deepEqual(client.state.removed, []);
});

test("replacing the logo deletes the old file (previous logos are not kept)", async () => {
  const client = mockClient({ current: { storage_path: "homepage-logo/lasallian-dna-1.png", alt_text: "Lama", updated_at: "x" } });
  await homepageLogoService.updateLogo({ image_data: webpUrl, alt_text: "Baru" }, "admin-1", client);
  assert.deepEqual(client.state.removed, ["homepage-logo/lasallian-dna-1.png"]);
});

test("changing only the alt text keeps the current file", async () => {
  const client = mockClient({ current: { storage_path: "homepage-logo/lasallian-dna-1.png", alt_text: "Lama", updated_at: "x" } });
  await homepageLogoService.updateLogo({ alt_text: "Logo Lasallian DNA 2027" }, "admin-1", client);
  assert.equal(client.state.uploads.length, 0);
  assert.equal(client.state.saved.storage_path, "homepage-logo/lasallian-dna-1.png");
  assert.deepEqual(client.state.removed, []);
});

test("an image is required when no logo exists yet", async () => {
  await assert.rejects(
    homepageLogoService.updateLogo({ alt_text: "Logo" }, "admin-1", mockClient()),
    (e) => e.code === "LOGO_IMAGE_REQUIRED",
  );
});

test("a failed save removes the newly uploaded file and keeps the old one", async () => {
  const client = mockClient({
    current: { storage_path: "homepage-logo/lasallian-dna-1.png", alt_text: "Lama", updated_at: "x" },
    saveError: { code: "XX000", message: "db down" },
  });
  await assert.rejects(homepageLogoService.updateLogo({ image_data: pngUrl, alt_text: "Baru" }, "admin-1", client));
  assert.equal(client.state.removed.length, 1);
  assert.notEqual(client.state.removed[0], "homepage-logo/lasallian-dna-1.png");
});

/* ---------------- Migrasi & route ---------------- */

test("migration keeps a single PNG/WebP logo row closed to browser roles", () => {
  assert.match(migration, /constraint homepage_logo_single_row check \(id = 1\)/);
  assert.match(migration, /\\\.\(png\|webp\)\$/);
  assert.match(migration, /revoke all on table public\.homepage_logo from public, anon, authenticated;/);
  assert.match(migration, /\('site-assets', 'site-assets', true, 1048576, array\['image\/png', 'image\/webp'\]\)/);
});

test("admin can read and replace the logo but there is no delete route", () => {
  assert.match(adminRoutes, /router\.get\("\/homepage-logo"/);
  assert.match(adminRoutes, /router\.put\("\/homepage-logo"/);
  assert.doesNotMatch(adminRoutes, /router\.delete\("\/homepage-logo"/);
});
