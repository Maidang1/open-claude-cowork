const { spawnSync } = require("node:child_process");
const { logger } = require("rslog");

const isEnvDev = process.env?.NODE_ENV === "development";
const PLATFORM_CHOICES = [
  "darwin",
  "darwin-x64",
  "darwin-arm64",
  "win32",
  "linux",
];

const getCliPlatform = () => {
  const envPlatform = process.env?.BUILD_PLATFORM || process.env?.PLATFORM;
  if (envPlatform) return envPlatform;

  for (let i = 0; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === "--build-platform" || arg === "-P") {
      return process.argv[i + 1];
    }
    if (arg.startsWith("--build-platform=")) {
      return arg.split("=", 2)[1];
    }
  }
  return undefined;
};

const cliPlatform = getCliPlatform();
if (cliPlatform && !PLATFORM_CHOICES.includes(cliPlatform)) {
  logger.error(
    `Invalid platform "${cliPlatform}". Use one of: ${PLATFORM_CHOICES.join(
      ", ",
    )}`,
  );
  process.exit(1);
}

/**
 * @param {import("plop").NodePlopAPI} plop
 */
module.exports = function main(plop) {
  plop.setGenerator("build", {
    description: "Application builder logic",
    prompts: [
      {
        type: "list",
        name: "platform",
        message: "Select a platform",
        default: "darwin",
        // 同步的 process.platform 枚举
        choices: PLATFORM_CHOICES,
        when: () => !isEnvDev && !cliPlatform,
      },
    ],
    actions(answers) {
      const actions = [];
      if (!answers && !cliPlatform) return actions;
      const platform = answers?.platform ?? cliPlatform;

      if (isEnvDev) {
        onDev();
      } else {
        if (!platform) {
          logger.error(
            "Missing platform. Use --build-platform or set BUILD_PLATFORM.",
          );
          process.exit(1);
        }
        onBuilder(platform);
      }
      return actions;
    },
  });
};

const createSpawnBuilder = (command, args = [], options = {}) => {
  const { stdio = "inherit", shell = true } = options;
  const shellRes = spawnSync(command, args, { stdio, shell });
  if (shellRes.error || shellRes.stderr) {
    logger.error(`[Shell Error] ${JSON.stringify(error || shell.stderr)}`);
    process.exit(-1);
  }
};

const onDev = () => {
  createSpawnBuilder(`cross-env ENV_FILE=${process.platform}  npm`, [
    "run",
    "dev:render",
  ]);
};

const resolveEnvFile = (platform) => {
  if (platform === "darwin-x64" || platform === "darwin-arm64") return "darwin";
  return platform;
};

const onBuilder = (platform) => {
  const envFile = resolveEnvFile(platform);
  const envPrefix = `cross-env ENV_FILE=${envFile} BUILD_TARGET=${platform} `;
  let envSuffix = "";
  switch (platform) {
    case "darwin": {
      envSuffix = " --universal ";
      break;
    }
    case "darwin-x64": {
      envSuffix = " --mac --x64 ";
      break;
    }
    case "darwin-arm64": {
      envSuffix = " --mac --arm64 ";
      break;
    }
    case "win32": {
      envSuffix = " --win --x64 ";
      break;
    }
    case "linux": {
      envSuffix = " --linux ";
      break;
    }
  }
  createSpawnBuilder(`${envPrefix} npm`, ["run", "build:main"]);
  createSpawnBuilder(`${envPrefix} npm`, ["run", "build:render"]);
  createSpawnBuilder(
    `${envPrefix} electron-builder -c ./builder.js ${envSuffix}`,
  );
};
