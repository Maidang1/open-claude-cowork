import { useState, useEffect, useRef } from "react";

type EnvStatus = {
  node: {
    installed: boolean;
    version: string | null;
    path: string | null;
  };
  npm: {
    installed: boolean;
    version: string | null;
  };
  platform: string;
  arch: string;
};

type Props = {
  onReady: () => void;
};

type InstallStep = {
  name: string;
  command: string;
  status: "pending" | "running" | "success" | "error";
  output?: string;
};

type NodeRuntimePreference = "bundled" | "custom";

const MIN_NODE_VERSION = 18;

const getInstallSteps = (platform: string): InstallStep[] => {
  switch (platform) {
    case "darwin":
      return [
        {
          name: "Install nvm (Node Version Manager)",
          command:
            "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash",
          status: "pending",
        },
        {
          name: "Install Node.js LTS",
          command: "nvm install --lts",
          status: "pending",
        },
      ];
    case "win32":
      return [
        {
          name: "Install Chocolatey",
          command:
            'powershell -c "irm https://community.chocolatey.org/install.ps1|iex"',
          status: "pending",
        },
        {
          name: "Install Node.js LTS",
          command: "choco install nodejs-lts -y",
          status: "pending",
        },
      ];
    case "linux":
      return [
        {
          name: "Install nvm (Node Version Manager)",
          command:
            "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash",
          status: "pending",
        },
        {
          name: "Install Node.js LTS",
          command: "nvm install --lts",
          status: "pending",
        },
      ];
    default:
      return [];
  }
};

