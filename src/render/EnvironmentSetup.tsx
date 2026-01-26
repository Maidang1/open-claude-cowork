import { useEffect, useRef, useState } from "react";

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

type NodeRuntimePreference = "custom";

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
    useState<NodeRuntimePreference>("custom");
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
      if (runtime === "custom") {
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

      const versionMatch = result.node.version?.match(/^v?(\d+)/);
      const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;

      if (result.node.installed && majorVersion >= MIN_NODE_VERSION) {
        setStatus("ready");
        setTimeout(() => onReady(), 500);
      } else if (!result.node.installed) {
        setStatus("missing");
      } else {
        setStatus("outdated");
      }

      if (!result.npm.installed) {
        console.warn(
          "[EnvSetup] npm not detected; agent installs may require manual setup.",
        );
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

  envStatus?.platform === "win32"
    ? "Requires PowerShell and may prompt for administrator approval."
    : "Uses nvm under your login shell; PATH will be updated automatically.";

  envStatus?.platform === "darwin"
    ? "macOS"
    : envStatus?.platform === "win32"
      ? "Windows"
      : envStatus?.platform === "linux"
        ? "Linux"
        : "your system";

  const canAutoInstall = Boolean(
    envStatus && getInstallSteps(envStatus.platform).length > 0,
  );

  const summaryTitle =
    status === "outdated"
      ? "Node.js Update Required"
      : "Node.js Installation Needed";
  const summaryMessage =
    status === "outdated"
      ? `Detected ${envStatus?.node.version ?? "an older version"}. Please upgrade to Node.js ${MIN_NODE_VERSION}+ to continue.`
      : `Open Claude Cowork needs a system-wide Node.js ${MIN_NODE_VERSION}+ runtime (plus npm) to run ACP agents. Install Node or point us to an existing binary.`;
  const statusIcon = status === "outdated" ? "⏱️" : "🛠️";

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 px-10 py-12 text-center shadow-[0_30px_80px_rgba(8,7,20,0.6)]">
          <div className="mb-6 flex items-center justify-center">
            <div className="h-14 w-14 rounded-2xl border border-white/10 bg-white/10 flex items-center justify-center">
              <span className="text-2xl animate-spin">⏳</span>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-white">
            Checking your environment…
          </h1>
          <p className="mt-3 text-white/70">
            Detecting Node.js and npm on this machine. This usually takes just a
            moment.
          </p>
        </div>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-green-500/30 bg-green-500/10 px-10 py-12 text-center shadow-[0_30px_80px_rgba(34,197,94,0.35)]">
          <div className="text-5xl mb-5">✅</div>
          <h1 className="text-2xl font-semibold text-white">
            Environment Ready
          </h1>
          <p className="mt-3 text-white/80">
            Detected Node.js {envStatus?.node.version} with npm{" "}
            {envStatus?.npm.version}. Launching the app…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-white/5 shadow-[0_30px_90px_rgba(8,7,20,0.65)] overflow-hidden backdrop-blur-md">
        <div className="grid gap-0 lg:grid-cols-[2fr_3fr]">
          <section className="border-b border-white/10 bg-white/5 p-8 text-white space-y-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start gap-4">
              <div className="text-4xl">{statusIcon}</div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                  Environment
                </p>
                <h2 className="text-2xl font-semibold mt-2">{summaryTitle}</h2>
                <p className="text-white/70 mt-3 leading-relaxed">
                  {summaryMessage}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: "Node.js", value: envStatus?.node.version ?? "—" },
                { label: "npm", value: envStatus?.npm.version ?? "—" },
                {
                  label: "Platform",
                  value: envStatus
                    ? `${envStatus.platform} · ${envStatus.arch}`
                    : "Detecting…",
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                >
                  <span className="text-white/70">{row.label}</span>
                  <span className="font-mono text-white">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-3">
              <button
                type="button"
                onClick={checkEnvironment}
                disabled={installing}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 disabled:opacity-50"
              >
                <span>🔄</span> Refresh Detection
              </button>
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                disabled={installing}
                className="inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white disabled:opacity-50"
              >
                {showAdvanced ? "Hide Advanced" : "Advanced Options"}
                <span>{showAdvanced ? "▲" : "▼"}</span>
              </button>
            </div>
          </section>

          <section className="p-8 space-y-8 bg-[#05070f]/40 backdrop-blur-lg text-white">
            <div>
              <h3 className="text-xl font-semibold">
                Install or Configure Node.js
              </h3>
              <p className="mt-2 text-white/70 text-sm leading-relaxed">
                Use the guided installer or point us to an existing Node.js
                binary. You need Node.js {MIN_NODE_VERSION}+ plus npm to run
                agents locally.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleInstall}
                disabled={!canAutoInstall || installing}
                className="w-full rounded-2xl bg-gradient-to-r from-[#f97316] to-[#fb923c] py-4 text-base font-semibold shadow-[0_12px_35px_rgba(249,115,22,0.35)] transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {installing
                  ? "Installing Node.js…"
                  : `Install Node.js on ${platformName}`}
              </button>
              <p className="text-xs text-white/60">{installHint}</p>
              {!canAutoInstall && (
                <p className="text-xs text-amber-300/80">
                  Auto-install is unavailable on this platform. Please install
                  Node.js manually and re-run detection.
                </p>
              )}
            </div>

            {(installing || installSteps.length > 0) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Installation Progress</h4>
                  <span className="text-xs uppercase tracking-widest text-white/60">
                    {installing ? "Running" : "History"}
                  </span>
                </div>
                <div
                  ref={outputRef}
                  className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1"
                >
                  {installSteps.map((step, index) => (
                    <div
                      key={index}
                      className={`rounded-2xl border px-4 py-3 text-sm ${
                        step.status === "running"
                          ? "border-blue-500/50 bg-blue-500/10"
                          : step.status === "success"
                            ? "border-green-500/40 bg-green-500/10"
                            : step.status === "error"
                              ? "border-red-500/40 bg-red-500/10"
                              : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{step.name}</span>
                        <span className="text-white/70">
                          {step.status === "pending" && "Pending"}
                          {step.status === "running" && "Running…"}
                          {step.status === "success" && "Done"}
                          {step.status === "error" && "Failed"}
                        </span>
                      </div>
                      <code className="mt-2 block rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-white/70">
                        {step.command}
                      </code>
                      {step.output && (
                        <pre className="mt-2 rounded-lg bg-black/60 px-3 py-2 font-mono text-xs text-white/60 whitespace-pre-wrap break-words">
                          {step.output}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>

                {installError && (
                  <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    <p>Installation failed: {installError}</p>
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-red-500/80 px-3 py-2 text-xs font-semibold text-white"
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
                  installSteps.length > 0 &&
                  installSteps.every((s) => s.status === "success") && (
                    <div className="rounded-2xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-100">
                      Installation completed! Re-checking your environment…
                    </div>
                  )}
              </div>
            )}

            {showAdvanced && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                <div>
                  <h4 className="font-semibold text-white">
                    Custom Node.js Path
                  </h4>
                  <p className="text-sm text-white/70 mt-1">
                    If Node.js is installed but not on PATH, point directly to
                    the executable.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <input
                    type="text"
                    className="flex-1 min-w-[220px] rounded-xl border border-white/20 bg-black/40 px-4 py-2 font-mono text-sm text-white focus:border-white/60 focus:outline-none disabled:opacity-50"
                    placeholder="/usr/local/bin/node"
                    value={customNodePath}
                    onChange={(e) => setCustomNodePath(e.target.value)}
                    disabled={runtimeSaving || installing}
                  />
                  <button
                    type="button"
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:border-white/40 disabled:opacity-50"
                    onClick={handleBrowseNodePath}
                    disabled={runtimeSaving || installing}
                  >
                    Browse…
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                    onClick={handleValidateCustomPath}
                    disabled={
                      !customNodePath.trim() ||
                      validating ||
                      runtimeSaving ||
                      installing
                    }
                  >
                    {validating ? "Validating…" : "Save Path"}
                  </button>
                </div>
                <p className="text-xs text-white/50">
                  App restart is required after changing the runtime.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
