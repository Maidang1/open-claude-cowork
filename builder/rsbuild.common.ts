import { defineConfig, loadEnv } from "@rsbuild/core";

const { publicVars } = loadEnv({
  prefixes: [""],
  cwd: `${process.cwd()}/env`,
  mode: process.env.ENV_FILE
});

const CommonConfig = defineConfig({
  tools: {
    rspack: {
      ignoreWarnings: [/Critical dependency/],
    },
  },
  performance: {
    buildCache: false,
  },
  source: {
    define: publicVars,
  },
});

export default CommonConfig;
