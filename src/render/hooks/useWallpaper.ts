import { useEffect, useState } from "react";
import { isWallpaperGradient, wallpaperUrl } from "../utils/wallpaper";

export function useWallpaper() {
  const [wallpaper, setWallpaper] = useState<string | null>(null);

  useEffect(() => {
    const loadWallpaper = async () => {
      const savedWallpaper = await window.electron.invoke("env:get-wallpaper");
      const normalized = typeof savedWallpaper === "string" ? savedWallpaper.trim() : "";
      setWallpaper(normalized ? normalized : null);
    };
    loadWallpaper();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (wallpaper) {
      if (isWallpaperGradient(wallpaper)) {
        root.style.setProperty("--wallpaper", wallpaper);
      } else {
        root.style.setProperty("--wallpaper", `url('${wallpaperUrl(wallpaper)}')`);
      }
      root.classList.add("bg-wallpaper");
    } else {
      root.style.removeProperty("--wallpaper");
      root.classList.remove("bg-wallpaper");
    }
  }, [wallpaper]);

  const handleWallpaperChange = async (path: string | null) => {
    const normalized = typeof path === "string" ? path.trim() : "";
    setWallpaper(normalized ? normalized : null);
    if (normalized) {
      await window.electron.invoke("env:set-wallpaper", normalized);
    } else {
      await window.electron.invoke("env:clear-wallpaper");
    }
  };

  return {
    wallpaper,
    handleWallpaperChange,
  };
}
