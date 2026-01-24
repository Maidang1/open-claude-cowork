export const isWallpaperGradient = (value: string) =>
  value.startsWith("linear-gradient") || value.startsWith("radial-gradient");

export const wallpaperUrl = (filePath: string) =>
  `wallpaper://local/${encodeURIComponent(filePath)}`;
