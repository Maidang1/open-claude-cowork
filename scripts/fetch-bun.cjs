/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT_DIR, "public", "tools", "bun");
const TMP_DIR = path.join(ROOT_DIR, ".tmp", "bun-download");

const SKIP_DOWNLOAD = process.env.SKIP_BUN_DOWNLOAD === "1";
const FORCE_DOWNLOAD = process.env.FORCE_BUN_DOWNLOAD === "1";
const RAW_VERSION = process.env.BUN_VERSION || "latest";
const VERSION = RAW_VERSION.startsWith("v") ? RAW_VERSION.slice(1) : RAW_VERSION;
const BASE_URL =
  VERSION === "latest"
    ? "https://github.com/oven-sh/bun/releases/latest/download"
    : `https://github.com/oven-sh/bun/releases/download/bun-v${VERSION}`;

const ALL_TARGETS = [
  {
    platform: "darwin",
    arch: "arm64",
    asset: "bun-darwin-aarch64.zip",
    binName: "bun",
  },
  {
    platform: "darwin",
    arch: "x64",
    asset: "bun-darwin-x64.zip",
    binName: "bun",
  },
  {
    platform: "linux",
    arch: "arm64",
    asset: "bun-linux-aarch64.zip",
    binName: "bun",
  },
  {
    platform: "linux",
    arch: "x64",
    asset: "bun-linux-x64.zip",
    binName: "bun",
  },
  {
    platform: "win32",
    arch: "arm64",
    asset: "bun-windows-arm64.zip",
    binName: "bun.exe",
  },
  {
    platform: "win32",
    arch: "x64",
    asset: "bun-windows-x64.zip",
    binName: "bun.exe",
  },
  {
    platform: "win32",
    arch: "ia32",
    asset: "bun-windows-x86.zip",
    binName: "bun.exe",
  },
];

const parseTargets = () => {
  const raw = (process.env.BUN_TARGETS || "all").toLowerCase();
  if (raw === "all") return ALL_TARGETS;
  if (raw === "current") {
    const current = ALL_TARGETS.find(
      (target) =>
        target.platform === process.platform && target.arch === process.arch,
    );
    if (!current) {
      throw new Error(
        `Unsupported platform/arch: ${process.platform}-${process.arch}`,
      );
    }
    return [current];
  }
  const requested = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const targets = ALL_TARGETS.filter((target) =>
    requested.includes(`${target.platform}-${target.arch}`),
  );
  if (targets.length === 0) {
    throw new Error(`No matching bun targets for: ${raw}`);
  }
  return targets;
};

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const removeDir = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
};

const downloadFile = (url, dest) =>
  new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "open-claude-cowork-bun-fetch",
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          const redirect = res.headers.location;
          if (!redirect) {
            reject(new Error(`Redirect without location for ${url}`));
            return;
          }
          res.resume();
          downloadFile(redirect, dest).then(resolve).catch(reject);
          return;
        }

        if (status !== 200) {
          reject(new Error(`Failed to download ${url} (status ${status})`));
          return;
        }

        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", (err) => {
          file.close(() => reject(err));
        });
      },
    );

    request.on("error", reject);
  });

const extractZip = async (zipPath, outDir) => {
  ensureDir(outDir);
  if (process.platform === "win32") {
    const escapedZip = zipPath.replace(/'/g, "''");
    const escapedOut = outDir.replace(/'/g, "''");
    const command =
      `Expand-Archive -Force -LiteralPath '${escapedZip}' ` +
      `-DestinationPath '${escapedOut}'`;
    await execFileAsync("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      command,
    ]);
    return;
  }
  await execFileAsync("unzip", ["-o", zipPath, "-d", outDir]);
};

const findFile = (dir, fileName) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === fileName) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const found = findFile(fullPath, fileName);
      if (found) return found;
    }
  }
  return null;
};

const writeVersionFile = (dir) => {
  const versionPath = path.join(dir, "version.txt");
  fs.writeFileSync(versionPath, `${RAW_VERSION}\n`, "utf8");
};

const fetchTarget = async (target) => {
  const targetKey = `${target.platform}-${target.arch}`;
  const destDir = path.join(OUT_DIR, targetKey);
  const destBin = path.join(destDir, target.binName);
  const assetUrl = `${BASE_URL}/${target.asset}`;

  if (!FORCE_DOWNLOAD && fs.existsSync(destBin)) {
    console.log(`[bun] ${targetKey} already present, skipping.`);
    return;
  }

  console.log(`[bun] Downloading ${assetUrl}`);
  ensureDir(TMP_DIR);
  const zipPath = path.join(TMP_DIR, `${targetKey}.zip`);
  const extractDir = path.join(TMP_DIR, `${targetKey}-extract`);

  removeDir(extractDir);
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  await downloadFile(assetUrl, zipPath);
  await extractZip(zipPath, extractDir);

  const foundBinary = findFile(extractDir, target.binName);
  if (!foundBinary) {
    throw new Error(`Failed to locate ${target.binName} for ${targetKey}`);
  }

  ensureDir(destDir);
  fs.copyFileSync(foundBinary, destBin);
  if (process.platform !== "win32") {
    fs.chmodSync(destBin, 0o755);
  }
  writeVersionFile(destDir);
  console.log(`[bun] Installed ${targetKey} -> ${destBin}`);
};

const main = async () => {
  if (SKIP_DOWNLOAD) {
    console.log("[bun] SKIP_BUN_DOWNLOAD=1 set, skipping bun download.");
    return;
  }

  const targets = parseTargets();
  ensureDir(OUT_DIR);
  ensureDir(TMP_DIR);

  for (const target of targets) {
    await fetchTarget(target);
  }

  console.log("[bun] Bun download complete.");
};

main().catch((err) => {
  console.error("[bun] Failed to download bun:", err);
  process.exitCode = 1;
});
