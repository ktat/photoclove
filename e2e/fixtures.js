import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

/**
 * Build an isolated PhotoClove config that points the app at `example/`
 * directories instead of the user's real `~/.photoclove/` data. Returns the
 * config path to pass via `--config` and a tmp root to clean up afterwards.
 */
export function buildTestConfig() {
  const fixtureRoot = path.join(REPO_ROOT, "example");
  const importTo = path.join(fixtureRoot, "import_to");
  const trashPath = path.join(fixtureRoot, "trash");
  const thumbnailStore = path.join(fixtureRoot, "thumbnail");
  const exportFrom = path.join(fixtureRoot, "export_from");

  for (const dir of [trashPath, thumbnailStore]) {
    mkdirSync(dir, { recursive: true });
  }

  const tmpRoot = path.join(tmpdir(), `photoclove-e2e-${process.pid}-${Date.now()}`);
  mkdirSync(tmpRoot, { recursive: true });

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
    "use_count: 0",
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
