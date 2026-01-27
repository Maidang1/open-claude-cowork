import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: [resolve(__dirname, "./src/render/test/setup.ts")],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Electron/DOM code sometimes relies on globals.
    globals: false,
  },
  resolve: {
    alias: {
      "@src": resolve(__dirname, "./src"),
      "@main": resolve(__dirname, "./src/main"),
      "@render": resolve(__dirname, "./src/render"),
      "@components": resolve(__dirname, "./src/render/components"),
      "@domains": resolve(__dirname, "./src/domains"),
    },
  },
});
