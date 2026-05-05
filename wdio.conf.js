import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTestConfig, cleanupTestConfig } from "./e2e/fixtures.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const binaryName = process.platform === "win32" ? "PhotoClove.exe" : "PhotoClove";
const application = path.resolve(__dirname, "src-tauri", "target", "debug", binaryName);

const { configPath: testConfigPath, tmpRoot: testConfigTmpRoot } = buildTestConfig();

let tauriDriver;
let exit = false;

export const config = {
  runner: "local",
  specs: ["./e2e/**/*.test.js"],
  exclude: [],
  logLevel: "info",
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: [],

  host: "127.0.0.1",
  port: 4444,
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": {
        application,
        args: ["--config", testConfigPath],
      },
    },
  ],
  reporters: ["spec"],
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },

  // Build the Tauri app in debug mode (no bundle) before any session starts.
  onPrepare: () => {
    console.log("[wdio] Building Tauri application for e2e tests...");
    const result = spawnSync(
      "pnpm",
      ["tauri", "build", "--debug", "--no-bundle"],
      { cwd: __dirname, stdio: "inherit", shell: true },
    );
    if (result.status !== 0) {
      console.error("[wdio] Failed to build Tauri application");
      process.exit(1);
    }
  },

  // Start tauri-driver to proxy WebDriver traffic to WebKitWebDriver.
  beforeSession: () => {
    const driverName = process.platform === "win32" ? "tauri-driver.exe" : "tauri-driver";
    const fromPath = spawnSync("which", [driverName], { encoding: "utf8" }).stdout.trim();
    const driverPath = fromPath || path.resolve(os.homedir(), ".cargo", "bin", driverName);

    console.log(`[wdio] Starting ${driverPath}...`);
    tauriDriver = spawn(driverPath, [], {
      stdio: [null, process.stdout, process.stderr],
    });

    tauriDriver.on("error", (error) => {
      console.error("[wdio] tauri-driver error:", error);
      process.exit(1);
    });

    tauriDriver.on("exit", (code) => {
      if (!exit) {
        console.error("[wdio] tauri-driver exited unexpectedly with code:", code);
        process.exit(1);
      }
    });

    return new Promise((resolve) => setTimeout(resolve, 2000));
  },

  afterSession: () => closeTauriDriver(),

  onComplete: () => cleanupTestConfig(testConfigTmpRoot),
};

function closeTauriDriver() {
  exit = true;
  tauriDriver?.kill();
}

function onShutdown(fn) {
  const cleanup = () => {
    try {
      fn();
    } finally {
      process.exit();
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGHUP", cleanup);
  process.on("SIGBREAK", cleanup);
}

onShutdown(() => {
  closeTauriDriver();
  cleanupTestConfig(testConfigTmpRoot);
});
