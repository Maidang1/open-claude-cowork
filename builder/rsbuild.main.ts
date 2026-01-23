import { join } from "node:path";
import { defineConfig, mergeRsbuildConfig, logger } from "@rsbuild/core";
import { releaseMainPath, srcMainPath } from "./paths";
import CommonConfig from "./rsbuild.common";
import { pluginTailwindCSS } from "rsbuild-plugin-tailwindcss";

logger.info(
  `Self Environment`,
  Object.fromEntries(
    Object.entries(process.env || {}).filter(([key]) => key.startsWith("_")),
  ),
);

const Config = defineConfig({
  plugins: [pluginTailwindCSS()],
  tools: {
    rspack: {
      target: "electron-main",
      externals: {
        "better-sqlite3": "commonjs better-sqlite3",
        "node-pty": "commonjs node-pty",
      },
    },
  },
  source: {
    entry: {
      index: join(srcMainPath, "./index.ts"),
      preload: join(srcMainPath, "./preload.ts"),
    },
    define: {
      "process.env.DEBUG": JSON.stringify(process.env.DEBUG),
    },
  },
  output: {
    target: "node",
    distPath: {
      root: join(releaseMainPath),
    },
    cleanDistPath: true,
    sourceMap: {
      js:
        process.env.NODE_ENV === "production"
          ? "source-map"
          : "cheap-module-source-map",
      css: true,
    },
  },
});

module.exports = mergeRsbuildConfig(CommonConfig, Config);
