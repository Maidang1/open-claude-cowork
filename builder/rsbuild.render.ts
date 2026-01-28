import { join } from "node:path";
import { defineConfig, mergeRsbuildConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginReact } from "@rsbuild/plugin-react";
import { releaseRenderPath, srcRenderPath } from "./paths";
import CommonConfig from "./rsbuild.common";

const Config = defineConfig({
  plugins: [
    pluginReact(),
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
      babelLoaderOptions(opts) {
        opts.plugins?.unshift("babel-plugin-react-compiler");
      },
    }),
  ],
  source: {
    entry: {
      index: join(srcRenderPath, "./index.tsx"),
    },
  },
  server: {
    port: Number(process.env._PORT),
  },
  dev: {},
  output: {
    assetPrefix: ".",
    cleanDistPath: process.env.NODE_ENV === "production",
    distPath: {
      root: join(releaseRenderPath),
    },
  },
  html: {
    title: "open-claude-cowork",
  },
});

module.exports = mergeRsbuildConfig(CommonConfig, Config);
