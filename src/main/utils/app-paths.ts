import path from "node:path";
import os from "node:os";

const getDefaultAppDataRoot = () => {
  if (process.platform === "win32") {
    return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support");
  }
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
};

export const getAppDataDir = () => {
  const envDir =
    process.env.TAURI_APP_DATA_DIR || process.env.APP_DATA_DIR || process.env.APP_DATA_PATH;
  if (envDir) {
    return envDir;
  }

  const root = getDefaultAppDataRoot();
  return path.join(root, "open-claude-cowork");
};
