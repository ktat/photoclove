import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

/**
 * Build an isolated PhotoClove config that points the app at `example/`
 * directories instead of the user's real `~/.photoclove/` data. Returns the
 * config path to pass via `--config` and a tmp root to clean up afterwards.
 *
 * The import_to directory (including photoclove.db) is copied to tmpRoot so
 * that deletion tests don't corrupt the committed fixture data.
 */
export function buildTestConfig() {
  const fixtureRoot = path.join(REPO_ROOT, "example");
  const exportFrom = path.join(fixtureRoot, "export_from");

  const tmpRoot = path.join(tmpdir(), `photoclove-e2e-${process.pid}-${Date.now()}`);
  mkdirSync(tmpRoot, { recursive: true });

  // Copy the entire import_to directory (photos + DB) so tests can safely
  // write to the database without corrupting the committed fixture data.
  const importTo = path.join(tmpRoot, "import_to");
  execSync(`cp -r "${path.join(fixtureRoot, "import_to")}" "${importTo}"`);

  // Pre-unlock all achievements in the copied DB so the AchievementPopup
  // never appears during tests. The popup is a fullscreen z-index 10000
  // overlay that intercepts every click for 5s, breaking subsequent
  // interactions in CI's tighter timing.
  preUnlockAchievements(path.join(importTo, "photoclove.db"));

  const trashPath = path.join(tmpRoot, "trash");
  const thumbnailStore = path.join(tmpRoot, "thumbnail");

  for (const dir of [trashPath, thumbnailStore]) {
    mkdirSync(dir, { recursive: true });
  }

  const configPath = path.join(tmpRoot, "photoclove.yml");
  const yaml = [
    "repository:",
    "  store: \"\"",
    "  option: {}",
    `import_to: ${importTo}`,
    "export_from:",
    `  - ${exportFrom}`,
    `trash_path: ${trashPath}`,
    `thumbnail_store: ${thumbnailStore}`,
    "thumbnail_ratio: 0.05",
    "thumbnail_compression_quality: 0.5",
    "thumbnail_ignore_file_size: 1048576",
    "copy_parallel: 2",
    "thumbnail_parallel: 1",
    "# Skip the Welcome screen (shown when use_count <= 2)",
    "use_count: 99",
    "",
  ].join("\n");

  writeFileSync(configPath, yaml);
  return { configPath, tmpRoot };
}

export function cleanupTestConfig(tmpRoot) {
  if (tmpRoot) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// Achievement IDs to pre-unlock. Must stay in sync with
// src-tauri/src/domain_service/achievements/definitions.rs. We just enumerate
// the "first_*" ones plus a few global counters that tests are likely to
// trigger; missing entries simply re-trigger the popup which is harmless
// for the few that aren't covered.
const PRE_UNLOCK_ACHIEVEMENTS = [
  "first_import", "first_edit", "first_tag", "first_album", "first_star",
  "first_search", "first_export", "first_google_upload", "first_delete",
  "first_view", "first_collage", "first_slideshow", "first_ai_tagging",
  "first_face_detection", "first_quick_view", "first_theme_change",
];

// Hash format must match generate_hash() in
// src-tauri/src/repository/meta_db/sqlite/achievements.rs:
//   sha256("{id}:{achieved_at}:{HASH_SALT}")
const HASH_SALT = "Ph0t0Cl0v3_Ach13v3m3nt_S4lt_2024";

function preUnlockAchievements(dbPath) {
  const achievedAt = "2020-01-01 00:00:00";
  const lines = [];
  for (const id of PRE_UNLOCK_ACHIEVEMENTS) {
    const hash = createHash("sha256")
      .update(`${id}:${achievedAt}:${HASH_SALT}`)
      .digest("hex");
    // INSERT OR REPLACE so this is idempotent across CI re-runs and works
    // whether or not the row already exists in the committed fixture DB.
    lines.push(
      `INSERT OR REPLACE INTO achievement_progress` +
      ` (id, current_value, achieved_at, updated_at, verification_hash)` +
      ` VALUES ('${id}', 1, '${achievedAt}', '${achievedAt}', '${hash}');`,
    );
  }

  // Register 2022-11-08 photos in photo_metadata. Files exist on disk in
  // example/import_to/2022-11-08/ but the committed photoclove.db has no
  // rows for them, so the date sidebar lists 2022-11-08 (date_summary
  // has it) but no cards render. The bulk-delete test uses this date
  // specifically because deleting from it doesn't impact other dates
  // that other tests depend on.
  for (const filename of ["P1224152.JPG", "P1224184.JPG"]) {
    lines.push(
      `INSERT OR IGNORE INTO photo_metadata` +
      ` (path, photo_date, star, comment, created_at, updated_at)` +
      ` VALUES ('2022-11-08/${filename}', '2022-11-08 00:00:00', 0, '',` +
      ` '2022-11-08 00:00:00', '2022-11-08 00:00:00');`,
    );
  }

  const sql = lines.join("\n");
  const sqlPath = `${dbPath}.fixtures.sql`;
  writeFileSync(sqlPath, sql);
  execSync(`sqlite3 "${dbPath}" < "${sqlPath}"`, {
    shell: "/bin/sh",
    stdio: ["ignore", "inherit", "inherit"],
  });
  rmSync(sqlPath);

  // Verify the photo_metadata seed actually applied — silent failure
  // would manifest later as "no cards rendered for 2022-11-08" which
  // is much harder to debug. Throw early with a useful message.
  const photoCount = execSync(
    `sqlite3 "${dbPath}" "SELECT COUNT(*) FROM photo_metadata WHERE path LIKE '2022-11-08%';"`,
    { shell: "/bin/sh" },
  ).toString().trim();
  if (photoCount !== "2") {
    throw new Error(
      `[fixtures] expected 2 photo_metadata rows for 2022-11-08 after seed, got ${photoCount}. SQL may have failed.`,
    );
  }
  console.log(`[fixtures] seeded ${photoCount} 2022-11-08 photos into ${dbPath}`);
}

