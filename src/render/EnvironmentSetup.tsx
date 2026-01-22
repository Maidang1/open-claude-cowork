import { useState, useEffect, useRef } from "react";
import "./EnvironmentSetup.css";

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
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
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
      checkEnvironment();
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
      <div className="env-setup">
        <div className="env-setup-container">
          <div className="env-setup-icon checking">⏳</div>
          <h1>Checking Environment...</h1>
          <p>Detecting Node.js installation on your system</p>
        </div>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="env-setup">
        <div className="env-setup-container">
          <div className="env-setup-icon success">✓</div>
          <h1>Environment Ready!</h1>
          <p>Node.js {envStatus?.node.version} detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="env-setup">
      <div className="env-setup-container wide">
        <div className="env-setup-icon warning">⚠️</div>
        <h1>
          {status === "outdated"
            ? "Node.js Update Required"
            : "Node.js Not Found"}
        </h1>

        {status === "outdated" ? (
          <p className="env-setup-desc">
            Your Node.js version ({envStatus?.node.version}) is outdated.
            <br />
            Please install Node.js {MIN_NODE_VERSION} or later.
          </p>
        ) : (
          <p className="env-setup-desc">
            This application requires Node.js {MIN_NODE_VERSION}+ and a package
            manager (npm) to run agents.
            <br />
            Please install Node.js to continue.
          </p>
        )}

        {/* One-click install section */}
        {!installing && !installError && installSteps.length === 0 && (
          <div className="install-oneclick">
            <button
              type="button"
              className="install-btn primary"
              onClick={handleInstall}
            >
              🚀 One-Click Install Node.js on {platformName}
            </button>
            <p className="install-hint">
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
          <div className="install-progress">
            <h2>Installation Progress</h2>
            <div className="install-steps">
              {installSteps.map((step, index) => (
                <div key={index} className={`install-step ${step.status}`}>
                  <div className="step-header">
                    <span className="step-status">
                      {step.status === "pending" && "⏳"}
                      {step.status === "running" && "🔄"}
                      {step.status === "success" && "✅"}
                      {step.status === "error" && "❌"}
                    </span>
                    <span className="step-name">{step.name}</span>
                  </div>
                  <code className="step-command">{step.command}</code>
                  {step.output && (
                    <pre className="step-output">{step.output}</pre>
                  )}
                </div>
              ))}
            </div>

            {installError && (
              <div className="install-error">
                <p>❌ Installation failed: {installError}</p>
                <button
                  type="button"
                  className="retry-btn"
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
                <div className="install-success">
                  <p>✅ Installation completed! Checking environment...</p>
                </div>
              )}
          </div>
        )}

        <div className="env-setup-actions">
          <button
            type="button"
            className="refresh-btn"
            onClick={checkEnvironment}
            disabled={installing}
          >
            🔄 Refresh Detection
          </button>

          <button
            type="button"
            className="advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
            disabled={installing}
          >
            {showAdvanced ? "▲ Hide Advanced" : "▼ Advanced Options"}
          </button>
        </div>

        {showAdvanced && (
          <div className="advanced-options">
            <h3>Node Runtime</h3>
            <p>Choose which Node.js runtime to use for agents.</p>
            <div className="runtime-toggle">
              <button
                type="button"
                className={nodeRuntime === "bundled" ? "active" : ""}
                onClick={() => handleRuntimeChange("bundled")}
                disabled={runtimeSaving || installing}
              >
                Bundled (Electron)
              </button>
              <button
                type="button"
                className={nodeRuntime === "custom" ? "active" : ""}
                onClick={() => handleRuntimeChange("custom")}
                disabled={runtimeSaving || installing}
              >
                Custom Path
              </button>
            </div>
            <div className="runtime-hint">
              Restart required to apply changes.
            </div>

            <h3 style={{ marginTop: "16px" }}>Custom Node.js Path</h3>
            <p>
              If Node.js is installed but not in your PATH, specify its
              location:
            </p>
            <div className="custom-path-input">
              <input
                type="text"
                placeholder="/path/to/node"
                value={customNodePath}
                onChange={(e) => setCustomNodePath(e.target.value)}
                disabled={
                  nodeRuntime !== "custom" || runtimeSaving || installing
                }
              />
              <button
                type="button"
                onClick={handleBrowseNodePath}
                disabled={
                  nodeRuntime !== "custom" || runtimeSaving || installing
                }
              >
                Browse...
              </button>
              <button
                type="button"
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
