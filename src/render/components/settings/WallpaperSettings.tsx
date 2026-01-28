import type React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { wallpaperUrl } from "../../utils/wallpaper";

const LOCAL_WALLPAPER_DIR = "assets/wallpaper";
const localWallpaperPath = (fileName: string) => `${LOCAL_WALLPAPER_DIR}/${fileName}`;

const PRESET_WALLPAPERS = [
  {
    id: "local-1",
    name: "A",
    path: localWallpaperPath("A.png"),
    thumb: wallpaperUrl(localWallpaperPath("A.png")),
  },
  {
    id: "local-2",
    name: "HelloKitty",
    path: localWallpaperPath("HelloKitty.png"),
    thumb: wallpaperUrl(localWallpaperPath("HelloKitty.png")),
  },
  {
    id: "1",
    name: "Gradient Blue",
    path: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    thumb:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80'%3E%3Cdefs%3E%3ClinearGradient id='grad1' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23667eea;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23764ba2;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='120' height='80' fill='url(%23grad1)'/%3E%3C/svg%3E",
  },
  {
    id: "2",
    name: "Sunset",
    path: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    thumb:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80'%3E%3Cdefs%3E%3ClinearGradient id='grad2' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23f093fb;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23f5576c;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='120' height='80' fill='url(%23grad2)'/%3E%3C/svg%3E",
  },
  {
    id: "3",
    name: "Ocean",
    path: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    thumb:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80'%3E%3Cdefs%3E%3ClinearGradient id='grad3' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%234facfe;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%2300f2fe;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='120' height='80' fill='url(%23grad3)'/%3E%3C/svg%3E",
  },
  {
    id: "4",
    name: "Forest",
    path: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    thumb:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80'%3E%3Cdefs%3E%3ClinearGradient id='grad4' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%2343e97b;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%2338f9d7;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='120' height='80' fill='url(%23grad4)'/%3E%3C/svg%3E",
  },
  {
    id: "5",
    name: "Sunrise",
    path: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    thumb:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80'%3E%3Cdefs%3E%3ClinearGradient id='grad5' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23fa709a;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23fee140;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='120' height='80' fill='url(%23grad5)'/%3E%3C/svg%3E",
  },
  {
    id: "6",
    name: "Purple Haze",
    path: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    thumb:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80' viewBox='0 0 120 80'%3E%3Cdefs%3E%3ClinearGradient id='grad6' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23a8edea;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23fed6e3;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='120' height='80' fill='url(%23grad6)'/%3E%3C/svg%3E",
  },
];

interface WallpaperSettingsProps {
  wallpaper: string | null;
  onWallpaperChange: (path: string | null) => void;
}

export const WallpaperSettings: React.FC<WallpaperSettingsProps> = ({
  wallpaper,
  onWallpaperChange,
}) => {
  const handleBrowseWallpaper = async () => {
    const result = await open({
      multiple: false,
      directory: false,
      title: "Select Wallpaper",
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] }],
    });
    if (result && typeof result === "string") {
      onWallpaperChange(result);
    }
  };

  const handleClearWallpaper = () => {
    onWallpaperChange(null);
  };

  return (
    <div className="modal-section">
      <label className="modal-label">Wallpaper</label>
      <span className="modal-input-hint">Choose a wallpaper for the app background.</span>

      {/* 预置壁纸 */}
      <div style={{ marginTop: "12px" }}>
        <label className="modal-label" style={{ fontSize: "0.9rem" }}>
          Preset Wallpapers
        </label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          {PRESET_WALLPAPERS.map((wp) => (
            <div
              key={wp.id}
              style={{
                cursor: "pointer",
                borderRadius: "8px",
                overflow: "hidden",
                border: `2px solid ${
                  wallpaper === wp.path ? "var(--primary-5)" : "transparent"
                }`,
                transition: "border-color var(--transition-fast)",
              }}
              onClick={() => onWallpaperChange(wp.path)}
            >
              <img
                src={wp.thumb}
                alt={wp.name}
                style={{
                  width: "100%",
                  height: "80px",
                  objectFit: "cover",
                }}
              />
              <div
                style={{
                  padding: "4px 8px",
                  fontSize: "0.8rem",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                {wp.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 自定义壁纸 */}
      <div style={{ marginTop: "20px" }}>
        <label className="modal-label" style={{ fontSize: "0.9rem" }}>
          Custom Wallpaper
        </label>
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: "8px",
          }}
        >
          <input
            className="modal-input"
            style={{ flex: 1, minWidth: "240px" }}
            placeholder="No wallpaper selected"
            value={wallpaper || ""}
            readOnly
          />
          <button type="button" className="btn-secondary" onClick={handleBrowseWallpaper}>
            Browse...
          </button>
          {wallpaper && (
            <button type="button" className="btn-secondary" onClick={handleClearWallpaper}>
              Clear
            </button>
          )}
        </div>
        {wallpaper && !PRESET_WALLPAPERS.find((wp) => wp.path === wallpaper) && (
          <div style={{ marginTop: "12px" }}>
            <img
              src={wallpaperUrl(wallpaper)}
              alt="Wallpaper preview"
              style={{
                maxWidth: "200px",
                maxHeight: "120px",
                borderRadius: "8px",
                objectFit: "cover",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
