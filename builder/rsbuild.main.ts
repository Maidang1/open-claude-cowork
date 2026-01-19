import { join } from "node:path";
import { defineConfig, mergeRsbuildConfig, logger } from "@rsbuild/core";
import { releaseMainPath, srcMainPath } from "./paths";
import CommonConfig from "./rsbuild.common";


logger.info(
  `Self Environment`,
  Object.fromEntries(Object.entries(process.env || {}).filter(([key]) => key.startsWith("_"))),
);

const Config = defineConfig({
  tools: {
    rspack: {
      target: "electron-main",
    },
  },
  source: {
    entry: {
      index: join(srcMainPath, "./index.ts"),
      preload: join(srcMainPath, "./preload.ts"),
    },
  },
  output: {
    target: "node",
    distPath: {
      root: join(releaseMainPath),
    },
    cleanDistPath: true,
    sourceMap: {
      js: process.env.NODE_ENV === "production" ? "source-map" : "cheap-module-source-map",
      css: true,
    },
  },
});

module.exports = mergeRsbuildConfig(CommonConfig, Config);
