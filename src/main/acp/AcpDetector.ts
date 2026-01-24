import type { AgentPlugin } from "@src/types/acpTypes";
import { ACP_BACKENDS_ALL, POTENTIAL_ACP_CLIS } from "@src/types/acpTypes";
import { enrichPathFromLoginShell } from "../utils/node-runtime";
import { getLocalAgentBin, resolveSystemCommand } from "../utils/shell";

export type CliDetectionResult = {
  command: string;
  path: string | null;
  source: "local" | "system" | "missing";
};

export class AcpDetector {
  private initialized = false;
  private detected = new Map<string, CliDetectionResult>();

  async initialize() {
    if (this.initialized) return;
    await enrichPathFromLoginShell();
    await this.refresh();
    this.initialized = true;
  }

  async refresh() {
    this.detected.clear();
    for (const command of POTENTIAL_ACP_CLIS) {
      const result = await this.detectCliPath(command);
      this.detected.set(command, result);
    }
  }

  async detectCliPath(command: string): Promise<CliDetectionResult> {
    const cached = this.detected.get(command);
    if (cached) {
      return cached;
    }

    const local = getLocalAgentBin(command);
    if (local) {
      const result = { command, path: local, source: "local" } as const;
      this.detected.set(command, result);
      return result;
    }

    const system = await resolveSystemCommand(command);
    if (system) {
      const result = { command, path: system, source: "system" } as const;
      this.detected.set(command, result);
      return result;
    }

    const result = { command, path: null, source: "missing" } as const;
    this.detected.set(command, result);
    return result;
  }

  async getAvailableAgents(customAgents: AgentPlugin[] = []) {
    if (!this.initialized) {
      await this.initialize();
    }

    const agents = [...ACP_BACKENDS_ALL, ...customAgents];
    const results = await Promise.all(
      agents.map(async (agent) => {
        const command = agent.checkCommand || agent.defaultCommand.split(" ")[0];
        const detection = command ? await this.detectCliPath(command) : null;
        return {
          ...agent,
          available: Boolean(detection?.path),
          cliPath: detection?.path ?? null,
        };
      }),
    );

    return results;
  }
}

export const acpDetector = new AcpDetector();

export const initializeAcpDetector = async () => {
  await acpDetector.initialize();
};
