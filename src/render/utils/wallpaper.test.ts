import { describe, expect, it } from "vitest";
import { isWallpaperGradient, wallpaperUrl } from "./wallpaper";

describe("wallpaper utils", () => {
  it("detects gradient values", () => {
    expect(isWallpaperGradient("linear-gradient(to right, #000, #fff)")).toBe(true);
    expect(isWallpaperGradient("radial-gradient(circle, #000, #fff)")).toBe(true);
    expect(isWallpaperGradient("/tmp/wallpaper.png")).toBe(false);
  });

  it("builds a wallpaper protocol URL", () => {
    expect(wallpaperUrl("/a b/c.png")).toBe("wallpaper://local/%2Fa%20b%2Fc.png");
  });
});
