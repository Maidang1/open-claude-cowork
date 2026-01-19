const { spawnSync } = require("node:child_process");
const { logger } = require("rslog");

const isEnvDev = process.env?.NODE_ENV === "development";

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
        choices: ["darwin", "win32", "linux"],
        when: () => !isEnvDev,
      },
    ],
    actions(answers) {
      const actions = [];
      if (!answers) return actions;
      const platform = answers?.platform;

      if (isEnvDev) {
        onDev();
      } else {
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
  createSpawnBuilder(
    `cross-env ENV_FILE=${process.platform}  npm`,
    ["run", "dev:render"],
  );
};

const onBuilder = (platform) => {
  const envPrefix = `cross-env ENV_FILE=${platform} `;
  let envSuffix = "";
  switch (platform) {
    case "darwin": {
      envSuffix = " --universal ";
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
  createSpawnBuilder(`${envPrefix} electron-builder -c ./builder.js ${envSuffix}`);
};