export default function EnvironmentSetup({ onReady }: Props) {
  const [status, setStatus] = useState<
    "checking" | "missing" | "outdated" | "ready"
  >("checking");
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [nodeRuntime, setNodeRuntime] =
    useState<NodeRuntimePreference>("bundled");
  const [customNodePath, setCustomNodePath] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validating, setValidating] = useState(false);
  const [runtimeSaving, setRuntimeSaving] = useState(false);

  // Installation state
  const [installing, setInstalling] = useState(false);
  const [installSteps, setInstallSteps] = useState<InstallStep[]>([]);
  const [_currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [installError, setInstallError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkEnvironment();
    loadRuntimeSettings();
  }, []);

  const loadRuntimeSettings = async () => {
    try {
      const runtime = await window.electron.invoke("env:get-node-runtime");
      if (runtime === "bundled" || runtime === "custom") {
        setNodeRuntime(runtime);
      }
      const storedPath = await window.electron.invoke(
        "env:get-custom-node-path",
      );
      if (storedPath) {
        setCustomNodePath(storedPath);
      }
    } catch (e) {
      console.error("Failed to load runtime settings:", e);
    }
  };

  const checkEnvironment = async () => {
    setStatus("checking");
    try {
      const result = await window.electron.invoke("env:check");
      setEnvStatus(result);

      if (result.node.installed && result.npm.installed) {
        // Check version
        const versionMatch = result.node.version?.match(/^v?(\d+)/);
        const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;

        if (majorVersion >= MIN_NODE_VERSION) {
          setStatus("ready");
          // Small delay to show success state
          setTimeout(() => onReady(), 500);
        } else {
          setStatus("outdated");
        }
      } else {
        setStatus("missing");
      }
    } catch (e) {
      console.error("Environment check failed:", e);
      setStatus("missing");
    }
  };

  const handleRuntimeChange = async (runtime: NodeRuntimePreference) => {
    setNodeRuntime(runtime);
    setRuntimeSaving(true);
    try {
      const res = await window.electron.invoke("env:set-node-runtime", runtime);
      if (res?.success === false) {
        throw new Error(res.error || "Failed to save runtime");
      }
      check;
    } catch (e: any) {
      alert(e.message || "Failed to update runtime");
    } finally {
      setRuntimeSaving(false);
    }
  };

  const handleBrowseNodePath = async () => {
    const result = await window.electron.invoke("dialog:openFile", {
      title: "Select Node.js executable",
      filters: [
        {
          name: "Executable",
          extensions: process.platform === "win32" ? ["exe"] : ["*"],
        },
      ],
    });
    if (result) {
      setCustomNodePath(result);
    }
  };

  const handleValidateCustomPath = async () => {
    if (!customNodePath.trim()) return;

    setValidating(true);
    try {
      const result = await window.electron.invoke(
        "env:validate-node-path",
        customNodePath,
      );
      if (result.valid) {
        await window.electron.invoke("env:set-node-runtime", "custom");
        setNodeRuntime("custom");
        await window.electron.invoke(
          "env:set-custom-node-path",
          customNodePath,
        );
        checkEnvironment();
      } else {
        alert(result.error || "Invalid Node.js path");
      }
    } catch (e: any) {
      alert(e.message || "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  // One-click install handler
  const handleInstall = async () => {
    if (!envStatus) return;

    const steps = getInstallSteps(envStatus.platform);
    if (steps.length === 0) {
      setInstallError("Auto-installation is not supported on this platform");
      return;
    }

    setInstalling(true);
    setInstallSteps(steps);
    setInstallError(null);
    setCurrentStepIndex(0);

    for (let i = 0; i < steps.length; i++) {
      setCurrentStepIndex(i);
      setInstallSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: "running" } : s)),
      );

      try {
        const result = await window.electron.invoke(
          "env:run-install-command",
          steps[i].command,
        );

        setInstallSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "success", output: result.output } : s,
          ),
        );
      } catch (e: any) {
        setInstallSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "error", output: e.message } : s,
          ),
        );
        setInstallError(e.message || "Installation failed");
        setInstalling(false);
        return;
      }
    }

    setInstalling(false);
    // Re-check environment after installation
    setTimeout(() => {
      checkEnvironment();
    }, 1000);
  };

  // Scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [installSteps]);

  const platformName =
    envStatus?.platform === "darwin"
      ? "macOS"
      : envStatus?.platform === "win32"
        ? "Windows"
        : envStatus?.platform === "linux"
          ? "Linux"
          : "your system";

  const installHint =
    envStatus?.platform === "win32"
      ? "Requires PowerShell and may prompt for administrator approval."
      : "Uses nvm under your login shell; PATH will be updated automatically.";

  if (status === "checking") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-5">
        <div className="bg-white/5 rounded-2xl p-10 text-center max-w-sm w-full border border-white/10">
          <div className="text-5xl mb-5 animate-pulse">⏳</div>
          <h1 className="text-white text-2xl font-semibold mb-3">
            Checking Environment...
          </h1>
          <p className="text-white/70">
            Detecting Node.js installation on your system
          </p>
        </div>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-5">
        <div className="bg-white/5 rounded-2xl p-10 text-center max-w-sm w-full border border-white/10">
          <div className="text-[#4ade80] text-6xl mb-5">✓</div>
          <h1 className="text-white text-2xl font-semibold mb-3">
            Environment Ready!
          </h1>
          <p className="text-white/70">
            Node.js {envStatus?.node.version} detected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-5">
      <div className="bg-white/5 rounded-2xl p-10 text-center max-w-lg w-full border border-white/10">
        <div className="text-6xl mb-">⚠️</div>
        <h1 className="text-white text-2xl font-semibold mb-3">
          {status === "outdated"
            ? "Node.js Update Required"
            : "Node.js Not Found"}
        </h1>

        {status === "outdated" ? (
          <p className="text-white/70 mb-6">
            Your Node.js version ({envStatus?.node.version}) is outdated.
            <br />
            Please install Node.js {MIN_NODE_VERSION} or later.
          </p>
        ) : (
          <p className="text-white/70 mb-6">
            This application requires Node.js {MIN_NODE_VERSION}+ and a package
            manager (npm) to run agents.
            <br />
            Please install Node.js to continue.
          </p>
        )}

        {/* One-click install section */}
        {!installing && !installError && installSteps.length === 0 && (
          <div className="my-6 text-center">
            <button
              type="button"
              className="bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white border-none rounded-xl py-3.5 px-7 text-base font-semibold cursor-pointer transition-all shadow-[0_4px_15px_rgba(34,197,94,0.3)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(34,197,94,0.4)]"
              onClick={handleInstall}
            >
              🚀 One-Click Install Node.js on {platformName}
            </button>
            <p className="text-white/50 text-xs mt-3">
              {envStatus?.platform === "win32"
                ? "This will install Chocolatey and Node.js LTS"
                : "This will install nvm and Node.js LTS"}
              <br />
              {installHint}
            </p>
          </div>
        )}

        {/* Installation progress */}
        {(installing || installSteps.length > 0) && (
          <div className="my-6">
            <h2 className="text-white text-base mb-4">Installation Progress</h2>
            <div className="flex flex-col gap-3">
              {installSteps.map((step, index) => (
                <div
                  key={index}
                  className={`bg-black/20 rounded-lg p-3 pl-4 border-l-3 border-l-white/20 transition-all ${
                    step.status === "running"
                      ? "border-l-blue-500 bg-blue-500/10"
                      : step.status === "success"
                        ? "border-l-green-500"
                        : step.status === "error"
                          ? "border-l-red-500 bg-red-500/10"
                          : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-base">
                      {step.status === "pending" && "⏳"}
                      {step.status === "running" && "🔄"}
                      {step.status === "success" && "✅"}
                      {step.status === "error" && "❌"}
                    </span>
                    <span className="text-white text-sm font-medium">
                      {step.name}
                    </span>
                  </div>
                  <code className="block bg-black/30 rounded px-2.5 py-2 font-mono text-xs text-white/70 mt-2 overflow-x-auto whitespace-nowrap">
                    {step.command}
                  </code>
                  {step.output && (
                    <pre className="bg-black/40 rounded p-2.5 mt-2 font-mono text-xs text-white/60 max-h-36 overflow-y-auto whitespace-pre-wrap break-all">
                      {step.output}
                    </pre>
                  )}
                </div>
              ))}
            </div>

            {installError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-4 text-center">
                <p className="text-red-400 mb-3">
                  ❌ Installation failed: {installError}
                </p>
                <button
                  type="button"
                  className="bg-red-500 text-white border-none rounded-lg px-4 py-2 text-sm cursor-pointer transition-colors hover:bg-red-600"
                  onClick={() => {
                    setInstallSteps([]);
                    setInstallError(null);
                  }}
                >
                  Try Again
                </button>
              </div>
            )}

            {!installing &&
              !installError &&
              installSteps.every((s) => s.status === "success") && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mt-4 text-center">
                  <p className="text-green-400">
                    ✅ Installation completed! Checking environment...
                  </p>
                </div>
              )}
          </div>
        )}

        <div className="flex gap-3 justify-center mt-6 flex-wrap">
          <button
            type="button"
            className="bg-white/10 text-white border border-white/20 rounded-lg px-5 py-2.5 text-sm cursor-pointer transition-all hover:bg-white/15 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={checkEnvironment}
            disabled={installing}
          >
            🔄 Refresh Detection
          </button>

          <button
            type="button"
            className="bg-none text-white/50 border-none px-2.5 py-2.5 text-sm cursor-pointer transition-colors hover:text-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={installing}
          >
            {showAdvanced ? "▲ Hide Advanced" : "▼ Advanced Options"}
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-5 pt-5 border-t border-white/10 text-left">
            <h3 className="text-white text-sm font-medium mb-2">
              Node Runtime
            </h3>
            <p className="text-white/70 text-sm mb-3">
              Choose which Node.js runtime to use for agents.
            </p>
            <div className="flex gap-2 flex-wrap my-2">
              <button
                type="button"
                className={`bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm cursor-pointer transition-all ${
                  nodeRuntime === "bundled" ? "bg-blue-500 border-blue-500" : ""
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={() => handleRuntimeChange("bundled")}
                disabled={runtimeSaving || installing}
              >
                Bundled (Electron)
              </button>
              <button
                type="button"
                className={`bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm cursor-pointer transition-all ${
                  nodeRuntime === "custom" ? "bg-blue-500 border-blue-500" : ""
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                onClick={() => handleRuntimeChange("custom")}
                disabled={runtimeSaving || installing}
              >
                Custom Path
              </button>
            </div>
            <div className="text-white/50 text-xs mb-3">
              Restart required to apply changes.
            </div>

            <h3 className="text-white text-sm font-medium mb-2 mt-4">
              Custom Node.js Path
            </h3>
            <p className="text-white/70 text-sm mb-3">
              If Node.js is installed but not in your PATH, specify its
              location:
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                className="flex-1 min-w-52 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white font-mono text-sm placeholder:text-white/30 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-blue-500"
                placeholder="/path/to/node"
                value={customNodePath}
                onChange={(e) => setCustomNodePath(e.target.value)}
                disabled={
                  nodeRuntime !== "custom" || runtimeSaving || installing
                }
              />
              <button
                type="button"
                className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm cursor-pointer transition-all hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                onClick={handleBrowseNodePath}
                disabled={
                  nodeRuntime !== "custom" || runtimeSaving || installing
                }
              >
                Browse...
              </button>
              <button
                type="button"
                className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm cursor-pointer transition-all hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                onClick={handleValidateCustomPath}
                disabled={
                  nodeRuntime !== "custom" ||
                  !customNodePath.trim() ||
                  validating ||
                  runtimeSaving ||
                  installing
                }
              >
                {validating ? "Validating..." : "Apply"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
