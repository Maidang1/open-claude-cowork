import { useCallback, useEffect, useState } from "react";
import type { AgentPlugin } from "../agents/types";

export type InstallStatus =
  | "checking"
  | "installed"
  | "not-installed"
  | "installing";

interface AgentInstallState {
  installStatus: InstallStatus;
  installedVersion: string | null;
}

interface AgentInstallActions {
  checkInstall: (plugin: AgentPlugin) => Promise<void>;
  install: () => Promise<void>;
}

export function useAgentInstall(
  selectedPlugin: AgentPlugin | null | undefined,
  isOpen: boolean,
  onCommandChange: (command: string) => void,
): AgentInstallState & AgentInstallActions {
  const [installStatus, setInstallStatus] = useState<InstallStatus>("checking");
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);

  const checkInstall = useCallback(async (plugin: AgentPlugin) => {
    if (!plugin.checkCommand || !plugin.packageSpec) {
      setInstallStatus("installed");
      return;
    }

    setInstallStatus("checking");
    setInstalledVersion(null);
    try {
      const res = await window.electron.invoke("agent:check-command", plugin.checkCommand);
      if (res.installed) {
        const versionRes = await window.electron.invoke(
          "agent:get-package-version",
          plugin.packageSpec,
        );
        if (versionRes.success && versionRes.version) {
          setInstalledVersion(versionRes.version);
        }
        setInstallStatus("installed");
      } else {
        setInstallStatus("not-installed");
      }
    } catch {
      setInstallStatus("not-installed");
      setInstalledVersion(null);
    }
  }, []);

  const install = useCallback(async () => {
    if (!selectedPlugin?.packageSpec) return;

    setInstallStatus("installing");
    try {
      const res = await window.electron.invoke(
        "agent:install",
        `${selectedPlugin.packageSpec}@latest`,
      );
      if (res.success) {
        setInstallStatus("installed");
        setInstalledVersion(null);
        checkInstall(selectedPlugin);
        onCommandChange(selectedPlugin.defaultCommand);
      } else {
        alert(`Installation failed: ${res.error}`);
        setInstallStatus("not-installed");
      }
    } catch {
      setInstallStatus("not-installed");
    }
  }, [selectedPlugin, checkInstall, onCommandChange]);

  useEffect(() => {
    if (selectedPlugin && isOpen && selectedPlugin.packageSpec) {
      checkInstall(selectedPlugin);
    }
  }, [selectedPlugin, isOpen, checkInstall]);

  return {
    installStatus,
    installedVersion,
    checkInstall,
    install,
  };
}
