(() => {
"use strict";
var __webpack_modules__ = ({
"./src/main/acp/Client.ts"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  ACPClient: () => (ACPClient)
});
/* import */ var node_child_process__rspack_import_0 = __webpack_require__("node:child_process");
/* import */ var node_child_process__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(node_child_process__rspack_import_0);
/* import */ var node_fs_promises__rspack_import_1 = __webpack_require__("node:fs/promises");
/* import */ var node_fs_promises__rspack_import_1_default = /*#__PURE__*/__webpack_require__.n(node_fs_promises__rspack_import_1);
/* import */ var node_path__rspack_import_2 = __webpack_require__("node:path");
/* import */ var node_path__rspack_import_2_default = /*#__PURE__*/__webpack_require__.n(node_path__rspack_import_2);
/* import */ var node_stream__rspack_import_3 = __webpack_require__("node:stream");
/* import */ var node_stream__rspack_import_3_default = /*#__PURE__*/__webpack_require__.n(node_stream__rspack_import_3);
/* import */ var node_util__rspack_import_4 = __webpack_require__("node:util");
/* import */ var node_util__rspack_import_4_default = /*#__PURE__*/__webpack_require__.n(node_util__rspack_import_4);
/* import */ var _agentclientprotocol_sdk__rspack_import_5 = __webpack_require__("./node_modules/.pnpm/@agentclientprotocol+sdk@0.13.0_zod@4.3.5/node_modules/@agentclientprotocol/sdk/dist/acp.js");






const execAsync = (0,node_util__rspack_import_4.promisify)(node_child_process__rspack_import_0.exec);
const normalizeModelsFromConfigOptions = (configOptions)=>{
    if (!Array.isArray(configOptions)) return null;
    for (const option of configOptions){
        if ((option === null || option === void 0 ? void 0 : option.category) !== "model" || (option === null || option === void 0 ? void 0 : option.type) !== "select") {
            continue;
        }
        const groupsOrOptions = option === null || option === void 0 ? void 0 : option.options;
        if (!Array.isArray(groupsOrOptions)) {
            continue;
        }
        const models = [];
        for (const entry of groupsOrOptions){
            if (Array.isArray(entry === null || entry === void 0 ? void 0 : entry.options)) {
                for (const opt of entry.options){
                    if ((opt === null || opt === void 0 ? void 0 : opt.value) && (opt === null || opt === void 0 ? void 0 : opt.name)) {
                        models.push({
                            modelId: opt.value,
                            name: opt.name,
                            description: opt.description ?? null
                        });
                    }
                }
            } else if ((entry === null || entry === void 0 ? void 0 : entry.value) && (entry === null || entry === void 0 ? void 0 : entry.name)) {
                models.push({
                    modelId: entry.value,
                    name: entry.name,
                    description: entry.description ?? null
                });
            }
        }
        if (models.length > 0) {
            return {
                models,
                currentModelId: option.currentValue ?? null
            };
        }
    }
    return null;
};
const extractTokenUsage = (payload)=>{
    var _payload__meta, _payload__meta1, _payload__meta2;
    const candidates = [
        payload,
        payload === null || payload === void 0 ? void 0 : payload.usage,
        payload === null || payload === void 0 ? void 0 : payload.tokenUsage,
        payload === null || payload === void 0 ? void 0 : payload.tokens,
        payload === null || payload === void 0 ? void 0 : (_payload__meta = payload._meta) === null || _payload__meta === void 0 ? void 0 : _payload__meta.usage,
        payload === null || payload === void 0 ? void 0 : (_payload__meta1 = payload._meta) === null || _payload__meta1 === void 0 ? void 0 : _payload__meta1.tokenUsage,
        payload === null || payload === void 0 ? void 0 : (_payload__meta2 = payload._meta) === null || _payload__meta2 === void 0 ? void 0 : _payload__meta2.tokens
    ];
    for (const candidate of candidates){
        if (!candidate || typeof candidate !== "object") {
            continue;
        }
        const promptTokens = candidate.promptTokens ?? candidate.prompt_tokens ?? candidate.input_tokens;
        const completionTokens = candidate.completionTokens ?? candidate.completion_tokens ?? candidate.output_tokens;
        const totalTokens = candidate.totalTokens ?? candidate.total_tokens ?? candidate.total;
        if (typeof promptTokens === "number" || typeof completionTokens === "number" || typeof totalTokens === "number") {
            return {
                promptTokens: typeof promptTokens === "number" ? promptTokens : undefined,
                completionTokens: typeof completionTokens === "number" ? completionTokens : undefined,
                totalTokens: typeof totalTokens === "number" ? totalTokens : undefined
            };
        }
    }
    return null;
};
class ACPClient {
    process = null;
    connection = null;
    // Callback now sends structured objects instead of strings
    onMessageCallback = null;
    activeSessionId = null;
    cwd = process.cwd();
    connected = false;
    agentCapabilities = null;
    pendingPermissions = new Map();
    constructor(onMessage){
        this.onMessageCallback = onMessage;
    }
    resolvePermission(id, response) {
        const resolver = this.pendingPermissions.get(id);
        if (resolver) {
            resolver(response);
            this.pendingPermissions.delete(id);
        } else {
            console.warn(`[Client] No pending permission found for id: ${id}`);
        }
    }
    async connect(command, args = [], cwd, env, options) {
        if (this.process) {
            await this.disconnect();
        }
        this.cwd = cwd || process.cwd();
        console.log(`[Client] Spawning agent: ${command} ${args.join(" ")} in ${this.cwd}`);
        this.process = (0,node_child_process__rspack_import_0.spawn)(command, args, {
            stdio: [
                "pipe",
                "pipe",
                "pipe"
            ],
            shell: true,
            cwd: this.cwd,
            env: env ? {
                ...process.env,
                ...env
            } : process.env
        });
        // Capture stderr
        if (this.process.stderr) {
            this.process.stderr.on("data", (data)=>{
                var _this_onMessageCallback, _this;
                const text = data.toString();
                console.error(`[Client] stderr: ${text}`);
                (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                    type: "system",
                    text: `System Error (stderr): ${text}`
                });
            });
        }
        this.process.on("error", (err)=>{
            var _this_onMessageCallback, _this;
            console.error("[Client] Process error:", err);
            (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                type: "system",
                text: `System: Agent process error: ${err.message}`
            });
            this.connected = false;
        });
        this.process.on("exit", (code)=>{
            var _this_onMessageCallback, _this;
            console.log(`[Client] Agent exited with code ${code}`);
            (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                type: "system",
                text: `System: Agent disconnected (code ${code}). Check if '${command}' is installed and in your PATH.`
            });
            this.process = null;
            this.connection = null;
            this.activeSessionId = null;
            this.connected = false;
            this.agentCapabilities = null;
        });
        // Create Stream (Node -> Web Stream adapter)
        if (!this.process.stdout || !this.process.stdin) {
            throw new Error("Failed to access process streams");
        }
        const input = node_stream__rspack_import_3.Readable.toWeb(this.process.stdout);
        const output = node_stream__rspack_import_3.Writable.toWeb(this.process.stdin);
        const stream = (0,_agentclientprotocol_sdk__rspack_import_5.ndJsonStream)(output, input);
        // Create Connection
        this.connection = new _agentclientprotocol_sdk__rspack_import_5.ClientSideConnection((_agent)=>({
                requestPermission: async (params)=>{
                    var _params_toolCall, // Notify UI about permission request and wait for response
                    _this_onMessageCallback, _this;
                    const options = params.options;
                    const permissionId = Math.random().toString(36).substring(7);
                    (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                        type: "permission_request",
                        id: permissionId,
                        tool: ((_params_toolCall = params.toolCall) === null || _params_toolCall === void 0 ? void 0 : _params_toolCall.title) || "Unknown Tool",
                        options: options
                    });
                    // Return a promise that resolves when UI responds
                    return new Promise((resolve)=>{
                        this.pendingPermissions.set(permissionId, resolve);
                    });
                },
                sessionUpdate: async (params)=>{
                    const update = params.update;
                    const sessionId = params.sessionId;
                    // Agent Text Message
                    if (update.sessionUpdate === "agent_message_chunk") {
                        if (update.content.type === "text") {
                            var _this_onMessageCallback, _this;
                            (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                                type: "agent_text",
                                sessionId,
                                text: update.content.text
                            });
                        }
                    } else if (update.sessionUpdate === "agent_thought_chunk") {
                        if (update.content.type === "text") {
                            var _this_onMessageCallback1, _this1;
                            (_this_onMessageCallback1 = (_this1 = this).onMessageCallback) === null || _this_onMessageCallback1 === void 0 ? void 0 : _this_onMessageCallback1.call(_this1, {
                                type: "agent_thought",
                                sessionId,
                                text: update.content.text
                            });
                        }
                    } else if (update.sessionUpdate === "tool_call") {
                        var _this_onMessageCallback2, _this2;
                        (_this_onMessageCallback2 = (_this2 = this).onMessageCallback) === null || _this_onMessageCallback2 === void 0 ? void 0 : _this_onMessageCallback2.call(_this2, {
                            type: "tool_call",
                            sessionId,
                            toolCallId: update.toolCallId,
                            name: update.title,
                            kind: update.kind,
                            status: update.status
                        });
                    } else if (update.sessionUpdate === "tool_call_update") {
                        var _this_onMessageCallback3, _this3;
                        (_this_onMessageCallback3 = (_this3 = this).onMessageCallback) === null || _this_onMessageCallback3 === void 0 ? void 0 : _this_onMessageCallback3.call(_this3, {
                            type: "tool_call_update",
                            sessionId,
                            toolCallId: update.toolCallId,
                            status: update.status
                        });
                    } else if (update.sessionUpdate === "available_commands_update") {
                        var _this_onMessageCallback4, _this4;
                        (_this_onMessageCallback4 = (_this4 = this).onMessageCallback) === null || _this_onMessageCallback4 === void 0 ? void 0 : _this_onMessageCallback4.call(_this4, {
                            type: "agent_info",
                            sessionId,
                            info: {
                                commands: update.availableCommands
                            }
                        });
                    } else if (update.sessionUpdate === "config_option_update") {
                        const modelUpdate = normalizeModelsFromConfigOptions(update.configOptions);
                        if (modelUpdate) {
                            var _this_onMessageCallback5, _this5;
                            (_this_onMessageCallback5 = (_this5 = this).onMessageCallback) === null || _this_onMessageCallback5 === void 0 ? void 0 : _this_onMessageCallback5.call(_this5, {
                                type: "agent_info",
                                sessionId,
                                info: modelUpdate
                            });
                        }
                    } else if (update.sessionUpdate === "plan") {
                        var _this_onMessageCallback6, _this6;
                        (_this_onMessageCallback6 = (_this6 = this).onMessageCallback) === null || _this_onMessageCallback6 === void 0 ? void 0 : _this_onMessageCallback6.call(_this6, {
                            type: "agent_plan",
                            sessionId,
                            plan: update
                        });
                    }
                },
                readTextFile: async (params)=>{
                    var _this_onMessageCallback, _this;
                    console.log(`[Client] readTextFile: ${params.path}`);
                    (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                        type: "tool_log",
                        text: `Reading file: ${params.path}`
                    });
                    try {
                        const content = await node_fs_promises__rspack_import_1_default().readFile(node_path__rspack_import_2_default().resolve(this.cwd, params.path), "utf-8");
                        return {
                            content
                        };
                    } catch (e) {
                        throw new Error(`Failed to read file: ${e.message}`);
                    }
                },
                writeTextFile: async (params)=>{
                    var _this_onMessageCallback, _this;
                    console.log(`[Client] writeTextFile: ${params.path}`);
                    (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                        type: "tool_log",
                        text: `Writing file: ${params.path}`
                    });
                    try {
                        await node_fs_promises__rspack_import_1_default().writeFile(node_path__rspack_import_2_default().resolve(this.cwd, params.path), params.content, "utf-8");
                        return {};
                    } catch (e) {
                        throw new Error(`Failed to write file: ${e.message}`);
                    }
                },
                extMethod: async (method, params)=>{
                    console.log(`[Client] ExtMethod call: ${method}`, params);
                    if (method === "runShellCommand") {
                        var _this_onMessageCallback, _this, _response_outcome;
                        const command = params.command;
                        // Reuse the permission request flow
                        const permissionId = Math.random().toString(36).substring(7);
                        (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                            type: "permission_request",
                            id: permissionId,
                            tool: "runShellCommand",
                            content: `Request to run shell command:\n${command}`,
                            options: [
                                {
                                    optionId: "allow",
                                    label: "Allow"
                                },
                                {
                                    optionId: "deny",
                                    label: "Deny"
                                }
                            ]
                        });
                        const response = await new Promise((resolve)=>{
                            this.pendingPermissions.set(permissionId, resolve);
                        });
                        if ((response === null || response === void 0 ? void 0 : (_response_outcome = response.outcome) === null || _response_outcome === void 0 ? void 0 : _response_outcome.outcome) === "selected" && response.outcome.optionId === "allow") {
                            var _this_onMessageCallback1, _this1;
                            (_this_onMessageCallback1 = (_this1 = this).onMessageCallback) === null || _this_onMessageCallback1 === void 0 ? void 0 : _this_onMessageCallback1.call(_this1, {
                                type: "tool_log",
                                text: `Executing shell command: ${command}`
                            });
                            try {
                                const { stdout, stderr } = await execAsync(command, {
                                    cwd: this.cwd
                                });
                                return {
                                    stdout,
                                    stderr,
                                    exitCode: 0
                                };
                            } catch (e) {
                                return {
                                    stdout: "",
                                    stderr: e.message,
                                    exitCode: e.code || 1
                                };
                            }
                        } else {
                            throw new Error("User denied shell command execution");
                        }
                    }
                    return {};
                }
            }), stream);
        // Initialize Protocol
        try {
            if (!this.connection) {
                throw new Error("Connection closed before initialization");
            }
            const initResult = await this.connection.initialize({
                protocolVersion: 1,
                clientCapabilities: {
                    fs: {
                        readTextFile: true,
                        writeTextFile: true
                    },
                    // @ts-ignore - Assuming protocol extension allows this or custom handling
                    runShellCommand: true
                },
                clientInfo: {
                    name: "test-client",
                    version: "1.0.0"
                }
            });
            console.log("Initialized:", initResult);
            this.agentCapabilities = (initResult === null || initResult === void 0 ? void 0 : initResult.agentCapabilities) ?? null;
            this.connected = true;
            if ((options === null || options === void 0 ? void 0 : options.createSession) !== false) {
                const sessionId = await this.createSession(this.cwd, true);
                return {
                    sessionId
                };
            } else {
                var _this_onMessageCallback, _this;
                (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                    type: "system",
                    text: "System: Connected."
                });
                return {
                    sessionId: null
                };
            }
        } catch (e) {
            var _this_onMessageCallback1, _this1;
            console.error("Init failed:", e);
            (_this_onMessageCallback1 = (_this1 = this).onMessageCallback) === null || _this_onMessageCallback1 === void 0 ? void 0 : _this_onMessageCallback1.call(_this1, {
                type: "system",
                text: `System: Init failed: ${e.message}`
            });
            await this.disconnect();
            throw e;
        }
    }
    handleSessionInitUpdate(sessionResult) {
        var _sessionResult_models_availableModels, _sessionResult_models, _sessionResult_configOptions;
        if (sessionResult === null || sessionResult === void 0 ? void 0 : (_sessionResult_models = sessionResult.models) === null || _sessionResult_models === void 0 ? void 0 : (_sessionResult_models_availableModels = _sessionResult_models.availableModels) === null || _sessionResult_models_availableModels === void 0 ? void 0 : _sessionResult_models_availableModels.length) {
            var _this_onMessageCallback, _this;
            (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                type: "agent_info",
                info: {
                    models: sessionResult.models.availableModels,
                    currentModelId: sessionResult.models.currentModelId
                }
            });
        } else if (sessionResult === null || sessionResult === void 0 ? void 0 : (_sessionResult_configOptions = sessionResult.configOptions) === null || _sessionResult_configOptions === void 0 ? void 0 : _sessionResult_configOptions.length) {
            const modelUpdate = normalizeModelsFromConfigOptions(sessionResult.configOptions);
            if (modelUpdate) {
                var _this_onMessageCallback1, _this1;
                (_this_onMessageCallback1 = (_this1 = this).onMessageCallback) === null || _this_onMessageCallback1 === void 0 ? void 0 : _this_onMessageCallback1.call(_this1, {
                    type: "agent_info",
                    info: modelUpdate
                });
            }
        }
    }
    async createSession(cwd, isInitial = false) {
        var _this_onMessageCallback, _this;
        if (!this.connection) {
            throw new Error("Connection closed before session creation");
        }
        const sessionResult = await this.connection.newSession({
            cwd: cwd || this.cwd,
            mcpServers: []
        });
        this.activeSessionId = sessionResult.sessionId;
        (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
            type: "system",
            text: isInitial ? "System: Connected and Session Created." : "System: Session Created."
        });
        this.handleSessionInitUpdate(sessionResult);
        return sessionResult.sessionId;
    }
    async loadSession(sessionId, cwd) {
        var _this_onMessageCallback, _this;
        if (!this.connection || !this.connection.loadSession) {
            throw new Error("Agent does not support session/load");
        }
        const result = await this.connection.loadSession({
            sessionId,
            cwd: cwd || this.cwd,
            mcpServers: []
        });
        this.activeSessionId = sessionId;
        (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
            type: "system",
            text: "System: Session Loaded."
        });
        this.handleSessionInitUpdate(result);
    }
    async resumeSession(sessionId, cwd) {
        var _this_onMessageCallback, _this;
        if (!this.connection || !this.connection.unstable_resumeSession) {
            throw new Error("Agent does not support session/resume");
        }
        const result = await this.connection.unstable_resumeSession({
            sessionId,
            cwd: cwd || this.cwd,
            mcpServers: []
        });
        this.activeSessionId = sessionId;
        (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
            type: "system",
            text: "System: Session Resumed."
        });
        this.handleSessionInitUpdate(result);
    }
    setActiveSession(sessionId) {
        this.activeSessionId = sessionId;
    }
    isConnected() {
        return this.connected && !!this.connection;
    }
    getCapabilities() {
        return this.agentCapabilities;
    }
    async sendMessage(text) {
        if (!this.connection || !this.activeSessionId) {
            throw new Error("Not connected");
        }
        // Send Prompt
        try {
            const response = await this.connection.prompt({
                sessionId: this.activeSessionId,
                prompt: [
                    {
                        type: "text",
                        text: text
                    }
                ]
            });
            const usage = extractTokenUsage(response);
            if (usage) {
                var _this_onMessageCallback, _this;
                (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                    type: "agent_info",
                    info: {
                        tokenUsage: usage
                    }
                });
            }
        // Response is handled via sessionUpdate
        } catch (err) {
            var _this_onMessageCallback1, _this1;
            console.error("Prompt error", err);
            (_this_onMessageCallback1 = (_this1 = this).onMessageCallback) === null || _this_onMessageCallback1 === void 0 ? void 0 : _this_onMessageCallback1.call(_this1, {
                type: "system",
                text: `System Error: ${err.message}`
            });
        }
    }
    async setModel(modelId) {
        if (!this.connection || !this.activeSessionId) {
            throw new Error("Not connected");
        }
        try {
            var _this_onMessageCallback, _this;
            await this.connection.unstable_setSessionModel({
                sessionId: this.activeSessionId,
                modelId
            });
            (_this_onMessageCallback = (_this = this).onMessageCallback) === null || _this_onMessageCallback === void 0 ? void 0 : _this_onMessageCallback.call(_this, {
                type: "agent_info",
                info: {
                    currentModelId: modelId
                }
            });
            return {
                success: true
            };
        } catch (e) {
            return {
                success: false,
                error: e.message
            };
        }
    }
    async disconnect() {
        const proc = this.process;
        if (proc) {
            await new Promise((resolve)=>{
                let settled = false;
                const finalize = ()=>{
                    if (settled) return;
                    settled = true;
                    resolve();
                };
                proc.once("exit", finalize);
                proc.kill();
                setTimeout(finalize, 2000);
            });
            this.process = null;
        }
        this.connection = null;
        this.activeSessionId = null;
        this.connected = false;
        this.agentCapabilities = null;
    }
}


},
"./src/main/db/store.ts"(__unused_rspack_module, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  createTask: () => (createTask),
  deleteTask: () => (deleteTask),
  getSetting: () => (getSetting),
  getTask: () => (getTask),
  initDB: () => (initDB),
  listTasks: () => (listTasks),
  setSetting: () => (setSetting),
  updateTask: () => (updateTask)
});
/* import */ var node_path__rspack_import_0 = __webpack_require__("node:path");
/* import */ var node_path__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(node_path__rspack_import_0);
/* import */ var electron__rspack_import_1 = __webpack_require__("electron");
/* import */ var electron__rspack_import_1_default = /*#__PURE__*/__webpack_require__.n(electron__rspack_import_1);
/* import */ var better_sqlite3__rspack_import_2 = __webpack_require__("better-sqlite3");
/* import */ var better_sqlite3__rspack_import_2_default = /*#__PURE__*/__webpack_require__.n(better_sqlite3__rspack_import_2);



let db = null;
const initDB = ()=>{
    const dbPath = node_path__rspack_import_0_default().join(electron__rspack_import_1.app.getPath("userData"), "app.db");
    console.log(`[DB] Initializing database at ${dbPath}`);
    try {
        db = new (better_sqlite3__rspack_import_2_default())(dbPath);
        db.pragma("journal_mode = WAL");
        // Create settings table
        db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
        db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        workspace TEXT NOT NULL,
        agent_command TEXT NOT NULL,
        agent_env TEXT,
        messages TEXT,
        session_id TEXT,
        model_id TEXT,
        token_usage TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL
      )
    `);
    } catch (e) {
        console.error("[DB] Failed to initialize database:", e);
    }
};
const setSetting = (key, value)=>{
    if (!db) return;
    try {
        const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
        stmt.run(key, value);
    } catch (e) {
        console.error(`[DB] Failed to set setting ${key}:`, e);
    }
};
const getSetting = (key)=>{
    if (!db) return null;
    try {
        const stmt = db.prepare("SELECT value FROM settings WHERE key = ?");
        const row = stmt.get(key);
        return row ? row.value : null;
    } catch (e) {
        console.error(`[DB] Failed to get setting ${key}:`, e);
        return null;
    }
};
const parseJson = (value, fallback)=>{
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch  {
        return fallback;
    }
};
const normalizeTaskRow = (row)=>({
        id: row.id,
        title: row.title,
        workspace: row.workspace,
        agentCommand: row.agent_command,
        agentEnv: parseJson(row.agent_env, {}),
        messages: parseJson(row.messages, []),
        sessionId: row.session_id ?? null,
        modelId: row.model_id ?? null,
        tokenUsage: parseJson(row.token_usage, null),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastActiveAt: row.last_active_at
    });
const listTasks = ()=>{
    if (!db) return [];
    try {
        const stmt = db.prepare("SELECT * FROM tasks ORDER BY last_active_at DESC, created_at DESC");
        const rows = stmt.all();
        return rows.map(normalizeTaskRow);
    } catch (e) {
        console.error("[DB] Failed to list tasks:", e);
        return [];
    }
};
const getTask = (id)=>{
    if (!db) return null;
    try {
        const stmt = db.prepare("SELECT * FROM tasks WHERE id = ?");
        const row = stmt.get(id);
        return row ? normalizeTaskRow(row) : null;
    } catch (e) {
        console.error(`[DB] Failed to get task ${id}:`, e);
        return null;
    }
};
const createTask = (task)=>{
    if (!db) return;
    try {
        const stmt = db.prepare(`
      INSERT INTO tasks (
        id, title, workspace, agent_command, agent_env, messages,
        session_id, model_id, token_usage, created_at, updated_at, last_active_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(task.id, task.title, task.workspace, task.agentCommand, JSON.stringify(task.agentEnv ?? {}), JSON.stringify(task.messages ?? []), task.sessionId, task.modelId, JSON.stringify(task.tokenUsage ?? null), task.createdAt, task.updatedAt, task.lastActiveAt);
    } catch (e) {
        console.error(`[DB] Failed to create task ${task.id}:`, e);
    }
};
const updateTask = (id, updates)=>{
    if (!db) return;
    const fields = [];
    const values = [];
    const setField = (field, value)=>{
        fields.push(`${field} = ?`);
        values.push(value);
    };
    if (updates.title !== undefined) setField("title", updates.title);
    if (updates.workspace !== undefined) setField("workspace", updates.workspace);
    if (updates.agentCommand !== undefined) setField("agent_command", updates.agentCommand);
    if (updates.agentEnv !== undefined) setField("agent_env", JSON.stringify(updates.agentEnv ?? {}));
    if (updates.messages !== undefined) setField("messages", JSON.stringify(updates.messages ?? []));
    if (updates.sessionId !== undefined) setField("session_id", updates.sessionId);
    if (updates.modelId !== undefined) setField("model_id", updates.modelId);
    if (updates.tokenUsage !== undefined) setField("token_usage", JSON.stringify(updates.tokenUsage ?? null));
    if (updates.createdAt !== undefined) setField("created_at", updates.createdAt);
    if (updates.updatedAt !== undefined) setField("updated_at", updates.updatedAt);
    if (updates.lastActiveAt !== undefined) setField("last_active_at", updates.lastActiveAt);
    if (fields.length === 0) return;
    try {
        const stmt = db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`);
        stmt.run(...values, id);
    } catch (e) {
        console.error(`[DB] Failed to update task ${id}:`, e);
    }
};
const deleteTask = (id)=>{
    if (!db) return;
    try {
        const stmt = db.prepare("DELETE FROM tasks WHERE id = ?");
        stmt.run(id);
    } catch (e) {
        console.error(`[DB] Failed to delete task ${id}:`, e);
    }
};


},
"better-sqlite3"(module) {
module.exports = require("better-sqlite3");

},
"electron"(module) {
module.exports = require("electron");

},
"node:child_process"(module) {
module.exports = require("node:child_process");

},
"node:fs"(module) {
module.exports = require("node:fs");

},
"node:fs/promises"(module) {
module.exports = require("node:fs/promises");

},
"node:path"(module) {
module.exports = require("node:path");

},
"node:stream"(module) {
module.exports = require("node:stream");

},
"node:util"(module) {
module.exports = require("node:util");

},
"./node_modules/.pnpm/@agentclientprotocol+sdk@0.13.0_zod@4.3.5/node_modules/@agentclientprotocol/sdk/dist/acp.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  AGENT_METHODS: () => (/* reexport safe */ _schema_index_js__rspack_import_0.AGENT_METHODS),
  AgentSideConnection: () => (AgentSideConnection),
  CLIENT_METHODS: () => (/* reexport safe */ _schema_index_js__rspack_import_0.CLIENT_METHODS),
  ClientSideConnection: () => (ClientSideConnection),
  PROTOCOL_VERSION: () => (/* reexport safe */ _schema_index_js__rspack_import_0.PROTOCOL_VERSION),
  RequestError: () => (RequestError),
  TerminalHandle: () => (TerminalHandle),
  ndJsonStream: () => (/* reexport safe */ _stream_js__rspack_import_2.ndJsonStream)
});
/* import */ var zod__rspack_import_3 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/external.js");
/* import */ var _schema_index_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/@agentclientprotocol+sdk@0.13.0_zod@4.3.5/node_modules/@agentclientprotocol/sdk/dist/schema/index.js");
/* import */ var _schema_zod_gen_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/@agentclientprotocol+sdk@0.13.0_zod@4.3.5/node_modules/@agentclientprotocol/sdk/dist/schema/zod.gen.js");
/* import */ var _stream_js__rspack_import_2 = __webpack_require__("./node_modules/.pnpm/@agentclientprotocol+sdk@0.13.0_zod@4.3.5/node_modules/@agentclientprotocol/sdk/dist/stream.js");





/**
 * An agent-side connection to a client.
 *
 * This class provides the agent's view of an ACP connection, allowing
 * agents to communicate with clients. It implements the {@link Client} interface
 * to provide methods for requesting permissions, accessing the file system,
 * and sending session updates.
 *
 * See protocol docs: [Agent](https://agentclientprotocol.com/protocol/overview#agent)
 */
class AgentSideConnection {
    #connection;
    /**
     * Creates a new agent-side connection to a client.
     *
     * This establishes the communication channel from the agent's perspective
     * following the ACP specification.
     *
     * @param toAgent - A function that creates an Agent handler to process incoming client requests
     * @param stream - The bidirectional message stream for communication. Typically created using
     *                 {@link ndJsonStream} for stdio-based connections.
     *
     * See protocol docs: [Communication Model](https://agentclientprotocol.com/protocol/overview#communication-model)
     */
    constructor(toAgent, stream) {
        const agent = toAgent(this);
        const requestHandler = async (method, params) => {
            switch (method) {
                case _schema_index_js__rspack_import_0.AGENT_METHODS.initialize: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zInitializeRequest.parse(params);
                    return agent.initialize(validatedParams);
                }
                case _schema_index_js__rspack_import_0.AGENT_METHODS.session_new: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zNewSessionRequest.parse(params);
                    return agent.newSession(validatedParams);
                }
                case _schema_index_js__rspack_import_0.AGENT_METHODS.session_load: {
                    if (!agent.loadSession) {
                        throw RequestError.methodNotFound(method);
                    }
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zLoadSessionRequest.parse(params);
                    return agent.loadSession(validatedParams);
                }
                case _schema_index_js__rspack_import_0.AGENT_METHODS.session_list: {
                    if (!agent.unstable_listSessions) {
                        throw RequestError.methodNotFound(method);
                    }
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zListSessionsRequest.parse(params);
                    return agent.unstable_listSessions(validatedParams);
                }
                case _schema_index_js__rspack_import_0.AGENT_METHODS.session_fork: {
                    if (!agent.unstable_forkSession) {
                        throw RequestError.methodNotFound(method);
                    }
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zForkSessionRequest.parse(params);
                    return agent.unstable_forkSession(validatedParams);
                }
                case _schema_index_js__rspack_import_0.AGENT_METHODS.session_resume: {
                    if (!agent.unstable_resumeSession) {
                        throw RequestError.methodNotFound(method);
                    }
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zResumeSessionRequest.parse(params);
                    return agent.unstable_resumeSession(validatedParams);
                }
                case _schema_index_js__rspack_import_0.AGENT_METHODS.session_set_mode: {
                    if (!agent.setSessionMode) {
                        throw RequestError.methodNotFound(method);
                    }
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zSetSessionModeRequest.parse(params);
                    const result = await agent.setSessionMode(validatedParams);
                    return result ?? {};
                }
                case _schema_index_js__rspack_import_0.AGENT_METHODS.authenticate: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zAuthenticateRequest.parse(params);
                    const result = await agent.authenticate(validatedParams);
                    return result ?? {};
                }
                case _schema_index_js__rspack_import_0.AGENT_METHODS.session_prompt: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zPromptRequest.parse(params);
                    return agent.prompt(validatedParams);
                }
                case _schema_index_js__rspack_import_0.AGENT_METHODS.session_set_model: {
                    if (!agent.unstable_setSessionModel) {
                        throw RequestError.methodNotFound(method);
                    }
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zSetSessionModelRequest.parse(params);
                    const result = await agent.unstable_setSessionModel(validatedParams);
                    return result ?? {};
                }
                case _schema_index_js__rspack_import_0.AGENT_METHODS.session_set_config_option: {
                    if (!agent.unstable_setSessionConfigOption) {
                        throw RequestError.methodNotFound(method);
                    }
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zSetSessionConfigOptionRequest.parse(params);
                    return agent.unstable_setSessionConfigOption(validatedParams);
                }
                default:
                    if (agent.extMethod) {
                        return agent.extMethod(method, params);
                    }
                    throw RequestError.methodNotFound(method);
            }
        };
        const notificationHandler = async (method, params) => {
            switch (method) {
                case _schema_index_js__rspack_import_0.AGENT_METHODS.session_cancel: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zCancelNotification.parse(params);
                    return agent.cancel(validatedParams);
                }
                default:
                    if (agent.extNotification) {
                        return agent.extNotification(method, params);
                    }
                    throw RequestError.methodNotFound(method);
            }
        };
        this.#connection = new Connection(requestHandler, notificationHandler, stream);
    }
    /**
     * Handles session update notifications from the agent.
     *
     * This is a notification endpoint (no response expected) that sends
     * real-time updates about session progress, including message chunks,
     * tool calls, and execution plans.
     *
     * Note: Clients SHOULD continue accepting tool call updates even after
     * sending a `session/cancel` notification, as the agent may send final
     * updates before responding with the cancelled stop reason.
     *
     * See protocol docs: [Agent Reports Output](https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output)
     */
    async sessionUpdate(params) {
        return await this.#connection.sendNotification(_schema_index_js__rspack_import_0.CLIENT_METHODS.session_update, params);
    }
    /**
     * Requests permission from the user for a tool call operation.
     *
     * Called by the agent when it needs user authorization before executing
     * a potentially sensitive operation. The client should present the options
     * to the user and return their decision.
     *
     * If the client cancels the prompt turn via `session/cancel`, it MUST
     * respond to this request with `RequestPermissionOutcome::Cancelled`.
     *
     * See protocol docs: [Requesting Permission](https://agentclientprotocol.com/protocol/tool-calls#requesting-permission)
     */
    async requestPermission(params) {
        return await this.#connection.sendRequest(_schema_index_js__rspack_import_0.CLIENT_METHODS.session_request_permission, params);
    }
    /**
     * Reads content from a text file in the client's file system.
     *
     * Only available if the client advertises the `fs.readTextFile` capability.
     * Allows the agent to access file contents within the client's environment.
     *
     * See protocol docs: [Client](https://agentclientprotocol.com/protocol/overview#client)
     */
    async readTextFile(params) {
        return await this.#connection.sendRequest(_schema_index_js__rspack_import_0.CLIENT_METHODS.fs_read_text_file, params);
    }
    /**
     * Writes content to a text file in the client's file system.
     *
     * Only available if the client advertises the `fs.writeTextFile` capability.
     * Allows the agent to create or modify files within the client's environment.
     *
     * See protocol docs: [Client](https://agentclientprotocol.com/protocol/overview#client)
     */
    async writeTextFile(params) {
        return ((await this.#connection.sendRequest(_schema_index_js__rspack_import_0.CLIENT_METHODS.fs_write_text_file, params)) ?? {});
    }
    /**
     * Executes a command in a new terminal.
     *
     * Returns a `TerminalHandle` that can be used to get output, wait for exit,
     * kill the command, or release the terminal.
     *
     * The terminal can also be embedded in tool calls by using its ID in
     * `ToolCallContent` with type "terminal".
     *
     * @param params - The terminal creation parameters
     * @returns A handle to control and monitor the terminal
     */
    async createTerminal(params) {
        const response = await this.#connection.sendRequest(_schema_index_js__rspack_import_0.CLIENT_METHODS.terminal_create, params);
        return new TerminalHandle(response.terminalId, params.sessionId, this.#connection);
    }
    /**
     * Extension method
     *
     * Allows the Agent to send an arbitrary request that is not part of the ACP spec.
     */
    async extMethod(method, params) {
        return await this.#connection.sendRequest(method, params);
    }
    /**
     * Extension notification
     *
     * Allows the Agent to send an arbitrary notification that is not part of the ACP spec.
     */
    async extNotification(method, params) {
        return await this.#connection.sendNotification(method, params);
    }
    /**
     * AbortSignal that aborts when the connection closes.
     *
     * This signal can be used to:
     * - Listen for connection closure: `connection.signal.addEventListener('abort', () => {...})`
     * - Check connection status synchronously: `if (connection.signal.aborted) {...}`
     * - Pass to other APIs (fetch, setTimeout) for automatic cancellation
     *
     * The connection closes when the underlying stream ends, either normally or due to an error.
     *
     * @example
     * ```typescript
     * const connection = new AgentSideConnection(agent, stream);
     *
     * // Listen for closure
     * connection.signal.addEventListener('abort', () => {
     *   console.log('Connection closed - performing cleanup');
     * });
     *
     * // Check status
     * if (connection.signal.aborted) {
     *   console.log('Connection is already closed');
     * }
     *
     * // Pass to other APIs
     * fetch(url, { signal: connection.signal });
     * ```
     */
    get signal() {
        return this.#connection.signal;
    }
    /**
     * Promise that resolves when the connection closes.
     *
     * The connection closes when the underlying stream ends, either normally or due to an error.
     * Once closed, the connection cannot send or receive any more messages.
     *
     * This is useful for async/await style cleanup:
     *
     * @example
     * ```typescript
     * const connection = new AgentSideConnection(agent, stream);
     * await connection.closed;
     * console.log('Connection closed - performing cleanup');
     * ```
     */
    get closed() {
        return this.#connection.closed;
    }
}
/**
 * Handle for controlling and monitoring a terminal created via `createTerminal`.
 *
 * Provides methods to:
 * - Get current output without waiting
 * - Wait for command completion
 * - Kill the running command
 * - Release terminal resources
 *
 * **Important:** Always call `release()` when done with the terminal to free resources.

 * The terminal supports async disposal via `Symbol.asyncDispose` for automatic cleanup.

 * You can use `await using` to ensure the terminal is automatically released when it
 * goes out of scope.
 */
class TerminalHandle {
    id;
    #sessionId;
    #connection;
    constructor(id, sessionId, conn) {
        this.id = id;
        this.#sessionId = sessionId;
        this.#connection = conn;
    }
    /**
     * Gets the current terminal output without waiting for the command to exit.
     */
    async currentOutput() {
        return await this.#connection.sendRequest(_schema_index_js__rspack_import_0.CLIENT_METHODS.terminal_output, {
            sessionId: this.#sessionId,
            terminalId: this.id,
        });
    }
    /**
     * Waits for the terminal command to complete and returns its exit status.
     */
    async waitForExit() {
        return await this.#connection.sendRequest(_schema_index_js__rspack_import_0.CLIENT_METHODS.terminal_wait_for_exit, {
            sessionId: this.#sessionId,
            terminalId: this.id,
        });
    }
    /**
     * Kills the terminal command without releasing the terminal.
     *
     * The terminal remains valid after killing, allowing you to:
     * - Get the final output with `currentOutput()`
     * - Check the exit status
     * - Release the terminal when done
     *
     * Useful for implementing timeouts or cancellation.
     */
    async kill() {
        return ((await this.#connection.sendRequest(_schema_index_js__rspack_import_0.CLIENT_METHODS.terminal_kill, {
            sessionId: this.#sessionId,
            terminalId: this.id,
        })) ?? {});
    }
    /**
     * Releases the terminal and frees all associated resources.
     *
     * If the command is still running, it will be killed.
     * After release, the terminal ID becomes invalid and cannot be used
     * with other terminal methods.
     *
     * Tool calls that already reference this terminal will continue to
     * display its output.
     *
     * **Important:** Always call this method when done with the terminal.
     */
    async release() {
        return ((await this.#connection.sendRequest(_schema_index_js__rspack_import_0.CLIENT_METHODS.terminal_release, {
            sessionId: this.#sessionId,
            terminalId: this.id,
        })) ?? {});
    }
    async [Symbol.asyncDispose]() {
        await this.release();
    }
}
/**
 * A client-side connection to an agent.
 *
 * This class provides the client's view of an ACP connection, allowing
 * clients (such as code editors) to communicate with agents. It implements
 * the {@link Agent} interface to provide methods for initializing sessions, sending
 * prompts, and managing the agent lifecycle.
 *
 * See protocol docs: [Client](https://agentclientprotocol.com/protocol/overview#client)
 */
class ClientSideConnection {
    #connection;
    /**
     * Creates a new client-side connection to an agent.
     *
     * This establishes the communication channel between a client and agent
     * following the ACP specification.
     *
     * @param toClient - A function that creates a Client handler to process incoming agent requests
     * @param stream - The bidirectional message stream for communication. Typically created using
     *                 {@link ndJsonStream} for stdio-based connections.
     *
     * See protocol docs: [Communication Model](https://agentclientprotocol.com/protocol/overview#communication-model)
     */
    constructor(toClient, stream) {
        const client = toClient(this);
        const requestHandler = async (method, params) => {
            switch (method) {
                case _schema_index_js__rspack_import_0.CLIENT_METHODS.fs_write_text_file: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zWriteTextFileRequest.parse(params);
                    return client.writeTextFile?.(validatedParams);
                }
                case _schema_index_js__rspack_import_0.CLIENT_METHODS.fs_read_text_file: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zReadTextFileRequest.parse(params);
                    return client.readTextFile?.(validatedParams);
                }
                case _schema_index_js__rspack_import_0.CLIENT_METHODS.session_request_permission: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zRequestPermissionRequest.parse(params);
                    return client.requestPermission(validatedParams);
                }
                case _schema_index_js__rspack_import_0.CLIENT_METHODS.terminal_create: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zCreateTerminalRequest.parse(params);
                    return client.createTerminal?.(validatedParams);
                }
                case _schema_index_js__rspack_import_0.CLIENT_METHODS.terminal_output: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zTerminalOutputRequest.parse(params);
                    return client.terminalOutput?.(validatedParams);
                }
                case _schema_index_js__rspack_import_0.CLIENT_METHODS.terminal_release: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zReleaseTerminalRequest.parse(params);
                    const result = await client.releaseTerminal?.(validatedParams);
                    return result ?? {};
                }
                case _schema_index_js__rspack_import_0.CLIENT_METHODS.terminal_wait_for_exit: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zWaitForTerminalExitRequest.parse(params);
                    return client.waitForTerminalExit?.(validatedParams);
                }
                case _schema_index_js__rspack_import_0.CLIENT_METHODS.terminal_kill: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zKillTerminalCommandRequest.parse(params);
                    const result = await client.killTerminal?.(validatedParams);
                    return result ?? {};
                }
                default:
                    if (client.extMethod) {
                        return client.extMethod(method, params);
                    }
                    throw RequestError.methodNotFound(method);
            }
        };
        const notificationHandler = async (method, params) => {
            switch (method) {
                case _schema_index_js__rspack_import_0.CLIENT_METHODS.session_update: {
                    const validatedParams = _schema_zod_gen_js__rspack_import_1.zSessionNotification.parse(params);
                    return client.sessionUpdate(validatedParams);
                }
                default:
                    if (client.extNotification) {
                        return client.extNotification(method, params);
                    }
                    throw RequestError.methodNotFound(method);
            }
        };
        this.#connection = new Connection(requestHandler, notificationHandler, stream);
    }
    /**
     * Establishes the connection with a client and negotiates protocol capabilities.
     *
     * This method is called once at the beginning of the connection to:
     * - Negotiate the protocol version to use
     * - Exchange capability information between client and agent
     * - Determine available authentication methods
     *
     * The agent should respond with its supported protocol version and capabilities.
     *
     * See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
     */
    async initialize(params) {
        return await this.#connection.sendRequest(_schema_index_js__rspack_import_0.AGENT_METHODS.initialize, params);
    }
    /**
     * Creates a new conversation session with the agent.
     *
     * Sessions represent independent conversation contexts with their own history and state.
     *
     * The agent should:
     * - Create a new session context
     * - Connect to any specified MCP servers
     * - Return a unique session ID for future requests
     *
     * May return an `auth_required` error if the agent requires authentication.
     *
     * See protocol docs: [Session Setup](https://agentclientprotocol.com/protocol/session-setup)
     */
    async newSession(params) {
        return await this.#connection.sendRequest(_schema_index_js__rspack_import_0.AGENT_METHODS.session_new, params);
    }
    /**
     * Loads an existing session to resume a previous conversation.
     *
     * This method is only available if the agent advertises the `loadSession` capability.
     *
     * The agent should:
     * - Restore the session context and conversation history
     * - Connect to the specified MCP servers
     * - Stream the entire conversation history back to the client via notifications
     *
     * See protocol docs: [Loading Sessions](https://agentclientprotocol.com/protocol/session-setup#loading-sessions)
     */
    async loadSession(params) {
        return ((await this.#connection.sendRequest(_schema_index_js__rspack_import_0.AGENT_METHODS.session_load, params)) ?? {});
    }
    /**
     * **UNSTABLE**
     *
     * This capability is not part of the spec yet, and may be removed or changed at any point.
     *
     * Forks an existing session to create a new independent session.
     *
     * Creates a new session based on the context of an existing one, allowing
     * operations like generating summaries without affecting the original session's history.
     *
     * This method is only available if the agent advertises the `session.fork` capability.
     *
     * @experimental
     */
    async unstable_forkSession(params) {
        return await this.#connection.sendRequest(_schema_index_js__rspack_import_0.AGENT_METHODS.session_fork, params);
    }
    /**
     * **UNSTABLE**
     *
     * This capability is not part of the spec yet, and may be removed or changed at any point.
     *
     * Lists existing sessions from the agent.
     *
     * This method is only available if the agent advertises the `listSessions` capability.
     *
     * Returns a list of sessions with metadata like session ID, working directory,
     * title, and last update time. Supports filtering by working directory and
     * cursor-based pagination.
     *
     * @experimental
     */
    async unstable_listSessions(params) {
        return await this.#connection.sendRequest(_schema_index_js__rspack_import_0.AGENT_METHODS.session_list, params);
    }
    /**
     * **UNSTABLE**
     *
     * This capability is not part of the spec yet, and may be removed or changed at any point.
     *
     * Resumes an existing session without returning previous messages.
     *
     * This method is only available if the agent advertises the `session.resume` capability.
     *
     * The agent should resume the session context, allowing the conversation to continue
     * without replaying the message history (unlike `session/load`).
     *
     * @experimental
     */
    async unstable_resumeSession(params) {
        return await this.#connection.sendRequest(_schema_index_js__rspack_import_0.AGENT_METHODS.session_resume, params);
    }
    /**
     * Sets the operational mode for a session.
     *
     * Allows switching between different agent modes (e.g., "ask", "architect", "code")
     * that affect system prompts, tool availability, and permission behaviors.
     *
     * The mode must be one of the modes advertised in `availableModes` during session
     * creation or loading. Agents may also change modes autonomously and notify the
     * client via `current_mode_update` notifications.
     *
     * This method can be called at any time during a session, whether the Agent is
     * idle or actively generating a turn.
     *
     * See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
     */
    async setSessionMode(params) {
        return ((await this.#connection.sendRequest(_schema_index_js__rspack_import_0.AGENT_METHODS.session_set_mode, params)) ?? {});
    }
    /**
     * **UNSTABLE**
     *
     * This capability is not part of the spec yet, and may be removed or changed at any point.
     *
     * Select a model for a given session.
     *
     * @experimental
     */
    async unstable_setSessionModel(params) {
        return ((await this.#connection.sendRequest(_schema_index_js__rspack_import_0.AGENT_METHODS.session_set_model, params)) ?? {});
    }
    /**
     * **UNSTABLE**
     *
     * This capability is not part of the spec yet, and may be removed or changed at any point.
     *
     * Set a configuration option for a given session.
     *
     * The response contains the full set of configuration options and their current values,
     * as changing one option may affect the available values or state of other options.
     *
     * @experimental
     */
    async unstable_setSessionConfigOption(params) {
        return await this.#connection.sendRequest(_schema_index_js__rspack_import_0.AGENT_METHODS.session_set_config_option, params);
    }
    /**
     * Authenticates the client using the specified authentication method.
     *
     * Called when the agent requires authentication before allowing session creation.
     * The client provides the authentication method ID that was advertised during initialization.
     *
     * After successful authentication, the client can proceed to create sessions with
     * `newSession` without receiving an `auth_required` error.
     *
     * See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
     */
    async authenticate(params) {
        return ((await this.#connection.sendRequest(_schema_index_js__rspack_import_0.AGENT_METHODS.authenticate, params)) ?? {});
    }
    /**
     * Processes a user prompt within a session.
     *
     * This method handles the whole lifecycle of a prompt:
     * - Receives user messages with optional context (files, images, etc.)
     * - Processes the prompt using language models
     * - Reports language model content and tool calls to the Clients
     * - Requests permission to run tools
     * - Executes any requested tool calls
     * - Returns when the turn is complete with a stop reason
     *
     * See protocol docs: [Prompt Turn](https://agentclientprotocol.com/protocol/prompt-turn)
     */
    async prompt(params) {
        return await this.#connection.sendRequest(_schema_index_js__rspack_import_0.AGENT_METHODS.session_prompt, params);
    }
    /**
     * Cancels ongoing operations for a session.
     *
     * This is a notification sent by the client to cancel an ongoing prompt turn.
     *
     * Upon receiving this notification, the Agent SHOULD:
     * - Stop all language model requests as soon as possible
     * - Abort all tool call invocations in progress
     * - Send any pending `session/update` notifications
     * - Respond to the original `session/prompt` request with `StopReason::Cancelled`
     *
     * See protocol docs: [Cancellation](https://agentclientprotocol.com/protocol/prompt-turn#cancellation)
     */
    async cancel(params) {
        return await this.#connection.sendNotification(_schema_index_js__rspack_import_0.AGENT_METHODS.session_cancel, params);
    }
    /**
     * Extension method
     *
     * Allows the Client to send an arbitrary request that is not part of the ACP spec.
     */
    async extMethod(method, params) {
        return await this.#connection.sendRequest(method, params);
    }
    /**
     * Extension notification
     *
     * Allows the Client to send an arbitrary notification that is not part of the ACP spec.
     */
    async extNotification(method, params) {
        return await this.#connection.sendNotification(method, params);
    }
    /**
     * AbortSignal that aborts when the connection closes.
     *
     * This signal can be used to:
     * - Listen for connection closure: `connection.signal.addEventListener('abort', () => {...})`
     * - Check connection status synchronously: `if (connection.signal.aborted) {...}`
     * - Pass to other APIs (fetch, setTimeout) for automatic cancellation
     *
     * The connection closes when the underlying stream ends, either normally or due to an error.
     *
     * @example
     * ```typescript
     * const connection = new ClientSideConnection(client, stream);
     *
     * // Listen for closure
     * connection.signal.addEventListener('abort', () => {
     *   console.log('Connection closed - performing cleanup');
     * });
     *
     * // Check status
     * if (connection.signal.aborted) {
     *   console.log('Connection is already closed');
     * }
     *
     * // Pass to other APIs
     * fetch(url, { signal: connection.signal });
     * ```
     */
    get signal() {
        return this.#connection.signal;
    }
    /**
     * Promise that resolves when the connection closes.
     *
     * The connection closes when the underlying stream ends, either normally or due to an error.
     * Once closed, the connection cannot send or receive any more messages.
     *
     * This is useful for async/await style cleanup:
     *
     * @example
     * ```typescript
     * const connection = new ClientSideConnection(client, stream);
     * await connection.closed;
     * console.log('Connection closed - performing cleanup');
     * ```
     */
    get closed() {
        return this.#connection.closed;
    }
}
class Connection {
    #pendingResponses = new Map();
    #nextRequestId = 0;
    #requestHandler;
    #notificationHandler;
    #stream;
    #writeQueue = Promise.resolve();
    #abortController = new AbortController();
    #closedPromise;
    constructor(requestHandler, notificationHandler, stream) {
        this.#requestHandler = requestHandler;
        this.#notificationHandler = notificationHandler;
        this.#stream = stream;
        this.#closedPromise = new Promise((resolve) => {
            this.#abortController.signal.addEventListener("abort", () => resolve());
        });
        this.#receive();
    }
    /**
     * AbortSignal that aborts when the connection closes.
     *
     * This signal can be used to:
     * - Listen for connection closure via event listeners
     * - Check connection status synchronously with `signal.aborted`
     * - Pass to other APIs (fetch, setTimeout) for automatic cancellation
     */
    get signal() {
        return this.#abortController.signal;
    }
    /**
     * Promise that resolves when the connection closes.
     *
     * The connection closes when the underlying stream ends, either normally
     * or due to an error. Once closed, the connection cannot send or receive
     * any more messages.
     *
     * @example
     * ```typescript
     * const connection = new ClientSideConnection(client, stream);
     * await connection.closed;
     * console.log('Connection closed - performing cleanup');
     * ```
     */
    get closed() {
        return this.#closedPromise;
    }
    async #receive() {
        const reader = this.#stream.readable.getReader();
        try {
            while (true) {
                const { value: message, done } = await reader.read();
                if (done) {
                    break;
                }
                if (!message) {
                    continue;
                }
                try {
                    this.#processMessage(message);
                }
                catch (err) {
                    console.error("Unexpected error during message processing:", message, err);
                    // Only send error response if the message had an id (was a request)
                    if ("id" in message && message.id !== undefined) {
                        this.#sendMessage({
                            jsonrpc: "2.0",
                            id: message.id,
                            error: {
                                code: -32700,
                                message: "Parse error",
                            },
                        });
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
            this.#abortController.abort();
        }
    }
    async #processMessage(message) {
        if ("method" in message && "id" in message) {
            // It's a request
            const response = await this.#tryCallRequestHandler(message.method, message.params);
            if ("error" in response) {
                console.error("Error handling request", message, response.error);
            }
            await this.#sendMessage({
                jsonrpc: "2.0",
                id: message.id,
                ...response,
            });
        }
        else if ("method" in message) {
            // It's a notification
            const response = await this.#tryCallNotificationHandler(message.method, message.params);
            if ("error" in response) {
                console.error("Error handling notification", message, response.error);
            }
        }
        else if ("id" in message) {
            // It's a response
            this.#handleResponse(message);
        }
        else {
            console.error("Invalid message", { message });
        }
    }
    async #tryCallRequestHandler(method, params) {
        try {
            const result = await this.#requestHandler(method, params);
            return { result: result ?? null };
        }
        catch (error) {
            if (error instanceof RequestError) {
                return error.toResult();
            }
            if (error instanceof zod__rspack_import_3.ZodError) {
                return RequestError.invalidParams(error.format()).toResult();
            }
            let details;
            if (error instanceof Error) {
                details = error.message;
            }
            else if (typeof error === "object" &&
                error != null &&
                "message" in error &&
                typeof error.message === "string") {
                details = error.message;
            }
            try {
                return RequestError.internalError(details ? JSON.parse(details) : {}).toResult();
            }
            catch {
                return RequestError.internalError({ details }).toResult();
            }
        }
    }
    async #tryCallNotificationHandler(method, params) {
        try {
            await this.#notificationHandler(method, params);
            return { result: null };
        }
        catch (error) {
            if (error instanceof RequestError) {
                return error.toResult();
            }
            if (error instanceof zod__rspack_import_3.ZodError) {
                return RequestError.invalidParams(error.format()).toResult();
            }
            let details;
            if (error instanceof Error) {
                details = error.message;
            }
            else if (typeof error === "object" &&
                error != null &&
                "message" in error &&
                typeof error.message === "string") {
                details = error.message;
            }
            try {
                return RequestError.internalError(details ? JSON.parse(details) : {}).toResult();
            }
            catch {
                return RequestError.internalError({ details }).toResult();
            }
        }
    }
    #handleResponse(response) {
        const pendingResponse = this.#pendingResponses.get(response.id);
        if (pendingResponse) {
            if ("result" in response) {
                pendingResponse.resolve(response.result);
            }
            else if ("error" in response) {
                pendingResponse.reject(response.error);
            }
            this.#pendingResponses.delete(response.id);
        }
        else {
            console.error("Got response to unknown request", response.id);
        }
    }
    async sendRequest(method, params) {
        const id = this.#nextRequestId++;
        const responsePromise = new Promise((resolve, reject) => {
            this.#pendingResponses.set(id, { resolve, reject });
        });
        await this.#sendMessage({ jsonrpc: "2.0", id, method, params });
        return responsePromise;
    }
    async sendNotification(method, params) {
        await this.#sendMessage({ jsonrpc: "2.0", method, params });
    }
    async #sendMessage(message) {
        this.#writeQueue = this.#writeQueue
            .then(async () => {
            const writer = this.#stream.writable.getWriter();
            try {
                await writer.write(message);
            }
            finally {
                writer.releaseLock();
            }
        })
            .catch((error) => {
            // Continue processing writes on error
            console.error("ACP write error:", error);
        });
        return this.#writeQueue;
    }
}
/**
 * JSON-RPC error object.
 *
 * Represents an error that occurred during method execution, following the
 * JSON-RPC 2.0 error object specification with optional additional data.
 *
 * See protocol docs: [JSON-RPC Error Object](https://www.jsonrpc.org/specification#error_object)
 */
class RequestError extends Error {
    code;
    data;
    constructor(code, message, data) {
        super(message);
        this.code = code;
        this.name = "RequestError";
        this.data = data;
    }
    /**
     * Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text.
     */
    static parseError(data, additionalMessage) {
        return new RequestError(-32700, `Parse error${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
    }
    /**
     * The JSON sent is not a valid Request object.
     */
    static invalidRequest(data, additionalMessage) {
        return new RequestError(-32600, `Invalid request${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
    }
    /**
     * The method does not exist / is not available.
     */
    static methodNotFound(method) {
        return new RequestError(-32601, `"Method not found": ${method}`, {
            method,
        });
    }
    /**
     * Invalid method parameter(s).
     */
    static invalidParams(data, additionalMessage) {
        return new RequestError(-32602, `Invalid params${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
    }
    /**
     * Internal JSON-RPC error.
     */
    static internalError(data, additionalMessage) {
        return new RequestError(-32603, `Internal error${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
    }
    /**
     * Authentication required.
     */
    static authRequired(data, additionalMessage) {
        return new RequestError(-32000, `Authentication required${additionalMessage ? `: ${additionalMessage}` : ""}`, data);
    }
    /**
     * Resource, such as a file, was not found
     */
    static resourceNotFound(uri) {
        return new RequestError(-32002, `Resource not found${uri ? `: ${uri}` : ""}`, uri && { uri });
    }
    toResult() {
        return {
            error: {
                code: this.code,
                message: this.message,
                data: this.data,
            },
        };
    }
    toErrorResponse() {
        return {
            code: this.code,
            message: this.message,
            data: this.data,
        };
    }
}
//# sourceMappingURL=acp.js.map

},
"./node_modules/.pnpm/@agentclientprotocol+sdk@0.13.0_zod@4.3.5/node_modules/@agentclientprotocol/sdk/dist/schema/index.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  AGENT_METHODS: () => (AGENT_METHODS),
  CLIENT_METHODS: () => (CLIENT_METHODS),
  PROTOCOL_VERSION: () => (PROTOCOL_VERSION)
});
// This file is auto-generated by @hey-api/openapi-ts
const AGENT_METHODS = {
    authenticate: "authenticate",
    initialize: "initialize",
    session_cancel: "session/cancel",
    session_fork: "session/fork",
    session_list: "session/list",
    session_load: "session/load",
    session_new: "session/new",
    session_prompt: "session/prompt",
    session_resume: "session/resume",
    session_set_config_option: "session/set_config_option",
    session_set_mode: "session/set_mode",
    session_set_model: "session/set_model",
};
const CLIENT_METHODS = {
    fs_read_text_file: "fs/read_text_file",
    fs_write_text_file: "fs/write_text_file",
    session_request_permission: "session/request_permission",
    session_update: "session/update",
    terminal_create: "terminal/create",
    terminal_kill: "terminal/kill",
    terminal_output: "terminal/output",
    terminal_release: "terminal/release",
    terminal_wait_for_exit: "terminal/wait_for_exit",
};
const PROTOCOL_VERSION = 1;
//# sourceMappingURL=index.js.map

},
"./node_modules/.pnpm/@agentclientprotocol+sdk@0.13.0_zod@4.3.5/node_modules/@agentclientprotocol/sdk/dist/schema/zod.gen.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  zAgentCapabilities: () => (zAgentCapabilities),
  zAgentNotification: () => (zAgentNotification),
  zAgentRequest: () => (zAgentRequest),
  zAgentResponse: () => (zAgentResponse),
  zAnnotations: () => (zAnnotations),
  zAudioContent: () => (zAudioContent),
  zAuthMethod: () => (zAuthMethod),
  zAuthenticateRequest: () => (zAuthenticateRequest),
  zAuthenticateResponse: () => (zAuthenticateResponse),
  zAvailableCommand: () => (zAvailableCommand),
  zAvailableCommandInput: () => (zAvailableCommandInput),
  zAvailableCommandsUpdate: () => (zAvailableCommandsUpdate),
  zBlobResourceContents: () => (zBlobResourceContents),
  zCancelNotification: () => (zCancelNotification),
  zCancelRequestNotification: () => (zCancelRequestNotification),
  zClientCapabilities: () => (zClientCapabilities),
  zClientNotification: () => (zClientNotification),
  zClientRequest: () => (zClientRequest),
  zClientResponse: () => (zClientResponse),
  zConfigOptionUpdate: () => (zConfigOptionUpdate),
  zContent: () => (zContent),
  zContentBlock: () => (zContentBlock),
  zContentChunk: () => (zContentChunk),
  zCreateTerminalRequest: () => (zCreateTerminalRequest),
  zCreateTerminalResponse: () => (zCreateTerminalResponse),
  zCurrentModeUpdate: () => (zCurrentModeUpdate),
  zDiff: () => (zDiff),
  zEmbeddedResource: () => (zEmbeddedResource),
  zEmbeddedResourceResource: () => (zEmbeddedResourceResource),
  zEnvVariable: () => (zEnvVariable),
  zError: () => (zError),
  zErrorCode: () => (zErrorCode),
  zExtNotification: () => (zExtNotification),
  zExtRequest: () => (zExtRequest),
  zExtResponse: () => (zExtResponse),
  zFileSystemCapability: () => (zFileSystemCapability),
  zForkSessionRequest: () => (zForkSessionRequest),
  zForkSessionResponse: () => (zForkSessionResponse),
  zHttpHeader: () => (zHttpHeader),
  zImageContent: () => (zImageContent),
  zImplementation: () => (zImplementation),
  zInitializeRequest: () => (zInitializeRequest),
  zInitializeResponse: () => (zInitializeResponse),
  zKillTerminalCommandRequest: () => (zKillTerminalCommandRequest),
  zKillTerminalCommandResponse: () => (zKillTerminalCommandResponse),
  zListSessionsRequest: () => (zListSessionsRequest),
  zListSessionsResponse: () => (zListSessionsResponse),
  zLoadSessionRequest: () => (zLoadSessionRequest),
  zLoadSessionResponse: () => (zLoadSessionResponse),
  zMcpCapabilities: () => (zMcpCapabilities),
  zMcpServer: () => (zMcpServer),
  zMcpServerHttp: () => (zMcpServerHttp),
  zMcpServerSse: () => (zMcpServerSse),
  zMcpServerStdio: () => (zMcpServerStdio),
  zModelId: () => (zModelId),
  zModelInfo: () => (zModelInfo),
  zNewSessionRequest: () => (zNewSessionRequest),
  zNewSessionResponse: () => (zNewSessionResponse),
  zPermissionOption: () => (zPermissionOption),
  zPermissionOptionId: () => (zPermissionOptionId),
  zPermissionOptionKind: () => (zPermissionOptionKind),
  zPlan: () => (zPlan),
  zPlanEntry: () => (zPlanEntry),
  zPlanEntryPriority: () => (zPlanEntryPriority),
  zPlanEntryStatus: () => (zPlanEntryStatus),
  zPromptCapabilities: () => (zPromptCapabilities),
  zPromptRequest: () => (zPromptRequest),
  zPromptResponse: () => (zPromptResponse),
  zProtocolVersion: () => (zProtocolVersion),
  zReadTextFileRequest: () => (zReadTextFileRequest),
  zReadTextFileResponse: () => (zReadTextFileResponse),
  zReleaseTerminalRequest: () => (zReleaseTerminalRequest),
  zReleaseTerminalResponse: () => (zReleaseTerminalResponse),
  zRequestId: () => (zRequestId),
  zRequestPermissionOutcome: () => (zRequestPermissionOutcome),
  zRequestPermissionRequest: () => (zRequestPermissionRequest),
  zRequestPermissionResponse: () => (zRequestPermissionResponse),
  zResourceLink: () => (zResourceLink),
  zResumeSessionRequest: () => (zResumeSessionRequest),
  zResumeSessionResponse: () => (zResumeSessionResponse),
  zRole: () => (zRole),
  zSelectedPermissionOutcome: () => (zSelectedPermissionOutcome),
  zSessionCapabilities: () => (zSessionCapabilities),
  zSessionConfigGroupId: () => (zSessionConfigGroupId),
  zSessionConfigId: () => (zSessionConfigId),
  zSessionConfigOption: () => (zSessionConfigOption),
  zSessionConfigOptionCategory: () => (zSessionConfigOptionCategory),
  zSessionConfigSelect: () => (zSessionConfigSelect),
  zSessionConfigSelectGroup: () => (zSessionConfigSelectGroup),
  zSessionConfigSelectOption: () => (zSessionConfigSelectOption),
  zSessionConfigSelectOptions: () => (zSessionConfigSelectOptions),
  zSessionConfigValueId: () => (zSessionConfigValueId),
  zSessionForkCapabilities: () => (zSessionForkCapabilities),
  zSessionId: () => (zSessionId),
  zSessionInfo: () => (zSessionInfo),
  zSessionInfoUpdate: () => (zSessionInfoUpdate),
  zSessionListCapabilities: () => (zSessionListCapabilities),
  zSessionMode: () => (zSessionMode),
  zSessionModeId: () => (zSessionModeId),
  zSessionModeState: () => (zSessionModeState),
  zSessionModelState: () => (zSessionModelState),
  zSessionNotification: () => (zSessionNotification),
  zSessionResumeCapabilities: () => (zSessionResumeCapabilities),
  zSessionUpdate: () => (zSessionUpdate),
  zSetSessionConfigOptionRequest: () => (zSetSessionConfigOptionRequest),
  zSetSessionConfigOptionResponse: () => (zSetSessionConfigOptionResponse),
  zSetSessionModeRequest: () => (zSetSessionModeRequest),
  zSetSessionModeResponse: () => (zSetSessionModeResponse),
  zSetSessionModelRequest: () => (zSetSessionModelRequest),
  zSetSessionModelResponse: () => (zSetSessionModelResponse),
  zStopReason: () => (zStopReason),
  zTerminal: () => (zTerminal),
  zTerminalExitStatus: () => (zTerminalExitStatus),
  zTerminalOutputRequest: () => (zTerminalOutputRequest),
  zTerminalOutputResponse: () => (zTerminalOutputResponse),
  zTextContent: () => (zTextContent),
  zTextResourceContents: () => (zTextResourceContents),
  zToolCall: () => (zToolCall),
  zToolCallContent: () => (zToolCallContent),
  zToolCallId: () => (zToolCallId),
  zToolCallLocation: () => (zToolCallLocation),
  zToolCallStatus: () => (zToolCallStatus),
  zToolCallUpdate: () => (zToolCallUpdate),
  zToolKind: () => (zToolKind),
  zUnstructuredCommandInput: () => (zUnstructuredCommandInput),
  zWaitForTerminalExitRequest: () => (zWaitForTerminalExitRequest),
  zWaitForTerminalExitResponse: () => (zWaitForTerminalExitResponse),
  zWriteTextFileRequest: () => (zWriteTextFileRequest),
  zWriteTextFileResponse: () => (zWriteTextFileResponse)
});
/* import */ var zod_v4__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/index.js");
// This file is auto-generated by @hey-api/openapi-ts

/**
 * Describes an available authentication method.
 */
const zAuthMethod = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    description: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    id: zod_v4__rspack_import_0.z.string(),
    name: zod_v4__rspack_import_0.z.string(),
});
/**
 * Request parameters for the authenticate method.
 *
 * Specifies which authentication method to use.
 */
const zAuthenticateRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    methodId: zod_v4__rspack_import_0.z.string(),
});
/**
 * Response to the `authenticate` method.
 */
const zAuthenticateResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * Binary resource contents.
 */
const zBlobResourceContents = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    blob: zod_v4__rspack_import_0.z.string(),
    mimeType: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    uri: zod_v4__rspack_import_0.z.string(),
});
/**
 * Response containing the ID of the created terminal.
 */
const zCreateTerminalResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    terminalId: zod_v4__rspack_import_0.z.string(),
});
/**
 * A diff representing file modifications.
 *
 * Shows changes to files in a format suitable for display in the client UI.
 *
 * See protocol docs: [Content](https://agentclientprotocol.com/protocol/tool-calls#content)
 */
const zDiff = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    newText: zod_v4__rspack_import_0.z.string(),
    oldText: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    path: zod_v4__rspack_import_0.z.string(),
});
/**
 * An environment variable to set when launching an MCP server.
 */
const zEnvVariable = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    name: zod_v4__rspack_import_0.z.string(),
    value: zod_v4__rspack_import_0.z.string(),
});
/**
 * Predefined error codes for common JSON-RPC and ACP-specific errors.
 *
 * These codes follow the JSON-RPC 2.0 specification for standard errors
 * and use the reserved range (-32000 to -32099) for protocol-specific errors.
 */
const zErrorCode = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.literal(-32700),
    zod_v4__rspack_import_0.z.literal(-32600),
    zod_v4__rspack_import_0.z.literal(-32601),
    zod_v4__rspack_import_0.z.literal(-32602),
    zod_v4__rspack_import_0.z.literal(-32603),
    zod_v4__rspack_import_0.z.literal(-32800),
    zod_v4__rspack_import_0.z.literal(-32000),
    zod_v4__rspack_import_0.z.literal(-32002),
    zod_v4__rspack_import_0.z.number()
        .int()
        .min(-2147483648, {
        message: "Invalid value: Expected int32 to be >= -2147483648",
    })
        .max(2147483647, {
        message: "Invalid value: Expected int32 to be <= 2147483647",
    }),
]);
/**
 * JSON-RPC error object.
 *
 * Represents an error that occurred during method execution, following the
 * JSON-RPC 2.0 error object specification with optional additional data.
 *
 * See protocol docs: [JSON-RPC Error Object](https://www.jsonrpc.org/specification#error_object)
 */
const zError = zod_v4__rspack_import_0.z.object({
    code: zErrorCode,
    data: zod_v4__rspack_import_0.z.unknown().optional(),
    message: zod_v4__rspack_import_0.z.string(),
});
/**
 * Allows the Agent to send an arbitrary notification that is not part of the ACP spec.
 * Extension notifications provide a way to send one-way messages for custom functionality
 * while maintaining protocol compatibility.
 *
 * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
 */
const zExtNotification = zod_v4__rspack_import_0.z.unknown();
/**
 * Allows for sending an arbitrary request that is not part of the ACP spec.
 * Extension methods provide a way to add custom functionality while maintaining
 * protocol compatibility.
 *
 * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
 */
const zExtRequest = zod_v4__rspack_import_0.z.unknown();
/**
 * Allows for sending an arbitrary response to an [`ExtRequest`] that is not part of the ACP spec.
 * Extension methods provide a way to add custom functionality while maintaining
 * protocol compatibility.
 *
 * See protocol docs: [Extensibility](https://agentclientprotocol.com/protocol/extensibility)
 */
const zExtResponse = zod_v4__rspack_import_0.z.unknown();
/**
 * Filesystem capabilities supported by the client.
 * File system capabilities that a client may support.
 *
 * See protocol docs: [FileSystem](https://agentclientprotocol.com/protocol/initialization#filesystem)
 */
const zFileSystemCapability = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    readTextFile: zod_v4__rspack_import_0.z.boolean().optional().default(false),
    writeTextFile: zod_v4__rspack_import_0.z.boolean().optional().default(false),
});
/**
 * Capabilities supported by the client.
 *
 * Advertised during initialization to inform the agent about
 * available features and methods.
 *
 * See protocol docs: [Client Capabilities](https://agentclientprotocol.com/protocol/initialization#client-capabilities)
 */
const zClientCapabilities = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    fs: zFileSystemCapability
        .optional()
        .default({ readTextFile: false, writeTextFile: false }),
    terminal: zod_v4__rspack_import_0.z.boolean().optional().default(false),
});
/**
 * An HTTP header to set when making requests to the MCP server.
 */
const zHttpHeader = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    name: zod_v4__rspack_import_0.z.string(),
    value: zod_v4__rspack_import_0.z.string(),
});
/**
 * Metadata about the implementation of the client or agent.
 * Describes the name and version of an MCP implementation, with an optional
 * title for UI representation.
 */
const zImplementation = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    name: zod_v4__rspack_import_0.z.string(),
    title: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    version: zod_v4__rspack_import_0.z.string(),
});
/**
 * Response to terminal/kill command method
 */
const zKillTerminalCommandResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Request parameters for listing existing sessions.
 *
 * Only available if the Agent supports the `listSessions` capability.
 *
 * @experimental
 */
const zListSessionsRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    cursor: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    cwd: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * MCP capabilities supported by the agent
 */
const zMcpCapabilities = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    http: zod_v4__rspack_import_0.z.boolean().optional().default(false),
    sse: zod_v4__rspack_import_0.z.boolean().optional().default(false),
});
/**
 * HTTP transport configuration for MCP.
 */
const zMcpServerHttp = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    headers: zod_v4__rspack_import_0.z.array(zHttpHeader),
    name: zod_v4__rspack_import_0.z.string(),
    url: zod_v4__rspack_import_0.z.string(),
});
/**
 * SSE transport configuration for MCP.
 */
const zMcpServerSse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    headers: zod_v4__rspack_import_0.z.array(zHttpHeader),
    name: zod_v4__rspack_import_0.z.string(),
    url: zod_v4__rspack_import_0.z.string(),
});
/**
 * Stdio transport configuration for MCP.
 */
const zMcpServerStdio = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    args: zod_v4__rspack_import_0.z.array(zod_v4__rspack_import_0.z.string()),
    command: zod_v4__rspack_import_0.z.string(),
    env: zod_v4__rspack_import_0.z.array(zEnvVariable),
    name: zod_v4__rspack_import_0.z.string(),
});
/**
 * Configuration for connecting to an MCP (Model Context Protocol) server.
 *
 * MCP servers provide tools and context that the agent can use when
 * processing prompts.
 *
 * See protocol docs: [MCP Servers](https://agentclientprotocol.com/protocol/session-setup#mcp-servers)
 */
const zMcpServer = zod_v4__rspack_import_0.z.union([
    zMcpServerHttp.and(zod_v4__rspack_import_0.z.object({
        type: zod_v4__rspack_import_0.z.literal("http"),
    })),
    zMcpServerSse.and(zod_v4__rspack_import_0.z.object({
        type: zod_v4__rspack_import_0.z.literal("sse"),
    })),
    zMcpServerStdio,
]);
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * A unique identifier for a model.
 *
 * @experimental
 */
const zModelId = zod_v4__rspack_import_0.z.string();
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Information about a selectable model.
 *
 * @experimental
 */
const zModelInfo = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    description: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    modelId: zModelId,
    name: zod_v4__rspack_import_0.z.string(),
});
/**
 * Request parameters for creating a new session.
 *
 * See protocol docs: [Creating a Session](https://agentclientprotocol.com/protocol/session-setup#creating-a-session)
 */
const zNewSessionRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    cwd: zod_v4__rspack_import_0.z.string(),
    mcpServers: zod_v4__rspack_import_0.z.array(zMcpServer),
});
/**
 * Unique identifier for a permission option.
 */
const zPermissionOptionId = zod_v4__rspack_import_0.z.string();
/**
 * The type of permission option being presented to the user.
 *
 * Helps clients choose appropriate icons and UI treatment.
 */
const zPermissionOptionKind = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.literal("allow_once"),
    zod_v4__rspack_import_0.z.literal("allow_always"),
    zod_v4__rspack_import_0.z.literal("reject_once"),
    zod_v4__rspack_import_0.z.literal("reject_always"),
]);
/**
 * An option presented to the user when requesting permission.
 */
const zPermissionOption = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    kind: zPermissionOptionKind,
    name: zod_v4__rspack_import_0.z.string(),
    optionId: zPermissionOptionId,
});
/**
 * Priority levels for plan entries.
 *
 * Used to indicate the relative importance or urgency of different
 * tasks in the execution plan.
 * See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/agent-plan#plan-entries)
 */
const zPlanEntryPriority = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.literal("high"),
    zod_v4__rspack_import_0.z.literal("medium"),
    zod_v4__rspack_import_0.z.literal("low"),
]);
/**
 * Status of a plan entry in the execution flow.
 *
 * Tracks the lifecycle of each task from planning through completion.
 * See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/agent-plan#plan-entries)
 */
const zPlanEntryStatus = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.literal("pending"),
    zod_v4__rspack_import_0.z.literal("in_progress"),
    zod_v4__rspack_import_0.z.literal("completed"),
]);
/**
 * A single entry in the execution plan.
 *
 * Represents a task or goal that the assistant intends to accomplish
 * as part of fulfilling the user's request.
 * See protocol docs: [Plan Entries](https://agentclientprotocol.com/protocol/agent-plan#plan-entries)
 */
const zPlanEntry = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    content: zod_v4__rspack_import_0.z.string(),
    priority: zPlanEntryPriority,
    status: zPlanEntryStatus,
});
/**
 * An execution plan for accomplishing complex tasks.
 *
 * Plans consist of multiple entries representing individual tasks or goals.
 * Agents report plans to clients to provide visibility into their execution strategy.
 * Plans can evolve during execution as the agent discovers new requirements or completes tasks.
 *
 * See protocol docs: [Agent Plan](https://agentclientprotocol.com/protocol/agent-plan)
 */
const zPlan = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    entries: zod_v4__rspack_import_0.z.array(zPlanEntry),
});
/**
 * Prompt capabilities supported by the agent in `session/prompt` requests.
 *
 * Baseline agent functionality requires support for [`ContentBlock::Text`]
 * and [`ContentBlock::ResourceLink`] in prompt requests.
 *
 * Other variants must be explicitly opted in to.
 * Capabilities for different types of content in prompt requests.
 *
 * Indicates which content types beyond the baseline (text and resource links)
 * the agent can process.
 *
 * See protocol docs: [Prompt Capabilities](https://agentclientprotocol.com/protocol/initialization#prompt-capabilities)
 */
const zPromptCapabilities = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    audio: zod_v4__rspack_import_0.z.boolean().optional().default(false),
    embeddedContext: zod_v4__rspack_import_0.z.boolean().optional().default(false),
    image: zod_v4__rspack_import_0.z.boolean().optional().default(false),
});
/**
 * Protocol version identifier.
 *
 * This version is only bumped for breaking changes.
 * Non-breaking changes should be introduced via capabilities.
 */
const zProtocolVersion = zod_v4__rspack_import_0.z.number().int().gte(0).lte(65535);
/**
 * Request parameters for the initialize method.
 *
 * Sent by the client to establish connection and negotiate capabilities.
 *
 * See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
 */
const zInitializeRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    clientCapabilities: zClientCapabilities.optional().default({
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
    }),
    clientInfo: zod_v4__rspack_import_0.z.union([zImplementation, zod_v4__rspack_import_0.z["null"]()]).optional(),
    protocolVersion: zProtocolVersion,
});
/**
 * Response containing the contents of a text file.
 */
const zReadTextFileResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    content: zod_v4__rspack_import_0.z.string(),
});
/**
 * Response to terminal/release method
 */
const zReleaseTerminalResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * JSON RPC Request Id
 *
 * An identifier established by the Client that MUST contain a String, Number, or NULL value if included. If it is not included it is assumed to be a notification. The value SHOULD normally not be Null [1] and Numbers SHOULD NOT contain fractional parts [2]
 *
 * The Server MUST reply with the same value in the Response object if included. This member is used to correlate the context between the two objects.
 *
 * [1] The use of Null as a value for the id member in a Request object is discouraged, because this specification uses a value of Null for Responses with an unknown id. Also, because JSON-RPC 1.0 uses an id value of Null for Notifications this could cause confusion in handling.
 *
 * [2] Fractional parts may be problematic, since many decimal fractions cannot be represented exactly as binary fractions.
 */
const zRequestId = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z["null"](),
    zod_v4__rspack_import_0.z.coerce.bigint()
        .min(BigInt("-9223372036854775808"), {
        message: "Invalid value: Expected int64 to be >= -9223372036854775808",
    })
        .max(BigInt("9223372036854775807"), {
        message: "Invalid value: Expected int64 to be <= 9223372036854775807",
    }),
    zod_v4__rspack_import_0.z.string(),
]);
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Notification to cancel an ongoing request.
 *
 * See protocol docs: [Cancellation](https://agentclientprotocol.com/protocol/cancellation)
 *
 * @experimental
 */
const zCancelRequestNotification = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    requestId: zRequestId,
});
/**
 * The sender or recipient of messages and data in a conversation.
 */
const zRole = zod_v4__rspack_import_0.z["enum"](["assistant", "user"]);
/**
 * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
 */
const zAnnotations = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    audience: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.array(zRole), zod_v4__rspack_import_0.z["null"]()]).optional(),
    lastModified: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    priority: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.number(), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * Audio provided to or from an LLM.
 */
const zAudioContent = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    annotations: zod_v4__rspack_import_0.z.union([zAnnotations, zod_v4__rspack_import_0.z["null"]()]).optional(),
    data: zod_v4__rspack_import_0.z.string(),
    mimeType: zod_v4__rspack_import_0.z.string(),
});
/**
 * An image provided to or from an LLM.
 */
const zImageContent = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    annotations: zod_v4__rspack_import_0.z.union([zAnnotations, zod_v4__rspack_import_0.z["null"]()]).optional(),
    data: zod_v4__rspack_import_0.z.string(),
    mimeType: zod_v4__rspack_import_0.z.string(),
    uri: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * A resource that the server is capable of reading, included in a prompt or tool call result.
 */
const zResourceLink = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    annotations: zod_v4__rspack_import_0.z.union([zAnnotations, zod_v4__rspack_import_0.z["null"]()]).optional(),
    description: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    mimeType: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    name: zod_v4__rspack_import_0.z.string(),
    size: zod_v4__rspack_import_0.z.union([
        zod_v4__rspack_import_0.z.coerce.bigint()
            .min(BigInt("-9223372036854775808"), {
            message: "Invalid value: Expected int64 to be >= -9223372036854775808",
        })
            .max(BigInt("9223372036854775807"), {
            message: "Invalid value: Expected int64 to be <= 9223372036854775807",
        }),
        zod_v4__rspack_import_0.z["null"](),
    ])
        .optional(),
    title: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    uri: zod_v4__rspack_import_0.z.string(),
});
/**
 * The user selected one of the provided options.
 */
const zSelectedPermissionOutcome = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    optionId: zPermissionOptionId,
});
/**
 * The outcome of a permission request.
 */
const zRequestPermissionOutcome = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.object({
        outcome: zod_v4__rspack_import_0.z.literal("cancelled"),
    }),
    zSelectedPermissionOutcome.and(zod_v4__rspack_import_0.z.object({
        outcome: zod_v4__rspack_import_0.z.literal("selected"),
    })),
]);
/**
 * Response to a permission request.
 */
const zRequestPermissionResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    outcome: zRequestPermissionOutcome,
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Unique identifier for a session configuration option value group.
 *
 * @experimental
 */
const zSessionConfigGroupId = zod_v4__rspack_import_0.z.string();
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Unique identifier for a session configuration option.
 *
 * @experimental
 */
const zSessionConfigId = zod_v4__rspack_import_0.z.string();
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Semantic category for a session configuration option.
 *
 * This is intended to help Clients distinguish broadly common selectors (e.g. model selector vs
 * session mode selector vs thought/reasoning level) for UX purposes (keyboard shortcuts, icons,
 * placement). It MUST NOT be required for correctness. Clients MUST handle missing or unknown
 * categories gracefully (treat as `Other`).
 *
 * @experimental
 */
const zSessionConfigOptionCategory = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.literal("mode"),
    zod_v4__rspack_import_0.z.literal("model"),
    zod_v4__rspack_import_0.z.literal("thought_level"),
    zod_v4__rspack_import_0.z.literal("other"),
]);
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Unique identifier for a session configuration option value.
 *
 * @experimental
 */
const zSessionConfigValueId = zod_v4__rspack_import_0.z.string();
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * A possible value for a session configuration option.
 *
 * @experimental
 */
const zSessionConfigSelectOption = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    description: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    name: zod_v4__rspack_import_0.z.string(),
    value: zSessionConfigValueId,
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * A group of possible values for a session configuration option.
 *
 * @experimental
 */
const zSessionConfigSelectGroup = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    group: zSessionConfigGroupId,
    name: zod_v4__rspack_import_0.z.string(),
    options: zod_v4__rspack_import_0.z.array(zSessionConfigSelectOption),
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Possible values for a session configuration option.
 *
 * @experimental
 */
const zSessionConfigSelectOptions = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.array(zSessionConfigSelectOption),
    zod_v4__rspack_import_0.z.array(zSessionConfigSelectGroup),
]);
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * A single-value selector (dropdown) session configuration option payload.
 *
 * @experimental
 */
const zSessionConfigSelect = zod_v4__rspack_import_0.z.object({
    currentValue: zSessionConfigValueId,
    options: zSessionConfigSelectOptions,
});
const zSessionConfigOption = zSessionConfigSelect
    .and(zod_v4__rspack_import_0.z.object({
    type: zod_v4__rspack_import_0.z.literal("select"),
}))
    .and(zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    category: zod_v4__rspack_import_0.z.union([zSessionConfigOptionCategory, zod_v4__rspack_import_0.z["null"]()]).optional(),
    description: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    id: zSessionConfigId,
    name: zod_v4__rspack_import_0.z.string(),
}));
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Session configuration options have been updated.
 *
 * @experimental
 */
const zConfigOptionUpdate = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    configOptions: zod_v4__rspack_import_0.z.array(zSessionConfigOption),
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Capabilities for the `session/fork` method.
 *
 * By supplying `{}` it means that the agent supports forking of sessions.
 *
 * @experimental
 */
const zSessionForkCapabilities = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * A unique identifier for a conversation session between a client and agent.
 *
 * Sessions maintain their own context, conversation history, and state,
 * allowing multiple independent interactions with the same agent.
 *
 * See protocol docs: [Session ID](https://agentclientprotocol.com/protocol/session-setup#session-id)
 */
const zSessionId = zod_v4__rspack_import_0.z.string();
/**
 * Notification to cancel ongoing operations for a session.
 *
 * See protocol docs: [Cancellation](https://agentclientprotocol.com/protocol/prompt-turn#cancellation)
 */
const zCancelNotification = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    sessionId: zSessionId,
});
const zClientNotification = zod_v4__rspack_import_0.z.object({
    method: zod_v4__rspack_import_0.z.string(),
    params: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.union([zCancelNotification, zExtNotification]), zod_v4__rspack_import_0.z["null"]()])
        .optional(),
});
/**
 * Request to create a new terminal and execute a command.
 */
const zCreateTerminalRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    args: zod_v4__rspack_import_0.z.array(zod_v4__rspack_import_0.z.string()).optional(),
    command: zod_v4__rspack_import_0.z.string(),
    cwd: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    env: zod_v4__rspack_import_0.z.array(zEnvVariable).optional(),
    outputByteLimit: zod_v4__rspack_import_0.z.union([
        zod_v4__rspack_import_0.z.coerce.bigint().gte(BigInt(0)).max(BigInt("18446744073709551615"), {
            message: "Invalid value: Expected uint64 to be <= 18446744073709551615",
        }),
        zod_v4__rspack_import_0.z["null"](),
    ])
        .optional(),
    sessionId: zSessionId,
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Request parameters for forking an existing session.
 *
 * Creates a new session based on the context of an existing one, allowing
 * operations like generating summaries without affecting the original session's history.
 *
 * Only available if the Agent supports the `session.fork` capability.
 *
 * @experimental
 */
const zForkSessionRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    cwd: zod_v4__rspack_import_0.z.string(),
    mcpServers: zod_v4__rspack_import_0.z.array(zMcpServer).optional(),
    sessionId: zSessionId,
});
/**
 * Request to kill a terminal command without releasing the terminal.
 */
const zKillTerminalCommandRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    sessionId: zSessionId,
    terminalId: zod_v4__rspack_import_0.z.string(),
});
/**
 * Request parameters for loading an existing session.
 *
 * Only available if the Agent supports the `loadSession` capability.
 *
 * See protocol docs: [Loading Sessions](https://agentclientprotocol.com/protocol/session-setup#loading-sessions)
 */
const zLoadSessionRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    cwd: zod_v4__rspack_import_0.z.string(),
    mcpServers: zod_v4__rspack_import_0.z.array(zMcpServer),
    sessionId: zSessionId,
});
/**
 * Request to read content from a text file.
 *
 * Only available if the client supports the `fs.readTextFile` capability.
 */
const zReadTextFileRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    limit: zod_v4__rspack_import_0.z.union([
        zod_v4__rspack_import_0.z.number().int().gte(0).max(4294967295, {
            message: "Invalid value: Expected uint32 to be <= 4294967295",
        }),
        zod_v4__rspack_import_0.z["null"](),
    ])
        .optional(),
    line: zod_v4__rspack_import_0.z.union([
        zod_v4__rspack_import_0.z.number().int().gte(0).max(4294967295, {
            message: "Invalid value: Expected uint32 to be <= 4294967295",
        }),
        zod_v4__rspack_import_0.z["null"](),
    ])
        .optional(),
    path: zod_v4__rspack_import_0.z.string(),
    sessionId: zSessionId,
});
/**
 * Request to release a terminal and free its resources.
 */
const zReleaseTerminalRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    sessionId: zSessionId,
    terminalId: zod_v4__rspack_import_0.z.string(),
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Request parameters for resuming an existing session.
 *
 * Resumes an existing session without returning previous messages (unlike `session/load`).
 * This is useful for agents that can resume sessions but don't implement full session loading.
 *
 * Only available if the Agent supports the `session.resume` capability.
 *
 * @experimental
 */
const zResumeSessionRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    cwd: zod_v4__rspack_import_0.z.string(),
    mcpServers: zod_v4__rspack_import_0.z.array(zMcpServer).optional(),
    sessionId: zSessionId,
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Information about a session returned by session/list
 *
 * @experimental
 */
const zSessionInfo = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    cwd: zod_v4__rspack_import_0.z.string(),
    sessionId: zSessionId,
    title: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    updatedAt: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Response from listing sessions.
 *
 * @experimental
 */
const zListSessionsResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    nextCursor: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    sessions: zod_v4__rspack_import_0.z.array(zSessionInfo),
});
/**
 * Update to session metadata. All fields are optional to support partial updates.
 *
 * Agents send this notification to update session information like title or custom metadata.
 * This allows clients to display dynamic session names and track session state changes.
 */
const zSessionInfoUpdate = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    title: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    updatedAt: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * Capabilities for the `session/list` method.
 *
 * By supplying `{}` it means that the agent supports listing of sessions.
 *
 * Further capabilities can be added in the future for other means of filtering or searching the list.
 */
const zSessionListCapabilities = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * Unique identifier for a Session Mode.
 */
const zSessionModeId = zod_v4__rspack_import_0.z.string();
/**
 * The current mode of the session has changed
 *
 * See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
 */
const zCurrentModeUpdate = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    currentModeId: zSessionModeId,
});
/**
 * A mode the agent can operate in.
 *
 * See protocol docs: [Session Modes](https://agentclientprotocol.com/protocol/session-modes)
 */
const zSessionMode = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    description: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    id: zSessionModeId,
    name: zod_v4__rspack_import_0.z.string(),
});
/**
 * The set of modes and the one currently active.
 */
const zSessionModeState = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    availableModes: zod_v4__rspack_import_0.z.array(zSessionMode),
    currentModeId: zSessionModeId,
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * The set of models and the one currently active.
 *
 * @experimental
 */
const zSessionModelState = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    availableModels: zod_v4__rspack_import_0.z.array(zModelInfo),
    currentModelId: zModelId,
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Response from forking an existing session.
 *
 * @experimental
 */
const zForkSessionResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    configOptions: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.array(zSessionConfigOption), zod_v4__rspack_import_0.z["null"]()]).optional(),
    models: zod_v4__rspack_import_0.z.union([zSessionModelState, zod_v4__rspack_import_0.z["null"]()]).optional(),
    modes: zod_v4__rspack_import_0.z.union([zSessionModeState, zod_v4__rspack_import_0.z["null"]()]).optional(),
    sessionId: zSessionId,
});
/**
 * Response from loading an existing session.
 */
const zLoadSessionResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    configOptions: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.array(zSessionConfigOption), zod_v4__rspack_import_0.z["null"]()]).optional(),
    models: zod_v4__rspack_import_0.z.union([zSessionModelState, zod_v4__rspack_import_0.z["null"]()]).optional(),
    modes: zod_v4__rspack_import_0.z.union([zSessionModeState, zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * Response from creating a new session.
 *
 * See protocol docs: [Creating a Session](https://agentclientprotocol.com/protocol/session-setup#creating-a-session)
 */
const zNewSessionResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    configOptions: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.array(zSessionConfigOption), zod_v4__rspack_import_0.z["null"]()]).optional(),
    models: zod_v4__rspack_import_0.z.union([zSessionModelState, zod_v4__rspack_import_0.z["null"]()]).optional(),
    modes: zod_v4__rspack_import_0.z.union([zSessionModeState, zod_v4__rspack_import_0.z["null"]()]).optional(),
    sessionId: zSessionId,
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Response from resuming an existing session.
 *
 * @experimental
 */
const zResumeSessionResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    configOptions: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.array(zSessionConfigOption), zod_v4__rspack_import_0.z["null"]()]).optional(),
    models: zod_v4__rspack_import_0.z.union([zSessionModelState, zod_v4__rspack_import_0.z["null"]()]).optional(),
    modes: zod_v4__rspack_import_0.z.union([zSessionModeState, zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Capabilities for the `session/resume` method.
 *
 * By supplying `{}` it means that the agent supports resuming of sessions.
 *
 * @experimental
 */
const zSessionResumeCapabilities = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * Session capabilities supported by the agent.
 *
 * As a baseline, all Agents **MUST** support `session/new`, `session/prompt`, `session/cancel`, and `session/update`.
 *
 * Optionally, they **MAY** support other session methods and notifications by specifying additional capabilities.
 *
 * Note: `session/load` is still handled by the top-level `load_session` capability. This will be unified in future versions of the protocol.
 *
 * See protocol docs: [Session Capabilities](https://agentclientprotocol.com/protocol/initialization#session-capabilities)
 */
const zSessionCapabilities = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    fork: zod_v4__rspack_import_0.z.union([zSessionForkCapabilities, zod_v4__rspack_import_0.z["null"]()]).optional(),
    list: zod_v4__rspack_import_0.z.union([zSessionListCapabilities, zod_v4__rspack_import_0.z["null"]()]).optional(),
    resume: zod_v4__rspack_import_0.z.union([zSessionResumeCapabilities, zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * Capabilities supported by the agent.
 *
 * Advertised during initialization to inform the client about
 * available features and content types.
 *
 * See protocol docs: [Agent Capabilities](https://agentclientprotocol.com/protocol/initialization#agent-capabilities)
 */
const zAgentCapabilities = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    loadSession: zod_v4__rspack_import_0.z.boolean().optional().default(false),
    mcpCapabilities: zMcpCapabilities
        .optional()
        .default({ http: false, sse: false }),
    promptCapabilities: zPromptCapabilities.optional().default({
        audio: false,
        embeddedContext: false,
        image: false,
    }),
    sessionCapabilities: zSessionCapabilities.optional().default({}),
});
/**
 * Response to the `initialize` method.
 *
 * Contains the negotiated protocol version and agent capabilities.
 *
 * See protocol docs: [Initialization](https://agentclientprotocol.com/protocol/initialization)
 */
const zInitializeResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    agentCapabilities: zAgentCapabilities.optional().default({
        loadSession: false,
        mcpCapabilities: { http: false, sse: false },
        promptCapabilities: {
            audio: false,
            embeddedContext: false,
            image: false,
        },
        sessionCapabilities: {},
    }),
    agentInfo: zod_v4__rspack_import_0.z.union([zImplementation, zod_v4__rspack_import_0.z["null"]()]).optional(),
    authMethods: zod_v4__rspack_import_0.z.array(zAuthMethod).optional().default([]),
    protocolVersion: zProtocolVersion,
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Request parameters for setting a session configuration option.
 *
 * @experimental
 */
const zSetSessionConfigOptionRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    configId: zSessionConfigId,
    sessionId: zSessionId,
    value: zSessionConfigValueId,
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Response to `session/set_config_option` method.
 *
 * @experimental
 */
const zSetSessionConfigOptionResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    configOptions: zod_v4__rspack_import_0.z.array(zSessionConfigOption),
});
/**
 * Request parameters for setting a session mode.
 */
const zSetSessionModeRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    modeId: zSessionModeId,
    sessionId: zSessionId,
});
/**
 * Response to `session/set_mode` method.
 */
const zSetSessionModeResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Request parameters for setting a session model.
 *
 * @experimental
 */
const zSetSessionModelRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    modelId: zModelId,
    sessionId: zSessionId,
});
/**
 * **UNSTABLE**
 *
 * This capability is not part of the spec yet, and may be removed or changed at any point.
 *
 * Response to `session/set_model` method.
 *
 * @experimental
 */
const zSetSessionModelResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * Reasons why an agent stops processing a prompt turn.
 *
 * See protocol docs: [Stop Reasons](https://agentclientprotocol.com/protocol/prompt-turn#stop-reasons)
 */
const zStopReason = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.literal("end_turn"),
    zod_v4__rspack_import_0.z.literal("max_tokens"),
    zod_v4__rspack_import_0.z.literal("max_turn_requests"),
    zod_v4__rspack_import_0.z.literal("refusal"),
    zod_v4__rspack_import_0.z.literal("cancelled"),
]);
/**
 * Response from processing a user prompt.
 *
 * See protocol docs: [Check for Completion](https://agentclientprotocol.com/protocol/prompt-turn#4-check-for-completion)
 */
const zPromptResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    stopReason: zStopReason,
});
const zAgentResponse = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.object({
        id: zRequestId,
        result: zod_v4__rspack_import_0.z.union([
            zInitializeResponse,
            zAuthenticateResponse,
            zNewSessionResponse,
            zLoadSessionResponse,
            zListSessionsResponse,
            zForkSessionResponse,
            zResumeSessionResponse,
            zSetSessionModeResponse,
            zSetSessionConfigOptionResponse,
            zPromptResponse,
            zSetSessionModelResponse,
            zExtResponse,
        ]),
    }),
    zod_v4__rspack_import_0.z.object({
        error: zError,
        id: zRequestId,
    }),
]);
/**
 * Embed a terminal created with `terminal/create` by its id.
 *
 * The terminal must be added before calling `terminal/release`.
 *
 * See protocol docs: [Terminal](https://agentclientprotocol.com/protocol/terminals)
 */
const zTerminal = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    terminalId: zod_v4__rspack_import_0.z.string(),
});
/**
 * Exit status of a terminal command.
 */
const zTerminalExitStatus = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    exitCode: zod_v4__rspack_import_0.z.union([
        zod_v4__rspack_import_0.z.number().int().gte(0).max(4294967295, {
            message: "Invalid value: Expected uint32 to be <= 4294967295",
        }),
        zod_v4__rspack_import_0.z["null"](),
    ])
        .optional(),
    signal: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * Request to get the current output and status of a terminal.
 */
const zTerminalOutputRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    sessionId: zSessionId,
    terminalId: zod_v4__rspack_import_0.z.string(),
});
/**
 * Response containing the terminal output and exit status.
 */
const zTerminalOutputResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    exitStatus: zod_v4__rspack_import_0.z.union([zTerminalExitStatus, zod_v4__rspack_import_0.z["null"]()]).optional(),
    output: zod_v4__rspack_import_0.z.string(),
    truncated: zod_v4__rspack_import_0.z.boolean(),
});
/**
 * Text provided to or from an LLM.
 */
const zTextContent = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    annotations: zod_v4__rspack_import_0.z.union([zAnnotations, zod_v4__rspack_import_0.z["null"]()]).optional(),
    text: zod_v4__rspack_import_0.z.string(),
});
/**
 * Text-based resource contents.
 */
const zTextResourceContents = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    mimeType: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    text: zod_v4__rspack_import_0.z.string(),
    uri: zod_v4__rspack_import_0.z.string(),
});
/**
 * Resource content that can be embedded in a message.
 */
const zEmbeddedResourceResource = zod_v4__rspack_import_0.z.union([
    zTextResourceContents,
    zBlobResourceContents,
]);
/**
 * The contents of a resource, embedded into a prompt or tool call result.
 */
const zEmbeddedResource = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    annotations: zod_v4__rspack_import_0.z.union([zAnnotations, zod_v4__rspack_import_0.z["null"]()]).optional(),
    resource: zEmbeddedResourceResource,
});
/**
 * Content blocks represent displayable information in the Agent Client Protocol.
 *
 * They provide a structured way to handle various types of user-facing content—whether
 * it's text from language models, images for analysis, or embedded resources for context.
 *
 * Content blocks appear in:
 * - User prompts sent via `session/prompt`
 * - Language model output streamed through `session/update` notifications
 * - Progress updates and results from tool calls
 *
 * This structure is compatible with the Model Context Protocol (MCP), enabling
 * agents to seamlessly forward content from MCP tool outputs without transformation.
 *
 * See protocol docs: [Content](https://agentclientprotocol.com/protocol/content)
 */
const zContentBlock = zod_v4__rspack_import_0.z.union([
    zTextContent.and(zod_v4__rspack_import_0.z.object({
        type: zod_v4__rspack_import_0.z.literal("text"),
    })),
    zImageContent.and(zod_v4__rspack_import_0.z.object({
        type: zod_v4__rspack_import_0.z.literal("image"),
    })),
    zAudioContent.and(zod_v4__rspack_import_0.z.object({
        type: zod_v4__rspack_import_0.z.literal("audio"),
    })),
    zResourceLink.and(zod_v4__rspack_import_0.z.object({
        type: zod_v4__rspack_import_0.z.literal("resource_link"),
    })),
    zEmbeddedResource.and(zod_v4__rspack_import_0.z.object({
        type: zod_v4__rspack_import_0.z.literal("resource"),
    })),
]);
/**
 * Standard content block (text, images, resources).
 */
const zContent = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    content: zContentBlock,
});
/**
 * A streamed item of content
 */
const zContentChunk = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    content: zContentBlock,
});
/**
 * Request parameters for sending a user prompt to the agent.
 *
 * Contains the user's message and any additional context.
 *
 * See protocol docs: [User Message](https://agentclientprotocol.com/protocol/prompt-turn#1-user-message)
 */
const zPromptRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    prompt: zod_v4__rspack_import_0.z.array(zContentBlock),
    sessionId: zSessionId,
});
const zClientRequest = zod_v4__rspack_import_0.z.object({
    id: zRequestId,
    method: zod_v4__rspack_import_0.z.string(),
    params: zod_v4__rspack_import_0.z.union([
        zod_v4__rspack_import_0.z.union([
            zInitializeRequest,
            zAuthenticateRequest,
            zNewSessionRequest,
            zLoadSessionRequest,
            zListSessionsRequest,
            zForkSessionRequest,
            zResumeSessionRequest,
            zSetSessionModeRequest,
            zSetSessionConfigOptionRequest,
            zPromptRequest,
            zSetSessionModelRequest,
            zExtRequest,
        ]),
        zod_v4__rspack_import_0.z["null"](),
    ])
        .optional(),
});
/**
 * Content produced by a tool call.
 *
 * Tool calls can produce different types of content including
 * standard content blocks (text, images) or file diffs.
 *
 * See protocol docs: [Content](https://agentclientprotocol.com/protocol/tool-calls#content)
 */
const zToolCallContent = zod_v4__rspack_import_0.z.union([
    zContent.and(zod_v4__rspack_import_0.z.object({
        type: zod_v4__rspack_import_0.z.literal("content"),
    })),
    zDiff.and(zod_v4__rspack_import_0.z.object({
        type: zod_v4__rspack_import_0.z.literal("diff"),
    })),
    zTerminal.and(zod_v4__rspack_import_0.z.object({
        type: zod_v4__rspack_import_0.z.literal("terminal"),
    })),
]);
/**
 * Unique identifier for a tool call within a session.
 */
const zToolCallId = zod_v4__rspack_import_0.z.string();
/**
 * A file location being accessed or modified by a tool.
 *
 * Enables clients to implement "follow-along" features that track
 * which files the agent is working with in real-time.
 *
 * See protocol docs: [Following the Agent](https://agentclientprotocol.com/protocol/tool-calls#following-the-agent)
 */
const zToolCallLocation = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    line: zod_v4__rspack_import_0.z.union([
        zod_v4__rspack_import_0.z.number().int().gte(0).max(4294967295, {
            message: "Invalid value: Expected uint32 to be <= 4294967295",
        }),
        zod_v4__rspack_import_0.z["null"](),
    ])
        .optional(),
    path: zod_v4__rspack_import_0.z.string(),
});
/**
 * Execution status of a tool call.
 *
 * Tool calls progress through different statuses during their lifecycle.
 *
 * See protocol docs: [Status](https://agentclientprotocol.com/protocol/tool-calls#status)
 */
const zToolCallStatus = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.literal("pending"),
    zod_v4__rspack_import_0.z.literal("in_progress"),
    zod_v4__rspack_import_0.z.literal("completed"),
    zod_v4__rspack_import_0.z.literal("failed"),
]);
/**
 * Categories of tools that can be invoked.
 *
 * Tool kinds help clients choose appropriate icons and optimize how they
 * display tool execution progress.
 *
 * See protocol docs: [Creating](https://agentclientprotocol.com/protocol/tool-calls#creating)
 */
const zToolKind = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.literal("read"),
    zod_v4__rspack_import_0.z.literal("edit"),
    zod_v4__rspack_import_0.z.literal("delete"),
    zod_v4__rspack_import_0.z.literal("move"),
    zod_v4__rspack_import_0.z.literal("search"),
    zod_v4__rspack_import_0.z.literal("execute"),
    zod_v4__rspack_import_0.z.literal("think"),
    zod_v4__rspack_import_0.z.literal("fetch"),
    zod_v4__rspack_import_0.z.literal("switch_mode"),
    zod_v4__rspack_import_0.z.literal("other"),
]);
/**
 * Represents a tool call that the language model has requested.
 *
 * Tool calls are actions that the agent executes on behalf of the language model,
 * such as reading files, executing code, or fetching data from external sources.
 *
 * See protocol docs: [Tool Calls](https://agentclientprotocol.com/protocol/tool-calls)
 */
const zToolCall = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    content: zod_v4__rspack_import_0.z.array(zToolCallContent).optional(),
    kind: zToolKind.optional(),
    locations: zod_v4__rspack_import_0.z.array(zToolCallLocation).optional(),
    rawInput: zod_v4__rspack_import_0.z.unknown().optional(),
    rawOutput: zod_v4__rspack_import_0.z.unknown().optional(),
    status: zToolCallStatus.optional(),
    title: zod_v4__rspack_import_0.z.string(),
    toolCallId: zToolCallId,
});
/**
 * An update to an existing tool call.
 *
 * Used to report progress and results as tools execute. All fields except
 * the tool call ID are optional - only changed fields need to be included.
 *
 * See protocol docs: [Updating](https://agentclientprotocol.com/protocol/tool-calls#updating)
 */
const zToolCallUpdate = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    content: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.array(zToolCallContent), zod_v4__rspack_import_0.z["null"]()]).optional(),
    kind: zod_v4__rspack_import_0.z.union([zToolKind, zod_v4__rspack_import_0.z["null"]()]).optional(),
    locations: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.array(zToolCallLocation), zod_v4__rspack_import_0.z["null"]()]).optional(),
    rawInput: zod_v4__rspack_import_0.z.unknown().optional(),
    rawOutput: zod_v4__rspack_import_0.z.unknown().optional(),
    status: zod_v4__rspack_import_0.z.union([zToolCallStatus, zod_v4__rspack_import_0.z["null"]()]).optional(),
    title: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
    toolCallId: zToolCallId,
});
/**
 * Request for user permission to execute a tool call.
 *
 * Sent when the agent needs authorization before performing a sensitive operation.
 *
 * See protocol docs: [Requesting Permission](https://agentclientprotocol.com/protocol/tool-calls#requesting-permission)
 */
const zRequestPermissionRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    options: zod_v4__rspack_import_0.z.array(zPermissionOption),
    sessionId: zSessionId,
    toolCall: zToolCallUpdate,
});
/**
 * All text that was typed after the command name is provided as input.
 */
const zUnstructuredCommandInput = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    hint: zod_v4__rspack_import_0.z.string(),
});
/**
 * All text that was typed after the command name is provided as input.
 */
const zAvailableCommandInput = zUnstructuredCommandInput;
/**
 * Information about a command.
 */
const zAvailableCommand = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    description: zod_v4__rspack_import_0.z.string(),
    input: zod_v4__rspack_import_0.z.union([zAvailableCommandInput, zod_v4__rspack_import_0.z["null"]()]).optional(),
    name: zod_v4__rspack_import_0.z.string(),
});
/**
 * Available commands are ready or have changed
 */
const zAvailableCommandsUpdate = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    availableCommands: zod_v4__rspack_import_0.z.array(zAvailableCommand),
});
/**
 * Different types of updates that can be sent during session processing.
 *
 * These updates provide real-time feedback about the agent's progress.
 *
 * See protocol docs: [Agent Reports Output](https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output)
 */
const zSessionUpdate = zod_v4__rspack_import_0.z.union([
    zContentChunk.and(zod_v4__rspack_import_0.z.object({
        sessionUpdate: zod_v4__rspack_import_0.z.literal("user_message_chunk"),
    })),
    zContentChunk.and(zod_v4__rspack_import_0.z.object({
        sessionUpdate: zod_v4__rspack_import_0.z.literal("agent_message_chunk"),
    })),
    zContentChunk.and(zod_v4__rspack_import_0.z.object({
        sessionUpdate: zod_v4__rspack_import_0.z.literal("agent_thought_chunk"),
    })),
    zToolCall.and(zod_v4__rspack_import_0.z.object({
        sessionUpdate: zod_v4__rspack_import_0.z.literal("tool_call"),
    })),
    zToolCallUpdate.and(zod_v4__rspack_import_0.z.object({
        sessionUpdate: zod_v4__rspack_import_0.z.literal("tool_call_update"),
    })),
    zPlan.and(zod_v4__rspack_import_0.z.object({
        sessionUpdate: zod_v4__rspack_import_0.z.literal("plan"),
    })),
    zAvailableCommandsUpdate.and(zod_v4__rspack_import_0.z.object({
        sessionUpdate: zod_v4__rspack_import_0.z.literal("available_commands_update"),
    })),
    zCurrentModeUpdate.and(zod_v4__rspack_import_0.z.object({
        sessionUpdate: zod_v4__rspack_import_0.z.literal("current_mode_update"),
    })),
    zConfigOptionUpdate.and(zod_v4__rspack_import_0.z.object({
        sessionUpdate: zod_v4__rspack_import_0.z.literal("config_option_update"),
    })),
    zSessionInfoUpdate.and(zod_v4__rspack_import_0.z.object({
        sessionUpdate: zod_v4__rspack_import_0.z.literal("session_info_update"),
    })),
]);
/**
 * Notification containing a session update from the agent.
 *
 * Used to stream real-time progress and results during prompt processing.
 *
 * See protocol docs: [Agent Reports Output](https://agentclientprotocol.com/protocol/prompt-turn#3-agent-reports-output)
 */
const zSessionNotification = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    sessionId: zSessionId,
    update: zSessionUpdate,
});
const zAgentNotification = zod_v4__rspack_import_0.z.object({
    method: zod_v4__rspack_import_0.z.string(),
    params: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.union([zSessionNotification, zExtNotification]), zod_v4__rspack_import_0.z["null"]()])
        .optional(),
});
/**
 * Request to wait for a terminal command to exit.
 */
const zWaitForTerminalExitRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    sessionId: zSessionId,
    terminalId: zod_v4__rspack_import_0.z.string(),
});
/**
 * Response containing the exit status of a terminal command.
 */
const zWaitForTerminalExitResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    exitCode: zod_v4__rspack_import_0.z.union([
        zod_v4__rspack_import_0.z.number().int().gte(0).max(4294967295, {
            message: "Invalid value: Expected uint32 to be <= 4294967295",
        }),
        zod_v4__rspack_import_0.z["null"](),
    ])
        .optional(),
    signal: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
/**
 * Request to write content to a text file.
 *
 * Only available if the client supports the `fs.writeTextFile` capability.
 */
const zWriteTextFileRequest = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
    content: zod_v4__rspack_import_0.z.string(),
    path: zod_v4__rspack_import_0.z.string(),
    sessionId: zSessionId,
});
const zAgentRequest = zod_v4__rspack_import_0.z.object({
    id: zRequestId,
    method: zod_v4__rspack_import_0.z.string(),
    params: zod_v4__rspack_import_0.z.union([
        zod_v4__rspack_import_0.z.union([
            zWriteTextFileRequest,
            zReadTextFileRequest,
            zRequestPermissionRequest,
            zCreateTerminalRequest,
            zTerminalOutputRequest,
            zReleaseTerminalRequest,
            zWaitForTerminalExitRequest,
            zKillTerminalCommandRequest,
            zExtRequest,
        ]),
        zod_v4__rspack_import_0.z["null"](),
    ])
        .optional(),
});
/**
 * Response to `fs/write_text_file`
 */
const zWriteTextFileResponse = zod_v4__rspack_import_0.z.object({
    _meta: zod_v4__rspack_import_0.z.union([zod_v4__rspack_import_0.z.record(zod_v4__rspack_import_0.z.string(), zod_v4__rspack_import_0.z.unknown()), zod_v4__rspack_import_0.z["null"]()]).optional(),
});
const zClientResponse = zod_v4__rspack_import_0.z.union([
    zod_v4__rspack_import_0.z.object({
        id: zRequestId,
        result: zod_v4__rspack_import_0.z.union([
            zWriteTextFileResponse,
            zReadTextFileResponse,
            zRequestPermissionResponse,
            zCreateTerminalResponse,
            zTerminalOutputResponse,
            zReleaseTerminalResponse,
            zWaitForTerminalExitResponse,
            zKillTerminalCommandResponse,
            zExtResponse,
        ]),
    }),
    zod_v4__rspack_import_0.z.object({
        error: zError,
        id: zRequestId,
    }),
]);
//# sourceMappingURL=zod.gen.js.map

},
"./node_modules/.pnpm/@agentclientprotocol+sdk@0.13.0_zod@4.3.5/node_modules/@agentclientprotocol/sdk/dist/stream.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  ndJsonStream: () => (ndJsonStream)
});
/**
 * Creates an ACP Stream from a pair of newline-delimited JSON streams.
 *
 * This is the typical way to handle ACP connections over stdio, converting
 * between AnyMessage objects and newline-delimited JSON.
 *
 * @param output - The writable stream to send encoded messages to
 * @param input - The readable stream to receive encoded messages from
 * @returns A Stream for bidirectional ACP communication
 */
function ndJsonStream(output, input) {
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();
    const readable = new ReadableStream({
        async start(controller) {
            let content = "";
            const reader = input.getReader();
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) {
                        break;
                    }
                    if (!value) {
                        continue;
                    }
                    content += textDecoder.decode(value, { stream: true });
                    const lines = content.split("\n");
                    content = lines.pop() || "";
                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine) {
                            try {
                                const message = JSON.parse(trimmedLine);
                                controller.enqueue(message);
                            }
                            catch (err) {
                                console.error("Failed to parse JSON message:", trimmedLine, err);
                            }
                        }
                    }
                }
            }
            finally {
                reader.releaseLock();
                controller.close();
            }
        },
    });
    const writable = new WritableStream({
        async write(message) {
            const content = JSON.stringify(message) + "\n";
            const writer = output.getWriter();
            try {
                await writer.write(textEncoder.encode(content));
            }
            finally {
                writer.releaseLock();
            }
        },
    });
    return { readable, writable };
}
//# sourceMappingURL=stream.js.map

},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/checks.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  endsWith: () => (/* reexport safe */ _core_index_js__rspack_import_0._endsWith),
  gt: () => (/* reexport safe */ _core_index_js__rspack_import_0._gt),
  gte: () => (/* reexport safe */ _core_index_js__rspack_import_0._gte),
  includes: () => (/* reexport safe */ _core_index_js__rspack_import_0._includes),
  length: () => (/* reexport safe */ _core_index_js__rspack_import_0._length),
  lowercase: () => (/* reexport safe */ _core_index_js__rspack_import_0._lowercase),
  lt: () => (/* reexport safe */ _core_index_js__rspack_import_0._lt),
  lte: () => (/* reexport safe */ _core_index_js__rspack_import_0._lte),
  maxLength: () => (/* reexport safe */ _core_index_js__rspack_import_0._maxLength),
  maxSize: () => (/* reexport safe */ _core_index_js__rspack_import_0._maxSize),
  mime: () => (/* reexport safe */ _core_index_js__rspack_import_0._mime),
  minLength: () => (/* reexport safe */ _core_index_js__rspack_import_0._minLength),
  minSize: () => (/* reexport safe */ _core_index_js__rspack_import_0._minSize),
  multipleOf: () => (/* reexport safe */ _core_index_js__rspack_import_0._multipleOf),
  negative: () => (/* reexport safe */ _core_index_js__rspack_import_0._negative),
  nonnegative: () => (/* reexport safe */ _core_index_js__rspack_import_0._nonnegative),
  nonpositive: () => (/* reexport safe */ _core_index_js__rspack_import_0._nonpositive),
  normalize: () => (/* reexport safe */ _core_index_js__rspack_import_0._normalize),
  overwrite: () => (/* reexport safe */ _core_index_js__rspack_import_0._overwrite),
  positive: () => (/* reexport safe */ _core_index_js__rspack_import_0._positive),
  property: () => (/* reexport safe */ _core_index_js__rspack_import_0._property),
  regex: () => (/* reexport safe */ _core_index_js__rspack_import_0._regex),
  size: () => (/* reexport safe */ _core_index_js__rspack_import_0._size),
  slugify: () => (/* reexport safe */ _core_index_js__rspack_import_0._slugify),
  startsWith: () => (/* reexport safe */ _core_index_js__rspack_import_0._startsWith),
  toLowerCase: () => (/* reexport safe */ _core_index_js__rspack_import_0._toLowerCase),
  toUpperCase: () => (/* reexport safe */ _core_index_js__rspack_import_0._toUpperCase),
  trim: () => (/* reexport safe */ _core_index_js__rspack_import_0._trim),
  uppercase: () => (/* reexport safe */ _core_index_js__rspack_import_0._uppercase)
});
/* import */ var _core_index_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/index.js");



},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/coerce.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  bigint: () => (bigint),
  boolean: () => (boolean),
  date: () => (date),
  number: () => (number),
  string: () => (string)
});
/* import */ var _core_index_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/index.js");
/* import */ var _schemas_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/schemas.js");


function string(params) {
    return _core_index_js__rspack_import_0._coercedString(_schemas_js__rspack_import_1.ZodString, params);
}
function number(params) {
    return _core_index_js__rspack_import_0._coercedNumber(_schemas_js__rspack_import_1.ZodNumber, params);
}
function boolean(params) {
    return _core_index_js__rspack_import_0._coercedBoolean(_schemas_js__rspack_import_1.ZodBoolean, params);
}
function bigint(params) {
    return _core_index_js__rspack_import_0._coercedBigint(_schemas_js__rspack_import_1.ZodBigInt, params);
}
function date(params) {
    return _core_index_js__rspack_import_0._coercedDate(_schemas_js__rspack_import_1.ZodDate, params);
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/compat.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  $brand: () => (/* reexport safe */ _core_index_js__rspack_import_0.$brand),
  ZodFirstPartyTypeKind: () => (ZodFirstPartyTypeKind),
  ZodIssueCode: () => (ZodIssueCode),
  config: () => (/* reexport safe */ _core_index_js__rspack_import_0.config),
  getErrorMap: () => (getErrorMap),
  setErrorMap: () => (setErrorMap)
});
/* import */ var _core_index_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/index.js");
// Zod 3 compat layer

/** @deprecated Use the raw string literal codes instead, e.g. "invalid_type". */
const ZodIssueCode = {
    invalid_type: "invalid_type",
    too_big: "too_big",
    too_small: "too_small",
    invalid_format: "invalid_format",
    not_multiple_of: "not_multiple_of",
    unrecognized_keys: "unrecognized_keys",
    invalid_union: "invalid_union",
    invalid_key: "invalid_key",
    invalid_element: "invalid_element",
    invalid_value: "invalid_value",
    custom: "custom",
};

/** @deprecated Use `z.config(params)` instead. */
function setErrorMap(map) {
    _core_index_js__rspack_import_0.config({
        customError: map,
    });
}
/** @deprecated Use `z.config()` instead. */
function getErrorMap() {
    return _core_index_js__rspack_import_0.config().customError;
}
/** @deprecated Do not use. Stub definition, only included for zod-to-json-schema compatibility. */
var ZodFirstPartyTypeKind;
(function (ZodFirstPartyTypeKind) {
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/errors.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  ZodError: () => (ZodError),
  ZodRealError: () => (ZodRealError)
});
/* import */ var _core_index_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/index.js");
/* import */ var _core_util_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");



const initializer = (inst, issues) => {
    _core_index_js__rspack_import_0.$ZodError.init(inst, issues);
    inst.name = "ZodError";
    Object.defineProperties(inst, {
        format: {
            value: (mapper) => _core_index_js__rspack_import_0.formatError(inst, mapper),
            // enumerable: false,
        },
        flatten: {
            value: (mapper) => _core_index_js__rspack_import_0.flattenError(inst, mapper),
            // enumerable: false,
        },
        addIssue: {
            value: (issue) => {
                inst.issues.push(issue);
                inst.message = JSON.stringify(inst.issues, _core_util_js__rspack_import_1.jsonStringifyReplacer, 2);
            },
            // enumerable: false,
        },
        addIssues: {
            value: (issues) => {
                inst.issues.push(...issues);
                inst.message = JSON.stringify(inst.issues, _core_util_js__rspack_import_1.jsonStringifyReplacer, 2);
            },
            // enumerable: false,
        },
        isEmpty: {
            get() {
                return inst.issues.length === 0;
            },
            // enumerable: false,
        },
    });
    // Object.defineProperty(inst, "isEmpty", {
    //   get() {
    //     return inst.issues.length === 0;
    //   },
    // });
};
const ZodError = _core_index_js__rspack_import_0.$constructor("ZodError", initializer);
const ZodRealError = _core_index_js__rspack_import_0.$constructor("ZodError", initializer, {
    Parent: Error,
});
// /** @deprecated Use `z.core.$ZodErrorMapCtx` instead. */
// export type ErrorMapCtx = core.$ZodErrorMapCtx;


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/external.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  $brand: () => (/* reexport safe */ _core_index_js__rspack_import_0.$brand),
  $input: () => (/* reexport safe */ _core_index_js__rspack_import_0.$input),
  $output: () => (/* reexport safe */ _core_index_js__rspack_import_0.$output),
  NEVER: () => (/* reexport safe */ _core_index_js__rspack_import_0.NEVER),
  TimePrecision: () => (/* reexport safe */ _core_index_js__rspack_import_0.TimePrecision),
  ZodAny: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodAny),
  ZodArray: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodArray),
  ZodBase64: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodBase64),
  ZodBase64URL: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodBase64URL),
  ZodBigInt: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodBigInt),
  ZodBigIntFormat: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodBigIntFormat),
  ZodBoolean: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodBoolean),
  ZodCIDRv4: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodCIDRv4),
  ZodCIDRv6: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodCIDRv6),
  ZodCUID: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodCUID),
  ZodCUID2: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodCUID2),
  ZodCatch: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodCatch),
  ZodCodec: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodCodec),
  ZodCustom: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodCustom),
  ZodCustomStringFormat: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodCustomStringFormat),
  ZodDate: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodDate),
  ZodDefault: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodDefault),
  ZodDiscriminatedUnion: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodDiscriminatedUnion),
  ZodE164: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodE164),
  ZodEmail: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodEmail),
  ZodEmoji: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodEmoji),
  ZodEnum: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodEnum),
  ZodError: () => (/* reexport safe */ _errors_js__rspack_import_3.ZodError),
  ZodExactOptional: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodExactOptional),
  ZodFile: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodFile),
  ZodFirstPartyTypeKind: () => (/* reexport safe */ _compat_js__rspack_import_5.ZodFirstPartyTypeKind),
  ZodFunction: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodFunction),
  ZodGUID: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodGUID),
  ZodIPv4: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodIPv4),
  ZodIPv6: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodIPv6),
  ZodISODate: () => (/* reexport safe */ _iso_js__rspack_import_10.ZodISODate),
  ZodISODateTime: () => (/* reexport safe */ _iso_js__rspack_import_10.ZodISODateTime),
  ZodISODuration: () => (/* reexport safe */ _iso_js__rspack_import_10.ZodISODuration),
  ZodISOTime: () => (/* reexport safe */ _iso_js__rspack_import_10.ZodISOTime),
  ZodIntersection: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodIntersection),
  ZodIssueCode: () => (/* reexport safe */ _compat_js__rspack_import_5.ZodIssueCode),
  ZodJWT: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodJWT),
  ZodKSUID: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodKSUID),
  ZodLazy: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodLazy),
  ZodLiteral: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodLiteral),
  ZodMAC: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodMAC),
  ZodMap: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodMap),
  ZodNaN: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodNaN),
  ZodNanoID: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodNanoID),
  ZodNever: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodNever),
  ZodNonOptional: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodNonOptional),
  ZodNull: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodNull),
  ZodNullable: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodNullable),
  ZodNumber: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodNumber),
  ZodNumberFormat: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodNumberFormat),
  ZodObject: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodObject),
  ZodOptional: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodOptional),
  ZodPipe: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodPipe),
  ZodPrefault: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodPrefault),
  ZodPromise: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodPromise),
  ZodReadonly: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodReadonly),
  ZodRealError: () => (/* reexport safe */ _errors_js__rspack_import_3.ZodRealError),
  ZodRecord: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodRecord),
  ZodSet: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodSet),
  ZodString: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodString),
  ZodStringFormat: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodStringFormat),
  ZodSuccess: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodSuccess),
  ZodSymbol: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodSymbol),
  ZodTemplateLiteral: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodTemplateLiteral),
  ZodTransform: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodTransform),
  ZodTuple: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodTuple),
  ZodType: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodType),
  ZodULID: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodULID),
  ZodURL: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodURL),
  ZodUUID: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodUUID),
  ZodUndefined: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodUndefined),
  ZodUnion: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodUnion),
  ZodUnknown: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodUnknown),
  ZodVoid: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodVoid),
  ZodXID: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodXID),
  ZodXor: () => (/* reexport safe */ _schemas_js__rspack_import_1.ZodXor),
  _ZodString: () => (/* reexport safe */ _schemas_js__rspack_import_1._ZodString),
  _default: () => (/* reexport safe */ _schemas_js__rspack_import_1._default),
  _function: () => (/* reexport safe */ _schemas_js__rspack_import_1._function),
  any: () => (/* reexport safe */ _schemas_js__rspack_import_1.any),
  array: () => (/* reexport safe */ _schemas_js__rspack_import_1.array),
  base64: () => (/* reexport safe */ _schemas_js__rspack_import_1.base64),
  base64url: () => (/* reexport safe */ _schemas_js__rspack_import_1.base64url),
  bigint: () => (/* reexport safe */ _schemas_js__rspack_import_1.bigint),
  boolean: () => (/* reexport safe */ _schemas_js__rspack_import_1.boolean),
  "catch": () => (/* reexport safe */ _schemas_js__rspack_import_1["catch"]),
  check: () => (/* reexport safe */ _schemas_js__rspack_import_1.check),
  cidrv4: () => (/* reexport safe */ _schemas_js__rspack_import_1.cidrv4),
  cidrv6: () => (/* reexport safe */ _schemas_js__rspack_import_1.cidrv6),
  clone: () => (/* reexport safe */ _core_index_js__rspack_import_0.clone),
  codec: () => (/* reexport safe */ _schemas_js__rspack_import_1.codec),
  coerce: () => (/* reexport module object */ _coerce_js__rspack_import_11),
  config: () => (/* reexport safe */ _core_index_js__rspack_import_0.config),
  core: () => (/* reexport module object */ _core_index_js__rspack_import_0),
  cuid: () => (/* reexport safe */ _schemas_js__rspack_import_1.cuid),
  cuid2: () => (/* reexport safe */ _schemas_js__rspack_import_1.cuid2),
  custom: () => (/* reexport safe */ _schemas_js__rspack_import_1.custom),
  date: () => (/* reexport safe */ _schemas_js__rspack_import_1.date),
  decode: () => (/* reexport safe */ _parse_js__rspack_import_4.decode),
  decodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_4.decodeAsync),
  describe: () => (/* reexport safe */ _schemas_js__rspack_import_1.describe),
  discriminatedUnion: () => (/* reexport safe */ _schemas_js__rspack_import_1.discriminatedUnion),
  e164: () => (/* reexport safe */ _schemas_js__rspack_import_1.e164),
  email: () => (/* reexport safe */ _schemas_js__rspack_import_1.email),
  emoji: () => (/* reexport safe */ _schemas_js__rspack_import_1.emoji),
  encode: () => (/* reexport safe */ _parse_js__rspack_import_4.encode),
  encodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_4.encodeAsync),
  endsWith: () => (/* reexport safe */ _checks_js__rspack_import_2.endsWith),
  "enum": () => (/* reexport safe */ _schemas_js__rspack_import_1["enum"]),
  exactOptional: () => (/* reexport safe */ _schemas_js__rspack_import_1.exactOptional),
  file: () => (/* reexport safe */ _schemas_js__rspack_import_1.file),
  flattenError: () => (/* reexport safe */ _core_index_js__rspack_import_0.flattenError),
  float32: () => (/* reexport safe */ _schemas_js__rspack_import_1.float32),
  float64: () => (/* reexport safe */ _schemas_js__rspack_import_1.float64),
  formatError: () => (/* reexport safe */ _core_index_js__rspack_import_0.formatError),
  fromJSONSchema: () => (/* reexport safe */ _from_json_schema_js__rspack_import_8.fromJSONSchema),
  "function": () => (/* reexport safe */ _schemas_js__rspack_import_1["function"]),
  getErrorMap: () => (/* reexport safe */ _compat_js__rspack_import_5.getErrorMap),
  globalRegistry: () => (/* reexport safe */ _core_index_js__rspack_import_0.globalRegistry),
  gt: () => (/* reexport safe */ _checks_js__rspack_import_2.gt),
  gte: () => (/* reexport safe */ _checks_js__rspack_import_2.gte),
  guid: () => (/* reexport safe */ _schemas_js__rspack_import_1.guid),
  hash: () => (/* reexport safe */ _schemas_js__rspack_import_1.hash),
  hex: () => (/* reexport safe */ _schemas_js__rspack_import_1.hex),
  hostname: () => (/* reexport safe */ _schemas_js__rspack_import_1.hostname),
  httpUrl: () => (/* reexport safe */ _schemas_js__rspack_import_1.httpUrl),
  includes: () => (/* reexport safe */ _checks_js__rspack_import_2.includes),
  "instanceof": () => (/* reexport safe */ _schemas_js__rspack_import_1["instanceof"]),
  int: () => (/* reexport safe */ _schemas_js__rspack_import_1.int),
  int32: () => (/* reexport safe */ _schemas_js__rspack_import_1.int32),
  int64: () => (/* reexport safe */ _schemas_js__rspack_import_1.int64),
  intersection: () => (/* reexport safe */ _schemas_js__rspack_import_1.intersection),
  ipv4: () => (/* reexport safe */ _schemas_js__rspack_import_1.ipv4),
  ipv6: () => (/* reexport safe */ _schemas_js__rspack_import_1.ipv6),
  iso: () => (/* reexport module object */ _iso_js__rspack_import_10),
  json: () => (/* reexport safe */ _schemas_js__rspack_import_1.json),
  jwt: () => (/* reexport safe */ _schemas_js__rspack_import_1.jwt),
  keyof: () => (/* reexport safe */ _schemas_js__rspack_import_1.keyof),
  ksuid: () => (/* reexport safe */ _schemas_js__rspack_import_1.ksuid),
  lazy: () => (/* reexport safe */ _schemas_js__rspack_import_1.lazy),
  length: () => (/* reexport safe */ _checks_js__rspack_import_2.length),
  literal: () => (/* reexport safe */ _schemas_js__rspack_import_1.literal),
  locales: () => (/* reexport module object */ _locales_index_js__rspack_import_9),
  looseObject: () => (/* reexport safe */ _schemas_js__rspack_import_1.looseObject),
  looseRecord: () => (/* reexport safe */ _schemas_js__rspack_import_1.looseRecord),
  lowercase: () => (/* reexport safe */ _checks_js__rspack_import_2.lowercase),
  lt: () => (/* reexport safe */ _checks_js__rspack_import_2.lt),
  lte: () => (/* reexport safe */ _checks_js__rspack_import_2.lte),
  mac: () => (/* reexport safe */ _schemas_js__rspack_import_1.mac),
  map: () => (/* reexport safe */ _schemas_js__rspack_import_1.map),
  maxLength: () => (/* reexport safe */ _checks_js__rspack_import_2.maxLength),
  maxSize: () => (/* reexport safe */ _checks_js__rspack_import_2.maxSize),
  meta: () => (/* reexport safe */ _schemas_js__rspack_import_1.meta),
  mime: () => (/* reexport safe */ _checks_js__rspack_import_2.mime),
  minLength: () => (/* reexport safe */ _checks_js__rspack_import_2.minLength),
  minSize: () => (/* reexport safe */ _checks_js__rspack_import_2.minSize),
  multipleOf: () => (/* reexport safe */ _checks_js__rspack_import_2.multipleOf),
  nan: () => (/* reexport safe */ _schemas_js__rspack_import_1.nan),
  nanoid: () => (/* reexport safe */ _schemas_js__rspack_import_1.nanoid),
  nativeEnum: () => (/* reexport safe */ _schemas_js__rspack_import_1.nativeEnum),
  negative: () => (/* reexport safe */ _checks_js__rspack_import_2.negative),
  never: () => (/* reexport safe */ _schemas_js__rspack_import_1.never),
  nonnegative: () => (/* reexport safe */ _checks_js__rspack_import_2.nonnegative),
  nonoptional: () => (/* reexport safe */ _schemas_js__rspack_import_1.nonoptional),
  nonpositive: () => (/* reexport safe */ _checks_js__rspack_import_2.nonpositive),
  normalize: () => (/* reexport safe */ _checks_js__rspack_import_2.normalize),
  "null": () => (/* reexport safe */ _schemas_js__rspack_import_1["null"]),
  nullable: () => (/* reexport safe */ _schemas_js__rspack_import_1.nullable),
  nullish: () => (/* reexport safe */ _schemas_js__rspack_import_1.nullish),
  number: () => (/* reexport safe */ _schemas_js__rspack_import_1.number),
  object: () => (/* reexport safe */ _schemas_js__rspack_import_1.object),
  optional: () => (/* reexport safe */ _schemas_js__rspack_import_1.optional),
  overwrite: () => (/* reexport safe */ _checks_js__rspack_import_2.overwrite),
  parse: () => (/* reexport safe */ _parse_js__rspack_import_4.parse),
  parseAsync: () => (/* reexport safe */ _parse_js__rspack_import_4.parseAsync),
  partialRecord: () => (/* reexport safe */ _schemas_js__rspack_import_1.partialRecord),
  pipe: () => (/* reexport safe */ _schemas_js__rspack_import_1.pipe),
  positive: () => (/* reexport safe */ _checks_js__rspack_import_2.positive),
  prefault: () => (/* reexport safe */ _schemas_js__rspack_import_1.prefault),
  preprocess: () => (/* reexport safe */ _schemas_js__rspack_import_1.preprocess),
  prettifyError: () => (/* reexport safe */ _core_index_js__rspack_import_0.prettifyError),
  promise: () => (/* reexport safe */ _schemas_js__rspack_import_1.promise),
  property: () => (/* reexport safe */ _checks_js__rspack_import_2.property),
  readonly: () => (/* reexport safe */ _schemas_js__rspack_import_1.readonly),
  record: () => (/* reexport safe */ _schemas_js__rspack_import_1.record),
  refine: () => (/* reexport safe */ _schemas_js__rspack_import_1.refine),
  regex: () => (/* reexport safe */ _checks_js__rspack_import_2.regex),
  regexes: () => (/* reexport safe */ _core_index_js__rspack_import_0.regexes),
  registry: () => (/* reexport safe */ _core_index_js__rspack_import_0.registry),
  safeDecode: () => (/* reexport safe */ _parse_js__rspack_import_4.safeDecode),
  safeDecodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_4.safeDecodeAsync),
  safeEncode: () => (/* reexport safe */ _parse_js__rspack_import_4.safeEncode),
  safeEncodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_4.safeEncodeAsync),
  safeParse: () => (/* reexport safe */ _parse_js__rspack_import_4.safeParse),
  safeParseAsync: () => (/* reexport safe */ _parse_js__rspack_import_4.safeParseAsync),
  set: () => (/* reexport safe */ _schemas_js__rspack_import_1.set),
  setErrorMap: () => (/* reexport safe */ _compat_js__rspack_import_5.setErrorMap),
  size: () => (/* reexport safe */ _checks_js__rspack_import_2.size),
  slugify: () => (/* reexport safe */ _checks_js__rspack_import_2.slugify),
  startsWith: () => (/* reexport safe */ _checks_js__rspack_import_2.startsWith),
  strictObject: () => (/* reexport safe */ _schemas_js__rspack_import_1.strictObject),
  string: () => (/* reexport safe */ _schemas_js__rspack_import_1.string),
  stringFormat: () => (/* reexport safe */ _schemas_js__rspack_import_1.stringFormat),
  stringbool: () => (/* reexport safe */ _schemas_js__rspack_import_1.stringbool),
  success: () => (/* reexport safe */ _schemas_js__rspack_import_1.success),
  superRefine: () => (/* reexport safe */ _schemas_js__rspack_import_1.superRefine),
  symbol: () => (/* reexport safe */ _schemas_js__rspack_import_1.symbol),
  templateLiteral: () => (/* reexport safe */ _schemas_js__rspack_import_1.templateLiteral),
  toJSONSchema: () => (/* reexport safe */ _core_json_schema_processors_js__rspack_import_7.toJSONSchema),
  toLowerCase: () => (/* reexport safe */ _checks_js__rspack_import_2.toLowerCase),
  toUpperCase: () => (/* reexport safe */ _checks_js__rspack_import_2.toUpperCase),
  transform: () => (/* reexport safe */ _schemas_js__rspack_import_1.transform),
  treeifyError: () => (/* reexport safe */ _core_index_js__rspack_import_0.treeifyError),
  trim: () => (/* reexport safe */ _checks_js__rspack_import_2.trim),
  tuple: () => (/* reexport safe */ _schemas_js__rspack_import_1.tuple),
  uint32: () => (/* reexport safe */ _schemas_js__rspack_import_1.uint32),
  uint64: () => (/* reexport safe */ _schemas_js__rspack_import_1.uint64),
  ulid: () => (/* reexport safe */ _schemas_js__rspack_import_1.ulid),
  undefined: () => (/* reexport safe */ _schemas_js__rspack_import_1.undefined),
  union: () => (/* reexport safe */ _schemas_js__rspack_import_1.union),
  unknown: () => (/* reexport safe */ _schemas_js__rspack_import_1.unknown),
  uppercase: () => (/* reexport safe */ _checks_js__rspack_import_2.uppercase),
  url: () => (/* reexport safe */ _schemas_js__rspack_import_1.url),
  util: () => (/* reexport safe */ _core_index_js__rspack_import_0.util),
  uuid: () => (/* reexport safe */ _schemas_js__rspack_import_1.uuid),
  uuidv4: () => (/* reexport safe */ _schemas_js__rspack_import_1.uuidv4),
  uuidv6: () => (/* reexport safe */ _schemas_js__rspack_import_1.uuidv6),
  uuidv7: () => (/* reexport safe */ _schemas_js__rspack_import_1.uuidv7),
  "void": () => (/* reexport safe */ _schemas_js__rspack_import_1["void"]),
  xid: () => (/* reexport safe */ _schemas_js__rspack_import_1.xid),
  xor: () => (/* reexport safe */ _schemas_js__rspack_import_1.xor)
});
/* import */ var _core_index_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/index.js");
/* import */ var _schemas_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/schemas.js");
/* import */ var _checks_js__rspack_import_2 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/checks.js");
/* import */ var _errors_js__rspack_import_3 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/errors.js");
/* import */ var _parse_js__rspack_import_4 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/parse.js");
/* import */ var _compat_js__rspack_import_5 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/compat.js");
/* import */ var _locales_en_js__rspack_import_6 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/en.js");
/* import */ var _core_json_schema_processors_js__rspack_import_7 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/json-schema-processors.js");
/* import */ var _from_json_schema_js__rspack_import_8 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/from-json-schema.js");
/* import */ var _locales_index_js__rspack_import_9 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/index.js");
/* import */ var _iso_js__rspack_import_10 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/iso.js");
/* import */ var _coerce_js__rspack_import_11 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/coerce.js");






// zod-specified


(0,_core_index_js__rspack_import_0.config)((0,_locales_en_js__rspack_import_6["default"])());




// iso
// must be exported from top-level
// https://github.com/colinhacks/zod/issues/4491





},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/from-json-schema.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  fromJSONSchema: () => (fromJSONSchema)
});
/* import */ var _core_registries_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/registries.js");
/* import */ var _checks_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/checks.js");
/* import */ var _iso_js__rspack_import_2 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/iso.js");
/* import */ var _schemas_js__rspack_import_3 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/schemas.js");




// Local z object to avoid circular dependency with ../index.js
const z = {
    ..._schemas_js__rspack_import_3,
    ..._checks_js__rspack_import_1,
    iso: _iso_js__rspack_import_2,
};
// Keys that are recognized and handled by the conversion logic
const RECOGNIZED_KEYS = new Set([
    // Schema identification
    "$schema",
    "$ref",
    "$defs",
    "definitions",
    // Core schema keywords
    "$id",
    "id",
    "$comment",
    "$anchor",
    "$vocabulary",
    "$dynamicRef",
    "$dynamicAnchor",
    // Type
    "type",
    "enum",
    "const",
    // Composition
    "anyOf",
    "oneOf",
    "allOf",
    "not",
    // Object
    "properties",
    "required",
    "additionalProperties",
    "patternProperties",
    "propertyNames",
    "minProperties",
    "maxProperties",
    // Array
    "items",
    "prefixItems",
    "additionalItems",
    "minItems",
    "maxItems",
    "uniqueItems",
    "contains",
    "minContains",
    "maxContains",
    // String
    "minLength",
    "maxLength",
    "pattern",
    "format",
    // Number
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    // Already handled metadata
    "description",
    "default",
    // Content
    "contentEncoding",
    "contentMediaType",
    "contentSchema",
    // Unsupported (error-throwing)
    "unevaluatedItems",
    "unevaluatedProperties",
    "if",
    "then",
    "else",
    "dependentSchemas",
    "dependentRequired",
    // OpenAPI
    "nullable",
    "readOnly",
]);
function detectVersion(schema, defaultTarget) {
    const $schema = schema.$schema;
    if ($schema === "https://json-schema.org/draft/2020-12/schema") {
        return "draft-2020-12";
    }
    if ($schema === "http://json-schema.org/draft-07/schema#") {
        return "draft-7";
    }
    if ($schema === "http://json-schema.org/draft-04/schema#") {
        return "draft-4";
    }
    // Use defaultTarget if provided, otherwise default to draft-2020-12
    return defaultTarget ?? "draft-2020-12";
}
function resolveRef(ref, ctx) {
    if (!ref.startsWith("#")) {
        throw new Error("External $ref is not supported, only local refs (#/...) are allowed");
    }
    const path = ref.slice(1).split("/").filter(Boolean);
    // Handle root reference "#"
    if (path.length === 0) {
        return ctx.rootSchema;
    }
    const defsKey = ctx.version === "draft-2020-12" ? "$defs" : "definitions";
    if (path[0] === defsKey) {
        const key = path[1];
        if (!key || !ctx.defs[key]) {
            throw new Error(`Reference not found: ${ref}`);
        }
        return ctx.defs[key];
    }
    throw new Error(`Reference not found: ${ref}`);
}
function convertBaseSchema(schema, ctx) {
    // Handle unsupported features
    if (schema.not !== undefined) {
        // Special case: { not: {} } represents never
        if (typeof schema.not === "object" && Object.keys(schema.not).length === 0) {
            return z.never();
        }
        throw new Error("not is not supported in Zod (except { not: {} } for never)");
    }
    if (schema.unevaluatedItems !== undefined) {
        throw new Error("unevaluatedItems is not supported");
    }
    if (schema.unevaluatedProperties !== undefined) {
        throw new Error("unevaluatedProperties is not supported");
    }
    if (schema.if !== undefined || schema.then !== undefined || schema.else !== undefined) {
        throw new Error("Conditional schemas (if/then/else) are not supported");
    }
    if (schema.dependentSchemas !== undefined || schema.dependentRequired !== undefined) {
        throw new Error("dependentSchemas and dependentRequired are not supported");
    }
    // Handle $ref
    if (schema.$ref) {
        const refPath = schema.$ref;
        if (ctx.refs.has(refPath)) {
            return ctx.refs.get(refPath);
        }
        if (ctx.processing.has(refPath)) {
            // Circular reference - use lazy
            return z.lazy(() => {
                if (!ctx.refs.has(refPath)) {
                    throw new Error(`Circular reference not resolved: ${refPath}`);
                }
                return ctx.refs.get(refPath);
            });
        }
        ctx.processing.add(refPath);
        const resolved = resolveRef(refPath, ctx);
        const zodSchema = convertSchema(resolved, ctx);
        ctx.refs.set(refPath, zodSchema);
        ctx.processing.delete(refPath);
        return zodSchema;
    }
    // Handle enum
    if (schema.enum !== undefined) {
        const enumValues = schema.enum;
        // Special case: OpenAPI 3.0 null representation { type: "string", nullable: true, enum: [null] }
        if (ctx.version === "openapi-3.0" &&
            schema.nullable === true &&
            enumValues.length === 1 &&
            enumValues[0] === null) {
            return z.null();
        }
        if (enumValues.length === 0) {
            return z.never();
        }
        if (enumValues.length === 1) {
            return z.literal(enumValues[0]);
        }
        // Check if all values are strings
        if (enumValues.every((v) => typeof v === "string")) {
            return z.enum(enumValues);
        }
        // Mixed types - use union of literals
        const literalSchemas = enumValues.map((v) => z.literal(v));
        if (literalSchemas.length < 2) {
            return literalSchemas[0];
        }
        return z.union([literalSchemas[0], literalSchemas[1], ...literalSchemas.slice(2)]);
    }
    // Handle const
    if (schema.const !== undefined) {
        return z.literal(schema.const);
    }
    // Handle type
    const type = schema.type;
    if (Array.isArray(type)) {
        // Expand type array into anyOf union
        const typeSchemas = type.map((t) => {
            const typeSchema = { ...schema, type: t };
            return convertBaseSchema(typeSchema, ctx);
        });
        if (typeSchemas.length === 0) {
            return z.never();
        }
        if (typeSchemas.length === 1) {
            return typeSchemas[0];
        }
        return z.union(typeSchemas);
    }
    if (!type) {
        // No type specified - empty schema (any)
        return z.any();
    }
    let zodSchema;
    switch (type) {
        case "string": {
            let stringSchema = z.string();
            // Apply format using .check() with Zod format functions
            if (schema.format) {
                const format = schema.format;
                // Map common formats to Zod check functions
                if (format === "email") {
                    stringSchema = stringSchema.check(z.email());
                }
                else if (format === "uri" || format === "uri-reference") {
                    stringSchema = stringSchema.check(z.url());
                }
                else if (format === "uuid" || format === "guid") {
                    stringSchema = stringSchema.check(z.uuid());
                }
                else if (format === "date-time") {
                    stringSchema = stringSchema.check(z.iso.datetime());
                }
                else if (format === "date") {
                    stringSchema = stringSchema.check(z.iso.date());
                }
                else if (format === "time") {
                    stringSchema = stringSchema.check(z.iso.time());
                }
                else if (format === "duration") {
                    stringSchema = stringSchema.check(z.iso.duration());
                }
                else if (format === "ipv4") {
                    stringSchema = stringSchema.check(z.ipv4());
                }
                else if (format === "ipv6") {
                    stringSchema = stringSchema.check(z.ipv6());
                }
                else if (format === "mac") {
                    stringSchema = stringSchema.check(z.mac());
                }
                else if (format === "cidr") {
                    stringSchema = stringSchema.check(z.cidrv4());
                }
                else if (format === "cidr-v6") {
                    stringSchema = stringSchema.check(z.cidrv6());
                }
                else if (format === "base64") {
                    stringSchema = stringSchema.check(z.base64());
                }
                else if (format === "base64url") {
                    stringSchema = stringSchema.check(z.base64url());
                }
                else if (format === "e164") {
                    stringSchema = stringSchema.check(z.e164());
                }
                else if (format === "jwt") {
                    stringSchema = stringSchema.check(z.jwt());
                }
                else if (format === "emoji") {
                    stringSchema = stringSchema.check(z.emoji());
                }
                else if (format === "nanoid") {
                    stringSchema = stringSchema.check(z.nanoid());
                }
                else if (format === "cuid") {
                    stringSchema = stringSchema.check(z.cuid());
                }
                else if (format === "cuid2") {
                    stringSchema = stringSchema.check(z.cuid2());
                }
                else if (format === "ulid") {
                    stringSchema = stringSchema.check(z.ulid());
                }
                else if (format === "xid") {
                    stringSchema = stringSchema.check(z.xid());
                }
                else if (format === "ksuid") {
                    stringSchema = stringSchema.check(z.ksuid());
                }
                // Note: json-string format is not currently supported by Zod
                // Custom formats are ignored - keep as plain string
            }
            // Apply constraints
            if (typeof schema.minLength === "number") {
                stringSchema = stringSchema.min(schema.minLength);
            }
            if (typeof schema.maxLength === "number") {
                stringSchema = stringSchema.max(schema.maxLength);
            }
            if (schema.pattern) {
                // JSON Schema patterns are not implicitly anchored (match anywhere in string)
                stringSchema = stringSchema.regex(new RegExp(schema.pattern));
            }
            zodSchema = stringSchema;
            break;
        }
        case "number":
        case "integer": {
            let numberSchema = type === "integer" ? z.number().int() : z.number();
            // Apply constraints
            if (typeof schema.minimum === "number") {
                numberSchema = numberSchema.min(schema.minimum);
            }
            if (typeof schema.maximum === "number") {
                numberSchema = numberSchema.max(schema.maximum);
            }
            if (typeof schema.exclusiveMinimum === "number") {
                numberSchema = numberSchema.gt(schema.exclusiveMinimum);
            }
            else if (schema.exclusiveMinimum === true && typeof schema.minimum === "number") {
                numberSchema = numberSchema.gt(schema.minimum);
            }
            if (typeof schema.exclusiveMaximum === "number") {
                numberSchema = numberSchema.lt(schema.exclusiveMaximum);
            }
            else if (schema.exclusiveMaximum === true && typeof schema.maximum === "number") {
                numberSchema = numberSchema.lt(schema.maximum);
            }
            if (typeof schema.multipleOf === "number") {
                numberSchema = numberSchema.multipleOf(schema.multipleOf);
            }
            zodSchema = numberSchema;
            break;
        }
        case "boolean": {
            zodSchema = z.boolean();
            break;
        }
        case "null": {
            zodSchema = z.null();
            break;
        }
        case "object": {
            const shape = {};
            const properties = schema.properties || {};
            const requiredSet = new Set(schema.required || []);
            // Convert properties - mark optional ones
            for (const [key, propSchema] of Object.entries(properties)) {
                const propZodSchema = convertSchema(propSchema, ctx);
                // If not in required array, make it optional
                shape[key] = requiredSet.has(key) ? propZodSchema : propZodSchema.optional();
            }
            // Handle propertyNames
            if (schema.propertyNames) {
                const keySchema = convertSchema(schema.propertyNames, ctx);
                const valueSchema = schema.additionalProperties && typeof schema.additionalProperties === "object"
                    ? convertSchema(schema.additionalProperties, ctx)
                    : z.any();
                // Case A: No properties (pure record)
                if (Object.keys(shape).length === 0) {
                    zodSchema = z.record(keySchema, valueSchema);
                    break;
                }
                // Case B: With properties (intersection of object and looseRecord)
                const objectSchema = z.object(shape).passthrough();
                const recordSchema = z.looseRecord(keySchema, valueSchema);
                zodSchema = z.intersection(objectSchema, recordSchema);
                break;
            }
            // Handle patternProperties
            if (schema.patternProperties) {
                // patternProperties: keys matching pattern must satisfy corresponding schema
                // Use loose records so non-matching keys pass through
                const patternProps = schema.patternProperties;
                const patternKeys = Object.keys(patternProps);
                const looseRecords = [];
                for (const pattern of patternKeys) {
                    const patternValue = convertSchema(patternProps[pattern], ctx);
                    const keySchema = z.string().regex(new RegExp(pattern));
                    looseRecords.push(z.looseRecord(keySchema, patternValue));
                }
                // Build intersection: object schema + all pattern property records
                const schemasToIntersect = [];
                if (Object.keys(shape).length > 0) {
                    // Use passthrough so patternProperties can validate additional keys
                    schemasToIntersect.push(z.object(shape).passthrough());
                }
                schemasToIntersect.push(...looseRecords);
                if (schemasToIntersect.length === 0) {
                    zodSchema = z.object({}).passthrough();
                }
                else if (schemasToIntersect.length === 1) {
                    zodSchema = schemasToIntersect[0];
                }
                else {
                    // Chain intersections: (A & B) & C & D ...
                    let result = z.intersection(schemasToIntersect[0], schemasToIntersect[1]);
                    for (let i = 2; i < schemasToIntersect.length; i++) {
                        result = z.intersection(result, schemasToIntersect[i]);
                    }
                    zodSchema = result;
                }
                break;
            }
            // Handle additionalProperties
            // In JSON Schema, additionalProperties defaults to true (allow any extra properties)
            // In Zod, objects strip unknown keys by default, so we need to handle this explicitly
            const objectSchema = z.object(shape);
            if (schema.additionalProperties === false) {
                // Strict mode - no extra properties allowed
                zodSchema = objectSchema.strict();
            }
            else if (typeof schema.additionalProperties === "object") {
                // Extra properties must match the specified schema
                zodSchema = objectSchema.catchall(convertSchema(schema.additionalProperties, ctx));
            }
            else {
                // additionalProperties is true or undefined - allow any extra properties (passthrough)
                zodSchema = objectSchema.passthrough();
            }
            break;
        }
        case "array": {
            // TODO: uniqueItems is not supported
            // TODO: contains/minContains/maxContains are not supported
            // Check if this is a tuple (prefixItems or items as array)
            const prefixItems = schema.prefixItems;
            const items = schema.items;
            if (prefixItems && Array.isArray(prefixItems)) {
                // Tuple with prefixItems (draft-2020-12)
                const tupleItems = prefixItems.map((item) => convertSchema(item, ctx));
                const rest = items && typeof items === "object" && !Array.isArray(items)
                    ? convertSchema(items, ctx)
                    : undefined;
                if (rest) {
                    zodSchema = z.tuple(tupleItems).rest(rest);
                }
                else {
                    zodSchema = z.tuple(tupleItems);
                }
                // Apply minItems/maxItems constraints to tuples
                if (typeof schema.minItems === "number") {
                    zodSchema = zodSchema.check(z.minLength(schema.minItems));
                }
                if (typeof schema.maxItems === "number") {
                    zodSchema = zodSchema.check(z.maxLength(schema.maxItems));
                }
            }
            else if (Array.isArray(items)) {
                // Tuple with items array (draft-7)
                const tupleItems = items.map((item) => convertSchema(item, ctx));
                const rest = schema.additionalItems && typeof schema.additionalItems === "object"
                    ? convertSchema(schema.additionalItems, ctx)
                    : undefined; // additionalItems: false means no rest, handled by default tuple behavior
                if (rest) {
                    zodSchema = z.tuple(tupleItems).rest(rest);
                }
                else {
                    zodSchema = z.tuple(tupleItems);
                }
                // Apply minItems/maxItems constraints to tuples
                if (typeof schema.minItems === "number") {
                    zodSchema = zodSchema.check(z.minLength(schema.minItems));
                }
                if (typeof schema.maxItems === "number") {
                    zodSchema = zodSchema.check(z.maxLength(schema.maxItems));
                }
            }
            else if (items !== undefined) {
                // Regular array
                const element = convertSchema(items, ctx);
                let arraySchema = z.array(element);
                // Apply constraints
                if (typeof schema.minItems === "number") {
                    arraySchema = arraySchema.min(schema.minItems);
                }
                if (typeof schema.maxItems === "number") {
                    arraySchema = arraySchema.max(schema.maxItems);
                }
                zodSchema = arraySchema;
            }
            else {
                // No items specified - array of any
                zodSchema = z.array(z.any());
            }
            break;
        }
        default:
            throw new Error(`Unsupported type: ${type}`);
    }
    // Apply metadata
    if (schema.description) {
        zodSchema = zodSchema.describe(schema.description);
    }
    if (schema.default !== undefined) {
        zodSchema = zodSchema.default(schema.default);
    }
    return zodSchema;
}
function convertSchema(schema, ctx) {
    if (typeof schema === "boolean") {
        return schema ? z.any() : z.never();
    }
    // Convert base schema first (ignoring composition keywords)
    let baseSchema = convertBaseSchema(schema, ctx);
    const hasExplicitType = schema.type || schema.enum !== undefined || schema.const !== undefined;
    // Process composition keywords LAST (they can appear together)
    // Handle anyOf - wrap base schema with union
    if (schema.anyOf && Array.isArray(schema.anyOf)) {
        const options = schema.anyOf.map((s) => convertSchema(s, ctx));
        const anyOfUnion = z.union(options);
        baseSchema = hasExplicitType ? z.intersection(baseSchema, anyOfUnion) : anyOfUnion;
    }
    // Handle oneOf - exclusive union (exactly one must match)
    if (schema.oneOf && Array.isArray(schema.oneOf)) {
        const options = schema.oneOf.map((s) => convertSchema(s, ctx));
        const oneOfUnion = z.xor(options);
        baseSchema = hasExplicitType ? z.intersection(baseSchema, oneOfUnion) : oneOfUnion;
    }
    // Handle allOf - wrap base schema with intersection
    if (schema.allOf && Array.isArray(schema.allOf)) {
        if (schema.allOf.length === 0) {
            baseSchema = hasExplicitType ? baseSchema : z.any();
        }
        else {
            let result = hasExplicitType ? baseSchema : convertSchema(schema.allOf[0], ctx);
            const startIdx = hasExplicitType ? 0 : 1;
            for (let i = startIdx; i < schema.allOf.length; i++) {
                result = z.intersection(result, convertSchema(schema.allOf[i], ctx));
            }
            baseSchema = result;
        }
    }
    // Handle nullable (OpenAPI 3.0)
    if (schema.nullable === true && ctx.version === "openapi-3.0") {
        baseSchema = z.nullable(baseSchema);
    }
    // Handle readOnly
    if (schema.readOnly === true) {
        baseSchema = z.readonly(baseSchema);
    }
    // Collect metadata: core schema keywords and unrecognized keys
    const extraMeta = {};
    // Core schema keywords that should be captured as metadata
    const coreMetadataKeys = ["$id", "id", "$comment", "$anchor", "$vocabulary", "$dynamicRef", "$dynamicAnchor"];
    for (const key of coreMetadataKeys) {
        if (key in schema) {
            extraMeta[key] = schema[key];
        }
    }
    // Content keywords - store as metadata
    const contentMetadataKeys = ["contentEncoding", "contentMediaType", "contentSchema"];
    for (const key of contentMetadataKeys) {
        if (key in schema) {
            extraMeta[key] = schema[key];
        }
    }
    // Unrecognized keys (custom metadata)
    for (const key of Object.keys(schema)) {
        if (!RECOGNIZED_KEYS.has(key)) {
            extraMeta[key] = schema[key];
        }
    }
    if (Object.keys(extraMeta).length > 0) {
        ctx.registry.add(baseSchema, extraMeta);
    }
    return baseSchema;
}
/**
 * Converts a JSON Schema to a Zod schema. This function should be considered semi-experimental. It's behavior is liable to change. */
function fromJSONSchema(schema, params) {
    // Handle boolean schemas
    if (typeof schema === "boolean") {
        return schema ? z.any() : z.never();
    }
    const version = detectVersion(schema, params?.defaultTarget);
    const defs = (schema.$defs || schema.definitions || {});
    const ctx = {
        version,
        defs,
        refs: new Map(),
        processing: new Set(),
        rootSchema: schema,
        registry: params?.registry ?? _core_registries_js__rspack_import_0.globalRegistry,
    };
    return convertSchema(schema, ctx);
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/index.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  $brand: () => (/* reexport safe */ _external_js__rspack_import_0.$brand),
  $input: () => (/* reexport safe */ _external_js__rspack_import_0.$input),
  $output: () => (/* reexport safe */ _external_js__rspack_import_0.$output),
  NEVER: () => (/* reexport safe */ _external_js__rspack_import_0.NEVER),
  TimePrecision: () => (/* reexport safe */ _external_js__rspack_import_0.TimePrecision),
  ZodAny: () => (/* reexport safe */ _external_js__rspack_import_0.ZodAny),
  ZodArray: () => (/* reexport safe */ _external_js__rspack_import_0.ZodArray),
  ZodBase64: () => (/* reexport safe */ _external_js__rspack_import_0.ZodBase64),
  ZodBase64URL: () => (/* reexport safe */ _external_js__rspack_import_0.ZodBase64URL),
  ZodBigInt: () => (/* reexport safe */ _external_js__rspack_import_0.ZodBigInt),
  ZodBigIntFormat: () => (/* reexport safe */ _external_js__rspack_import_0.ZodBigIntFormat),
  ZodBoolean: () => (/* reexport safe */ _external_js__rspack_import_0.ZodBoolean),
  ZodCIDRv4: () => (/* reexport safe */ _external_js__rspack_import_0.ZodCIDRv4),
  ZodCIDRv6: () => (/* reexport safe */ _external_js__rspack_import_0.ZodCIDRv6),
  ZodCUID: () => (/* reexport safe */ _external_js__rspack_import_0.ZodCUID),
  ZodCUID2: () => (/* reexport safe */ _external_js__rspack_import_0.ZodCUID2),
  ZodCatch: () => (/* reexport safe */ _external_js__rspack_import_0.ZodCatch),
  ZodCodec: () => (/* reexport safe */ _external_js__rspack_import_0.ZodCodec),
  ZodCustom: () => (/* reexport safe */ _external_js__rspack_import_0.ZodCustom),
  ZodCustomStringFormat: () => (/* reexport safe */ _external_js__rspack_import_0.ZodCustomStringFormat),
  ZodDate: () => (/* reexport safe */ _external_js__rspack_import_0.ZodDate),
  ZodDefault: () => (/* reexport safe */ _external_js__rspack_import_0.ZodDefault),
  ZodDiscriminatedUnion: () => (/* reexport safe */ _external_js__rspack_import_0.ZodDiscriminatedUnion),
  ZodE164: () => (/* reexport safe */ _external_js__rspack_import_0.ZodE164),
  ZodEmail: () => (/* reexport safe */ _external_js__rspack_import_0.ZodEmail),
  ZodEmoji: () => (/* reexport safe */ _external_js__rspack_import_0.ZodEmoji),
  ZodEnum: () => (/* reexport safe */ _external_js__rspack_import_0.ZodEnum),
  ZodError: () => (/* reexport safe */ _external_js__rspack_import_0.ZodError),
  ZodExactOptional: () => (/* reexport safe */ _external_js__rspack_import_0.ZodExactOptional),
  ZodFile: () => (/* reexport safe */ _external_js__rspack_import_0.ZodFile),
  ZodFirstPartyTypeKind: () => (/* reexport safe */ _external_js__rspack_import_0.ZodFirstPartyTypeKind),
  ZodFunction: () => (/* reexport safe */ _external_js__rspack_import_0.ZodFunction),
  ZodGUID: () => (/* reexport safe */ _external_js__rspack_import_0.ZodGUID),
  ZodIPv4: () => (/* reexport safe */ _external_js__rspack_import_0.ZodIPv4),
  ZodIPv6: () => (/* reexport safe */ _external_js__rspack_import_0.ZodIPv6),
  ZodISODate: () => (/* reexport safe */ _external_js__rspack_import_0.ZodISODate),
  ZodISODateTime: () => (/* reexport safe */ _external_js__rspack_import_0.ZodISODateTime),
  ZodISODuration: () => (/* reexport safe */ _external_js__rspack_import_0.ZodISODuration),
  ZodISOTime: () => (/* reexport safe */ _external_js__rspack_import_0.ZodISOTime),
  ZodIntersection: () => (/* reexport safe */ _external_js__rspack_import_0.ZodIntersection),
  ZodIssueCode: () => (/* reexport safe */ _external_js__rspack_import_0.ZodIssueCode),
  ZodJWT: () => (/* reexport safe */ _external_js__rspack_import_0.ZodJWT),
  ZodKSUID: () => (/* reexport safe */ _external_js__rspack_import_0.ZodKSUID),
  ZodLazy: () => (/* reexport safe */ _external_js__rspack_import_0.ZodLazy),
  ZodLiteral: () => (/* reexport safe */ _external_js__rspack_import_0.ZodLiteral),
  ZodMAC: () => (/* reexport safe */ _external_js__rspack_import_0.ZodMAC),
  ZodMap: () => (/* reexport safe */ _external_js__rspack_import_0.ZodMap),
  ZodNaN: () => (/* reexport safe */ _external_js__rspack_import_0.ZodNaN),
  ZodNanoID: () => (/* reexport safe */ _external_js__rspack_import_0.ZodNanoID),
  ZodNever: () => (/* reexport safe */ _external_js__rspack_import_0.ZodNever),
  ZodNonOptional: () => (/* reexport safe */ _external_js__rspack_import_0.ZodNonOptional),
  ZodNull: () => (/* reexport safe */ _external_js__rspack_import_0.ZodNull),
  ZodNullable: () => (/* reexport safe */ _external_js__rspack_import_0.ZodNullable),
  ZodNumber: () => (/* reexport safe */ _external_js__rspack_import_0.ZodNumber),
  ZodNumberFormat: () => (/* reexport safe */ _external_js__rspack_import_0.ZodNumberFormat),
  ZodObject: () => (/* reexport safe */ _external_js__rspack_import_0.ZodObject),
  ZodOptional: () => (/* reexport safe */ _external_js__rspack_import_0.ZodOptional),
  ZodPipe: () => (/* reexport safe */ _external_js__rspack_import_0.ZodPipe),
  ZodPrefault: () => (/* reexport safe */ _external_js__rspack_import_0.ZodPrefault),
  ZodPromise: () => (/* reexport safe */ _external_js__rspack_import_0.ZodPromise),
  ZodReadonly: () => (/* reexport safe */ _external_js__rspack_import_0.ZodReadonly),
  ZodRealError: () => (/* reexport safe */ _external_js__rspack_import_0.ZodRealError),
  ZodRecord: () => (/* reexport safe */ _external_js__rspack_import_0.ZodRecord),
  ZodSet: () => (/* reexport safe */ _external_js__rspack_import_0.ZodSet),
  ZodString: () => (/* reexport safe */ _external_js__rspack_import_0.ZodString),
  ZodStringFormat: () => (/* reexport safe */ _external_js__rspack_import_0.ZodStringFormat),
  ZodSuccess: () => (/* reexport safe */ _external_js__rspack_import_0.ZodSuccess),
  ZodSymbol: () => (/* reexport safe */ _external_js__rspack_import_0.ZodSymbol),
  ZodTemplateLiteral: () => (/* reexport safe */ _external_js__rspack_import_0.ZodTemplateLiteral),
  ZodTransform: () => (/* reexport safe */ _external_js__rspack_import_0.ZodTransform),
  ZodTuple: () => (/* reexport safe */ _external_js__rspack_import_0.ZodTuple),
  ZodType: () => (/* reexport safe */ _external_js__rspack_import_0.ZodType),
  ZodULID: () => (/* reexport safe */ _external_js__rspack_import_0.ZodULID),
  ZodURL: () => (/* reexport safe */ _external_js__rspack_import_0.ZodURL),
  ZodUUID: () => (/* reexport safe */ _external_js__rspack_import_0.ZodUUID),
  ZodUndefined: () => (/* reexport safe */ _external_js__rspack_import_0.ZodUndefined),
  ZodUnion: () => (/* reexport safe */ _external_js__rspack_import_0.ZodUnion),
  ZodUnknown: () => (/* reexport safe */ _external_js__rspack_import_0.ZodUnknown),
  ZodVoid: () => (/* reexport safe */ _external_js__rspack_import_0.ZodVoid),
  ZodXID: () => (/* reexport safe */ _external_js__rspack_import_0.ZodXID),
  ZodXor: () => (/* reexport safe */ _external_js__rspack_import_0.ZodXor),
  _ZodString: () => (/* reexport safe */ _external_js__rspack_import_0._ZodString),
  _default: () => (/* reexport safe */ _external_js__rspack_import_0._default),
  _function: () => (/* reexport safe */ _external_js__rspack_import_0._function),
  any: () => (/* reexport safe */ _external_js__rspack_import_0.any),
  array: () => (/* reexport safe */ _external_js__rspack_import_0.array),
  base64: () => (/* reexport safe */ _external_js__rspack_import_0.base64),
  base64url: () => (/* reexport safe */ _external_js__rspack_import_0.base64url),
  bigint: () => (/* reexport safe */ _external_js__rspack_import_0.bigint),
  boolean: () => (/* reexport safe */ _external_js__rspack_import_0.boolean),
  "catch": () => (/* reexport safe */ _external_js__rspack_import_0["catch"]),
  check: () => (/* reexport safe */ _external_js__rspack_import_0.check),
  cidrv4: () => (/* reexport safe */ _external_js__rspack_import_0.cidrv4),
  cidrv6: () => (/* reexport safe */ _external_js__rspack_import_0.cidrv6),
  clone: () => (/* reexport safe */ _external_js__rspack_import_0.clone),
  codec: () => (/* reexport safe */ _external_js__rspack_import_0.codec),
  coerce: () => (/* reexport safe */ _external_js__rspack_import_0.coerce),
  config: () => (/* reexport safe */ _external_js__rspack_import_0.config),
  core: () => (/* reexport safe */ _external_js__rspack_import_0.core),
  cuid: () => (/* reexport safe */ _external_js__rspack_import_0.cuid),
  cuid2: () => (/* reexport safe */ _external_js__rspack_import_0.cuid2),
  custom: () => (/* reexport safe */ _external_js__rspack_import_0.custom),
  date: () => (/* reexport safe */ _external_js__rspack_import_0.date),
  decode: () => (/* reexport safe */ _external_js__rspack_import_0.decode),
  decodeAsync: () => (/* reexport safe */ _external_js__rspack_import_0.decodeAsync),
  "default": () => (__rspack_default_export),
  describe: () => (/* reexport safe */ _external_js__rspack_import_0.describe),
  discriminatedUnion: () => (/* reexport safe */ _external_js__rspack_import_0.discriminatedUnion),
  e164: () => (/* reexport safe */ _external_js__rspack_import_0.e164),
  email: () => (/* reexport safe */ _external_js__rspack_import_0.email),
  emoji: () => (/* reexport safe */ _external_js__rspack_import_0.emoji),
  encode: () => (/* reexport safe */ _external_js__rspack_import_0.encode),
  encodeAsync: () => (/* reexport safe */ _external_js__rspack_import_0.encodeAsync),
  endsWith: () => (/* reexport safe */ _external_js__rspack_import_0.endsWith),
  "enum": () => (/* reexport safe */ _external_js__rspack_import_0["enum"]),
  exactOptional: () => (/* reexport safe */ _external_js__rspack_import_0.exactOptional),
  file: () => (/* reexport safe */ _external_js__rspack_import_0.file),
  flattenError: () => (/* reexport safe */ _external_js__rspack_import_0.flattenError),
  float32: () => (/* reexport safe */ _external_js__rspack_import_0.float32),
  float64: () => (/* reexport safe */ _external_js__rspack_import_0.float64),
  formatError: () => (/* reexport safe */ _external_js__rspack_import_0.formatError),
  fromJSONSchema: () => (/* reexport safe */ _external_js__rspack_import_0.fromJSONSchema),
  "function": () => (/* reexport safe */ _external_js__rspack_import_0["function"]),
  getErrorMap: () => (/* reexport safe */ _external_js__rspack_import_0.getErrorMap),
  globalRegistry: () => (/* reexport safe */ _external_js__rspack_import_0.globalRegistry),
  gt: () => (/* reexport safe */ _external_js__rspack_import_0.gt),
  gte: () => (/* reexport safe */ _external_js__rspack_import_0.gte),
  guid: () => (/* reexport safe */ _external_js__rspack_import_0.guid),
  hash: () => (/* reexport safe */ _external_js__rspack_import_0.hash),
  hex: () => (/* reexport safe */ _external_js__rspack_import_0.hex),
  hostname: () => (/* reexport safe */ _external_js__rspack_import_0.hostname),
  httpUrl: () => (/* reexport safe */ _external_js__rspack_import_0.httpUrl),
  includes: () => (/* reexport safe */ _external_js__rspack_import_0.includes),
  "instanceof": () => (/* reexport safe */ _external_js__rspack_import_0["instanceof"]),
  int: () => (/* reexport safe */ _external_js__rspack_import_0.int),
  int32: () => (/* reexport safe */ _external_js__rspack_import_0.int32),
  int64: () => (/* reexport safe */ _external_js__rspack_import_0.int64),
  intersection: () => (/* reexport safe */ _external_js__rspack_import_0.intersection),
  ipv4: () => (/* reexport safe */ _external_js__rspack_import_0.ipv4),
  ipv6: () => (/* reexport safe */ _external_js__rspack_import_0.ipv6),
  iso: () => (/* reexport safe */ _external_js__rspack_import_0.iso),
  json: () => (/* reexport safe */ _external_js__rspack_import_0.json),
  jwt: () => (/* reexport safe */ _external_js__rspack_import_0.jwt),
  keyof: () => (/* reexport safe */ _external_js__rspack_import_0.keyof),
  ksuid: () => (/* reexport safe */ _external_js__rspack_import_0.ksuid),
  lazy: () => (/* reexport safe */ _external_js__rspack_import_0.lazy),
  length: () => (/* reexport safe */ _external_js__rspack_import_0.length),
  literal: () => (/* reexport safe */ _external_js__rspack_import_0.literal),
  locales: () => (/* reexport safe */ _external_js__rspack_import_0.locales),
  looseObject: () => (/* reexport safe */ _external_js__rspack_import_0.looseObject),
  looseRecord: () => (/* reexport safe */ _external_js__rspack_import_0.looseRecord),
  lowercase: () => (/* reexport safe */ _external_js__rspack_import_0.lowercase),
  lt: () => (/* reexport safe */ _external_js__rspack_import_0.lt),
  lte: () => (/* reexport safe */ _external_js__rspack_import_0.lte),
  mac: () => (/* reexport safe */ _external_js__rspack_import_0.mac),
  map: () => (/* reexport safe */ _external_js__rspack_import_0.map),
  maxLength: () => (/* reexport safe */ _external_js__rspack_import_0.maxLength),
  maxSize: () => (/* reexport safe */ _external_js__rspack_import_0.maxSize),
  meta: () => (/* reexport safe */ _external_js__rspack_import_0.meta),
  mime: () => (/* reexport safe */ _external_js__rspack_import_0.mime),
  minLength: () => (/* reexport safe */ _external_js__rspack_import_0.minLength),
  minSize: () => (/* reexport safe */ _external_js__rspack_import_0.minSize),
  multipleOf: () => (/* reexport safe */ _external_js__rspack_import_0.multipleOf),
  nan: () => (/* reexport safe */ _external_js__rspack_import_0.nan),
  nanoid: () => (/* reexport safe */ _external_js__rspack_import_0.nanoid),
  nativeEnum: () => (/* reexport safe */ _external_js__rspack_import_0.nativeEnum),
  negative: () => (/* reexport safe */ _external_js__rspack_import_0.negative),
  never: () => (/* reexport safe */ _external_js__rspack_import_0.never),
  nonnegative: () => (/* reexport safe */ _external_js__rspack_import_0.nonnegative),
  nonoptional: () => (/* reexport safe */ _external_js__rspack_import_0.nonoptional),
  nonpositive: () => (/* reexport safe */ _external_js__rspack_import_0.nonpositive),
  normalize: () => (/* reexport safe */ _external_js__rspack_import_0.normalize),
  "null": () => (/* reexport safe */ _external_js__rspack_import_0["null"]),
  nullable: () => (/* reexport safe */ _external_js__rspack_import_0.nullable),
  nullish: () => (/* reexport safe */ _external_js__rspack_import_0.nullish),
  number: () => (/* reexport safe */ _external_js__rspack_import_0.number),
  object: () => (/* reexport safe */ _external_js__rspack_import_0.object),
  optional: () => (/* reexport safe */ _external_js__rspack_import_0.optional),
  overwrite: () => (/* reexport safe */ _external_js__rspack_import_0.overwrite),
  parse: () => (/* reexport safe */ _external_js__rspack_import_0.parse),
  parseAsync: () => (/* reexport safe */ _external_js__rspack_import_0.parseAsync),
  partialRecord: () => (/* reexport safe */ _external_js__rspack_import_0.partialRecord),
  pipe: () => (/* reexport safe */ _external_js__rspack_import_0.pipe),
  positive: () => (/* reexport safe */ _external_js__rspack_import_0.positive),
  prefault: () => (/* reexport safe */ _external_js__rspack_import_0.prefault),
  preprocess: () => (/* reexport safe */ _external_js__rspack_import_0.preprocess),
  prettifyError: () => (/* reexport safe */ _external_js__rspack_import_0.prettifyError),
  promise: () => (/* reexport safe */ _external_js__rspack_import_0.promise),
  property: () => (/* reexport safe */ _external_js__rspack_import_0.property),
  readonly: () => (/* reexport safe */ _external_js__rspack_import_0.readonly),
  record: () => (/* reexport safe */ _external_js__rspack_import_0.record),
  refine: () => (/* reexport safe */ _external_js__rspack_import_0.refine),
  regex: () => (/* reexport safe */ _external_js__rspack_import_0.regex),
  regexes: () => (/* reexport safe */ _external_js__rspack_import_0.regexes),
  registry: () => (/* reexport safe */ _external_js__rspack_import_0.registry),
  safeDecode: () => (/* reexport safe */ _external_js__rspack_import_0.safeDecode),
  safeDecodeAsync: () => (/* reexport safe */ _external_js__rspack_import_0.safeDecodeAsync),
  safeEncode: () => (/* reexport safe */ _external_js__rspack_import_0.safeEncode),
  safeEncodeAsync: () => (/* reexport safe */ _external_js__rspack_import_0.safeEncodeAsync),
  safeParse: () => (/* reexport safe */ _external_js__rspack_import_0.safeParse),
  safeParseAsync: () => (/* reexport safe */ _external_js__rspack_import_0.safeParseAsync),
  set: () => (/* reexport safe */ _external_js__rspack_import_0.set),
  setErrorMap: () => (/* reexport safe */ _external_js__rspack_import_0.setErrorMap),
  size: () => (/* reexport safe */ _external_js__rspack_import_0.size),
  slugify: () => (/* reexport safe */ _external_js__rspack_import_0.slugify),
  startsWith: () => (/* reexport safe */ _external_js__rspack_import_0.startsWith),
  strictObject: () => (/* reexport safe */ _external_js__rspack_import_0.strictObject),
  string: () => (/* reexport safe */ _external_js__rspack_import_0.string),
  stringFormat: () => (/* reexport safe */ _external_js__rspack_import_0.stringFormat),
  stringbool: () => (/* reexport safe */ _external_js__rspack_import_0.stringbool),
  success: () => (/* reexport safe */ _external_js__rspack_import_0.success),
  superRefine: () => (/* reexport safe */ _external_js__rspack_import_0.superRefine),
  symbol: () => (/* reexport safe */ _external_js__rspack_import_0.symbol),
  templateLiteral: () => (/* reexport safe */ _external_js__rspack_import_0.templateLiteral),
  toJSONSchema: () => (/* reexport safe */ _external_js__rspack_import_0.toJSONSchema),
  toLowerCase: () => (/* reexport safe */ _external_js__rspack_import_0.toLowerCase),
  toUpperCase: () => (/* reexport safe */ _external_js__rspack_import_0.toUpperCase),
  transform: () => (/* reexport safe */ _external_js__rspack_import_0.transform),
  treeifyError: () => (/* reexport safe */ _external_js__rspack_import_0.treeifyError),
  trim: () => (/* reexport safe */ _external_js__rspack_import_0.trim),
  tuple: () => (/* reexport safe */ _external_js__rspack_import_0.tuple),
  uint32: () => (/* reexport safe */ _external_js__rspack_import_0.uint32),
  uint64: () => (/* reexport safe */ _external_js__rspack_import_0.uint64),
  ulid: () => (/* reexport safe */ _external_js__rspack_import_0.ulid),
  undefined: () => (/* reexport safe */ _external_js__rspack_import_0.undefined),
  union: () => (/* reexport safe */ _external_js__rspack_import_0.union),
  unknown: () => (/* reexport safe */ _external_js__rspack_import_0.unknown),
  uppercase: () => (/* reexport safe */ _external_js__rspack_import_0.uppercase),
  url: () => (/* reexport safe */ _external_js__rspack_import_0.url),
  util: () => (/* reexport safe */ _external_js__rspack_import_0.util),
  uuid: () => (/* reexport safe */ _external_js__rspack_import_0.uuid),
  uuidv4: () => (/* reexport safe */ _external_js__rspack_import_0.uuidv4),
  uuidv6: () => (/* reexport safe */ _external_js__rspack_import_0.uuidv6),
  uuidv7: () => (/* reexport safe */ _external_js__rspack_import_0.uuidv7),
  "void": () => (/* reexport safe */ _external_js__rspack_import_0["void"]),
  xid: () => (/* reexport safe */ _external_js__rspack_import_0.xid),
  xor: () => (/* reexport safe */ _external_js__rspack_import_0.xor),
  z: () => (/* reexport module object */ _external_js__rspack_import_0)
});
/* import */ var _external_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/external.js");



/* export default */ const __rspack_default_export = (_external_js__rspack_import_0);


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/iso.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  ZodISODate: () => (ZodISODate),
  ZodISODateTime: () => (ZodISODateTime),
  ZodISODuration: () => (ZodISODuration),
  ZodISOTime: () => (ZodISOTime),
  date: () => (date),
  datetime: () => (datetime),
  duration: () => (duration),
  time: () => (time)
});
/* import */ var _core_index_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/index.js");
/* import */ var _schemas_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/schemas.js");


const ZodISODateTime = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodISODateTime", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodISODateTime.init(inst, def);
    _schemas_js__rspack_import_1.ZodStringFormat.init(inst, def);
});
function datetime(params) {
    return _core_index_js__rspack_import_0._isoDateTime(ZodISODateTime, params);
}
const ZodISODate = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodISODate", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodISODate.init(inst, def);
    _schemas_js__rspack_import_1.ZodStringFormat.init(inst, def);
});
function date(params) {
    return _core_index_js__rspack_import_0._isoDate(ZodISODate, params);
}
const ZodISOTime = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodISOTime", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodISOTime.init(inst, def);
    _schemas_js__rspack_import_1.ZodStringFormat.init(inst, def);
});
function time(params) {
    return _core_index_js__rspack_import_0._isoTime(ZodISOTime, params);
}
const ZodISODuration = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodISODuration", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodISODuration.init(inst, def);
    _schemas_js__rspack_import_1.ZodStringFormat.init(inst, def);
});
function duration(params) {
    return _core_index_js__rspack_import_0._isoDuration(ZodISODuration, params);
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/parse.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  decode: () => (decode),
  decodeAsync: () => (decodeAsync),
  encode: () => (encode),
  encodeAsync: () => (encodeAsync),
  parse: () => (parse),
  parseAsync: () => (parseAsync),
  safeDecode: () => (safeDecode),
  safeDecodeAsync: () => (safeDecodeAsync),
  safeEncode: () => (safeEncode),
  safeEncodeAsync: () => (safeEncodeAsync),
  safeParse: () => (safeParse),
  safeParseAsync: () => (safeParseAsync)
});
/* import */ var _core_index_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/index.js");
/* import */ var _errors_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/errors.js");


const parse = /* @__PURE__ */ _core_index_js__rspack_import_0._parse(_errors_js__rspack_import_1.ZodRealError);
const parseAsync = /* @__PURE__ */ _core_index_js__rspack_import_0._parseAsync(_errors_js__rspack_import_1.ZodRealError);
const safeParse = /* @__PURE__ */ _core_index_js__rspack_import_0._safeParse(_errors_js__rspack_import_1.ZodRealError);
const safeParseAsync = /* @__PURE__ */ _core_index_js__rspack_import_0._safeParseAsync(_errors_js__rspack_import_1.ZodRealError);
// Codec functions
const encode = /* @__PURE__ */ _core_index_js__rspack_import_0._encode(_errors_js__rspack_import_1.ZodRealError);
const decode = /* @__PURE__ */ _core_index_js__rspack_import_0._decode(_errors_js__rspack_import_1.ZodRealError);
const encodeAsync = /* @__PURE__ */ _core_index_js__rspack_import_0._encodeAsync(_errors_js__rspack_import_1.ZodRealError);
const decodeAsync = /* @__PURE__ */ _core_index_js__rspack_import_0._decodeAsync(_errors_js__rspack_import_1.ZodRealError);
const safeEncode = /* @__PURE__ */ _core_index_js__rspack_import_0._safeEncode(_errors_js__rspack_import_1.ZodRealError);
const safeDecode = /* @__PURE__ */ _core_index_js__rspack_import_0._safeDecode(_errors_js__rspack_import_1.ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _core_index_js__rspack_import_0._safeEncodeAsync(_errors_js__rspack_import_1.ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _core_index_js__rspack_import_0._safeDecodeAsync(_errors_js__rspack_import_1.ZodRealError);


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/schemas.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  ZodAny: () => (ZodAny),
  ZodArray: () => (ZodArray),
  ZodBase64: () => (ZodBase64),
  ZodBase64URL: () => (ZodBase64URL),
  ZodBigInt: () => (ZodBigInt),
  ZodBigIntFormat: () => (ZodBigIntFormat),
  ZodBoolean: () => (ZodBoolean),
  ZodCIDRv4: () => (ZodCIDRv4),
  ZodCIDRv6: () => (ZodCIDRv6),
  ZodCUID: () => (ZodCUID),
  ZodCUID2: () => (ZodCUID2),
  ZodCatch: () => (ZodCatch),
  ZodCodec: () => (ZodCodec),
  ZodCustom: () => (ZodCustom),
  ZodCustomStringFormat: () => (ZodCustomStringFormat),
  ZodDate: () => (ZodDate),
  ZodDefault: () => (ZodDefault),
  ZodDiscriminatedUnion: () => (ZodDiscriminatedUnion),
  ZodE164: () => (ZodE164),
  ZodEmail: () => (ZodEmail),
  ZodEmoji: () => (ZodEmoji),
  ZodEnum: () => (ZodEnum),
  ZodExactOptional: () => (ZodExactOptional),
  ZodFile: () => (ZodFile),
  ZodFunction: () => (ZodFunction),
  ZodGUID: () => (ZodGUID),
  ZodIPv4: () => (ZodIPv4),
  ZodIPv6: () => (ZodIPv6),
  ZodIntersection: () => (ZodIntersection),
  ZodJWT: () => (ZodJWT),
  ZodKSUID: () => (ZodKSUID),
  ZodLazy: () => (ZodLazy),
  ZodLiteral: () => (ZodLiteral),
  ZodMAC: () => (ZodMAC),
  ZodMap: () => (ZodMap),
  ZodNaN: () => (ZodNaN),
  ZodNanoID: () => (ZodNanoID),
  ZodNever: () => (ZodNever),
  ZodNonOptional: () => (ZodNonOptional),
  ZodNull: () => (ZodNull),
  ZodNullable: () => (ZodNullable),
  ZodNumber: () => (ZodNumber),
  ZodNumberFormat: () => (ZodNumberFormat),
  ZodObject: () => (ZodObject),
  ZodOptional: () => (ZodOptional),
  ZodPipe: () => (ZodPipe),
  ZodPrefault: () => (ZodPrefault),
  ZodPromise: () => (ZodPromise),
  ZodReadonly: () => (ZodReadonly),
  ZodRecord: () => (ZodRecord),
  ZodSet: () => (ZodSet),
  ZodString: () => (ZodString),
  ZodStringFormat: () => (ZodStringFormat),
  ZodSuccess: () => (ZodSuccess),
  ZodSymbol: () => (ZodSymbol),
  ZodTemplateLiteral: () => (ZodTemplateLiteral),
  ZodTransform: () => (ZodTransform),
  ZodTuple: () => (ZodTuple),
  ZodType: () => (ZodType),
  ZodULID: () => (ZodULID),
  ZodURL: () => (ZodURL),
  ZodUUID: () => (ZodUUID),
  ZodUndefined: () => (ZodUndefined),
  ZodUnion: () => (ZodUnion),
  ZodUnknown: () => (ZodUnknown),
  ZodVoid: () => (ZodVoid),
  ZodXID: () => (ZodXID),
  ZodXor: () => (ZodXor),
  _ZodString: () => (_ZodString),
  _default: () => (_default),
  _function: () => (_function),
  any: () => (any),
  array: () => (array),
  base64: () => (base64),
  base64url: () => (base64url),
  bigint: () => (bigint),
  boolean: () => (boolean),
  "catch": () => (_catch),
  check: () => (check),
  cidrv4: () => (cidrv4),
  cidrv6: () => (cidrv6),
  codec: () => (codec),
  cuid: () => (cuid),
  cuid2: () => (cuid2),
  custom: () => (custom),
  date: () => (date),
  describe: () => (describe),
  discriminatedUnion: () => (discriminatedUnion),
  e164: () => (e164),
  email: () => (email),
  emoji: () => (emoji),
  "enum": () => (_enum),
  exactOptional: () => (exactOptional),
  file: () => (file),
  float32: () => (float32),
  float64: () => (float64),
  "function": () => (_function),
  guid: () => (guid),
  hash: () => (hash),
  hex: () => (hex),
  hostname: () => (hostname),
  httpUrl: () => (httpUrl),
  "instanceof": () => (_instanceof),
  int: () => (int),
  int32: () => (int32),
  int64: () => (int64),
  intersection: () => (intersection),
  ipv4: () => (ipv4),
  ipv6: () => (ipv6),
  json: () => (json),
  jwt: () => (jwt),
  keyof: () => (keyof),
  ksuid: () => (ksuid),
  lazy: () => (lazy),
  literal: () => (literal),
  looseObject: () => (looseObject),
  looseRecord: () => (looseRecord),
  mac: () => (mac),
  map: () => (map),
  meta: () => (meta),
  nan: () => (nan),
  nanoid: () => (nanoid),
  nativeEnum: () => (nativeEnum),
  never: () => (never),
  nonoptional: () => (nonoptional),
  "null": () => (_null),
  nullable: () => (nullable),
  nullish: () => (nullish),
  number: () => (number),
  object: () => (object),
  optional: () => (optional),
  partialRecord: () => (partialRecord),
  pipe: () => (pipe),
  prefault: () => (prefault),
  preprocess: () => (preprocess),
  promise: () => (promise),
  readonly: () => (readonly),
  record: () => (record),
  refine: () => (refine),
  set: () => (set),
  strictObject: () => (strictObject),
  string: () => (string),
  stringFormat: () => (stringFormat),
  stringbool: () => (stringbool),
  success: () => (success),
  superRefine: () => (superRefine),
  symbol: () => (symbol),
  templateLiteral: () => (templateLiteral),
  transform: () => (transform),
  tuple: () => (tuple),
  uint32: () => (uint32),
  uint64: () => (uint64),
  ulid: () => (ulid),
  undefined: () => (_undefined),
  union: () => (union),
  unknown: () => (unknown),
  url: () => (url),
  uuid: () => (uuid),
  uuidv4: () => (uuidv4),
  uuidv6: () => (uuidv6),
  uuidv7: () => (uuidv7),
  "void": () => (_void),
  xid: () => (xid),
  xor: () => (xor)
});
/* import */ var _core_index_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/index.js");
/* import */ var _core_json_schema_processors_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/json-schema-processors.js");
/* import */ var _core_to_json_schema_js__rspack_import_2 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/to-json-schema.js");
/* import */ var _checks_js__rspack_import_3 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/checks.js");
/* import */ var _iso_js__rspack_import_4 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/iso.js");
/* import */ var _parse_js__rspack_import_5 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/parse.js");







const ZodType = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodType", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodType.init(inst, def);
    Object.assign(inst["~standard"], {
        jsonSchema: {
            input: (0,_core_to_json_schema_js__rspack_import_2.createStandardJSONSchemaMethod)(inst, "input"),
            output: (0,_core_to_json_schema_js__rspack_import_2.createStandardJSONSchemaMethod)(inst, "output"),
        },
    });
    inst.toJSONSchema = (0,_core_to_json_schema_js__rspack_import_2.createToJSONSchemaMethod)(inst, {});
    inst.def = def;
    inst.type = def.type;
    Object.defineProperty(inst, "_def", { value: def });
    // base methods
    inst.check = (...checks) => {
        return inst.clone(_core_index_js__rspack_import_0.util.mergeDefs(def, {
            checks: [
                ...(def.checks ?? []),
                ...checks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch),
            ],
        }), {
            parent: true,
        });
    };
    inst.with = inst.check;
    inst.clone = (def, params) => _core_index_js__rspack_import_0.clone(inst, def, params);
    inst.brand = () => inst;
    inst.register = ((reg, meta) => {
        reg.add(inst, meta);
        return inst;
    });
    // parsing
    inst.parse = (data, params) => _parse_js__rspack_import_5.parse(inst, data, params, { callee: inst.parse });
    inst.safeParse = (data, params) => _parse_js__rspack_import_5.safeParse(inst, data, params);
    inst.parseAsync = async (data, params) => _parse_js__rspack_import_5.parseAsync(inst, data, params, { callee: inst.parseAsync });
    inst.safeParseAsync = async (data, params) => _parse_js__rspack_import_5.safeParseAsync(inst, data, params);
    inst.spa = inst.safeParseAsync;
    // encoding/decoding
    inst.encode = (data, params) => _parse_js__rspack_import_5.encode(inst, data, params);
    inst.decode = (data, params) => _parse_js__rspack_import_5.decode(inst, data, params);
    inst.encodeAsync = async (data, params) => _parse_js__rspack_import_5.encodeAsync(inst, data, params);
    inst.decodeAsync = async (data, params) => _parse_js__rspack_import_5.decodeAsync(inst, data, params);
    inst.safeEncode = (data, params) => _parse_js__rspack_import_5.safeEncode(inst, data, params);
    inst.safeDecode = (data, params) => _parse_js__rspack_import_5.safeDecode(inst, data, params);
    inst.safeEncodeAsync = async (data, params) => _parse_js__rspack_import_5.safeEncodeAsync(inst, data, params);
    inst.safeDecodeAsync = async (data, params) => _parse_js__rspack_import_5.safeDecodeAsync(inst, data, params);
    // refinements
    inst.refine = (check, params) => inst.check(refine(check, params));
    inst.superRefine = (refinement) => inst.check(superRefine(refinement));
    inst.overwrite = (fn) => inst.check(_checks_js__rspack_import_3.overwrite(fn));
    // wrappers
    inst.optional = () => optional(inst);
    inst.exactOptional = () => exactOptional(inst);
    inst.nullable = () => nullable(inst);
    inst.nullish = () => optional(nullable(inst));
    inst.nonoptional = (params) => nonoptional(inst, params);
    inst.array = () => array(inst);
    inst.or = (arg) => union([inst, arg]);
    inst.and = (arg) => intersection(inst, arg);
    inst.transform = (tx) => pipe(inst, transform(tx));
    inst.default = (def) => _default(inst, def);
    inst.prefault = (def) => prefault(inst, def);
    // inst.coalesce = (def, params) => coalesce(inst, def, params);
    inst.catch = (params) => _catch(inst, params);
    inst.pipe = (target) => pipe(inst, target);
    inst.readonly = () => readonly(inst);
    // meta
    inst.describe = (description) => {
        const cl = inst.clone();
        _core_index_js__rspack_import_0.globalRegistry.add(cl, { description });
        return cl;
    };
    Object.defineProperty(inst, "description", {
        get() {
            return _core_index_js__rspack_import_0.globalRegistry.get(inst)?.description;
        },
        configurable: true,
    });
    inst.meta = (...args) => {
        if (args.length === 0) {
            return _core_index_js__rspack_import_0.globalRegistry.get(inst);
        }
        const cl = inst.clone();
        _core_index_js__rspack_import_0.globalRegistry.add(cl, args[0]);
        return cl;
    };
    // helpers
    inst.isOptional = () => inst.safeParse(undefined).success;
    inst.isNullable = () => inst.safeParse(null).success;
    inst.apply = (fn) => fn(inst);
    return inst;
});
/** @internal */
const _ZodString = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("_ZodString", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodString.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.stringProcessor(inst, ctx, json, params);
    const bag = inst._zod.bag;
    inst.format = bag.format ?? null;
    inst.minLength = bag.minimum ?? null;
    inst.maxLength = bag.maximum ?? null;
    // validations
    inst.regex = (...args) => inst.check(_checks_js__rspack_import_3.regex(...args));
    inst.includes = (...args) => inst.check(_checks_js__rspack_import_3.includes(...args));
    inst.startsWith = (...args) => inst.check(_checks_js__rspack_import_3.startsWith(...args));
    inst.endsWith = (...args) => inst.check(_checks_js__rspack_import_3.endsWith(...args));
    inst.min = (...args) => inst.check(_checks_js__rspack_import_3.minLength(...args));
    inst.max = (...args) => inst.check(_checks_js__rspack_import_3.maxLength(...args));
    inst.length = (...args) => inst.check(_checks_js__rspack_import_3.length(...args));
    inst.nonempty = (...args) => inst.check(_checks_js__rspack_import_3.minLength(1, ...args));
    inst.lowercase = (params) => inst.check(_checks_js__rspack_import_3.lowercase(params));
    inst.uppercase = (params) => inst.check(_checks_js__rspack_import_3.uppercase(params));
    // transforms
    inst.trim = () => inst.check(_checks_js__rspack_import_3.trim());
    inst.normalize = (...args) => inst.check(_checks_js__rspack_import_3.normalize(...args));
    inst.toLowerCase = () => inst.check(_checks_js__rspack_import_3.toLowerCase());
    inst.toUpperCase = () => inst.check(_checks_js__rspack_import_3.toUpperCase());
    inst.slugify = () => inst.check(_checks_js__rspack_import_3.slugify());
});
const ZodString = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodString", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodString.init(inst, def);
    _ZodString.init(inst, def);
    inst.email = (params) => inst.check(_core_index_js__rspack_import_0._email(ZodEmail, params));
    inst.url = (params) => inst.check(_core_index_js__rspack_import_0._url(ZodURL, params));
    inst.jwt = (params) => inst.check(_core_index_js__rspack_import_0._jwt(ZodJWT, params));
    inst.emoji = (params) => inst.check(_core_index_js__rspack_import_0._emoji(ZodEmoji, params));
    inst.guid = (params) => inst.check(_core_index_js__rspack_import_0._guid(ZodGUID, params));
    inst.uuid = (params) => inst.check(_core_index_js__rspack_import_0._uuid(ZodUUID, params));
    inst.uuidv4 = (params) => inst.check(_core_index_js__rspack_import_0._uuidv4(ZodUUID, params));
    inst.uuidv6 = (params) => inst.check(_core_index_js__rspack_import_0._uuidv6(ZodUUID, params));
    inst.uuidv7 = (params) => inst.check(_core_index_js__rspack_import_0._uuidv7(ZodUUID, params));
    inst.nanoid = (params) => inst.check(_core_index_js__rspack_import_0._nanoid(ZodNanoID, params));
    inst.guid = (params) => inst.check(_core_index_js__rspack_import_0._guid(ZodGUID, params));
    inst.cuid = (params) => inst.check(_core_index_js__rspack_import_0._cuid(ZodCUID, params));
    inst.cuid2 = (params) => inst.check(_core_index_js__rspack_import_0._cuid2(ZodCUID2, params));
    inst.ulid = (params) => inst.check(_core_index_js__rspack_import_0._ulid(ZodULID, params));
    inst.base64 = (params) => inst.check(_core_index_js__rspack_import_0._base64(ZodBase64, params));
    inst.base64url = (params) => inst.check(_core_index_js__rspack_import_0._base64url(ZodBase64URL, params));
    inst.xid = (params) => inst.check(_core_index_js__rspack_import_0._xid(ZodXID, params));
    inst.ksuid = (params) => inst.check(_core_index_js__rspack_import_0._ksuid(ZodKSUID, params));
    inst.ipv4 = (params) => inst.check(_core_index_js__rspack_import_0._ipv4(ZodIPv4, params));
    inst.ipv6 = (params) => inst.check(_core_index_js__rspack_import_0._ipv6(ZodIPv6, params));
    inst.cidrv4 = (params) => inst.check(_core_index_js__rspack_import_0._cidrv4(ZodCIDRv4, params));
    inst.cidrv6 = (params) => inst.check(_core_index_js__rspack_import_0._cidrv6(ZodCIDRv6, params));
    inst.e164 = (params) => inst.check(_core_index_js__rspack_import_0._e164(ZodE164, params));
    // iso
    inst.datetime = (params) => inst.check(_iso_js__rspack_import_4.datetime(params));
    inst.date = (params) => inst.check(_iso_js__rspack_import_4.date(params));
    inst.time = (params) => inst.check(_iso_js__rspack_import_4.time(params));
    inst.duration = (params) => inst.check(_iso_js__rspack_import_4.duration(params));
});
function string(params) {
    return _core_index_js__rspack_import_0._string(ZodString, params);
}
const ZodStringFormat = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodStringFormat", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodStringFormat.init(inst, def);
    _ZodString.init(inst, def);
});
const ZodEmail = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodEmail", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodEmail.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function email(params) {
    return _core_index_js__rspack_import_0._email(ZodEmail, params);
}
const ZodGUID = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodGUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodGUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function guid(params) {
    return _core_index_js__rspack_import_0._guid(ZodGUID, params);
}
const ZodUUID = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodUUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodUUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function uuid(params) {
    return _core_index_js__rspack_import_0._uuid(ZodUUID, params);
}
function uuidv4(params) {
    return _core_index_js__rspack_import_0._uuidv4(ZodUUID, params);
}
// ZodUUIDv6
function uuidv6(params) {
    return _core_index_js__rspack_import_0._uuidv6(ZodUUID, params);
}
// ZodUUIDv7
function uuidv7(params) {
    return _core_index_js__rspack_import_0._uuidv7(ZodUUID, params);
}
const ZodURL = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodURL", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodURL.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function url(params) {
    return _core_index_js__rspack_import_0._url(ZodURL, params);
}
function httpUrl(params) {
    return _core_index_js__rspack_import_0._url(ZodURL, {
        protocol: /^https?$/,
        hostname: _core_index_js__rspack_import_0.regexes.domain,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodEmoji = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodEmoji", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodEmoji.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function emoji(params) {
    return _core_index_js__rspack_import_0._emoji(ZodEmoji, params);
}
const ZodNanoID = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodNanoID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodNanoID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function nanoid(params) {
    return _core_index_js__rspack_import_0._nanoid(ZodNanoID, params);
}
const ZodCUID = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodCUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodCUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function cuid(params) {
    return _core_index_js__rspack_import_0._cuid(ZodCUID, params);
}
const ZodCUID2 = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodCUID2", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodCUID2.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function cuid2(params) {
    return _core_index_js__rspack_import_0._cuid2(ZodCUID2, params);
}
const ZodULID = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodULID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodULID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function ulid(params) {
    return _core_index_js__rspack_import_0._ulid(ZodULID, params);
}
const ZodXID = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodXID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodXID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function xid(params) {
    return _core_index_js__rspack_import_0._xid(ZodXID, params);
}
const ZodKSUID = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodKSUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodKSUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function ksuid(params) {
    return _core_index_js__rspack_import_0._ksuid(ZodKSUID, params);
}
const ZodIPv4 = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodIPv4", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodIPv4.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function ipv4(params) {
    return _core_index_js__rspack_import_0._ipv4(ZodIPv4, params);
}
const ZodMAC = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodMAC", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodMAC.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function mac(params) {
    return _core_index_js__rspack_import_0._mac(ZodMAC, params);
}
const ZodIPv6 = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodIPv6", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodIPv6.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function ipv6(params) {
    return _core_index_js__rspack_import_0._ipv6(ZodIPv6, params);
}
const ZodCIDRv4 = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodCIDRv4", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodCIDRv4.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function cidrv4(params) {
    return _core_index_js__rspack_import_0._cidrv4(ZodCIDRv4, params);
}
const ZodCIDRv6 = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodCIDRv6", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodCIDRv6.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function cidrv6(params) {
    return _core_index_js__rspack_import_0._cidrv6(ZodCIDRv6, params);
}
const ZodBase64 = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodBase64", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodBase64.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function base64(params) {
    return _core_index_js__rspack_import_0._base64(ZodBase64, params);
}
const ZodBase64URL = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodBase64URL", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodBase64URL.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function base64url(params) {
    return _core_index_js__rspack_import_0._base64url(ZodBase64URL, params);
}
const ZodE164 = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodE164", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodE164.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function e164(params) {
    return _core_index_js__rspack_import_0._e164(ZodE164, params);
}
const ZodJWT = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodJWT", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodJWT.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function jwt(params) {
    return _core_index_js__rspack_import_0._jwt(ZodJWT, params);
}
const ZodCustomStringFormat = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodCustomStringFormat", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    _core_index_js__rspack_import_0.$ZodCustomStringFormat.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function stringFormat(format, fnOrRegex, _params = {}) {
    return _core_index_js__rspack_import_0._stringFormat(ZodCustomStringFormat, format, fnOrRegex, _params);
}
function hostname(_params) {
    return _core_index_js__rspack_import_0._stringFormat(ZodCustomStringFormat, "hostname", _core_index_js__rspack_import_0.regexes.hostname, _params);
}
function hex(_params) {
    return _core_index_js__rspack_import_0._stringFormat(ZodCustomStringFormat, "hex", _core_index_js__rspack_import_0.regexes.hex, _params);
}
function hash(alg, params) {
    const enc = params?.enc ?? "hex";
    const format = `${alg}_${enc}`;
    const regex = _core_index_js__rspack_import_0.regexes[format];
    if (!regex)
        throw new Error(`Unrecognized hash format: ${format}`);
    return _core_index_js__rspack_import_0._stringFormat(ZodCustomStringFormat, format, regex, params);
}
const ZodNumber = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodNumber", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodNumber.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.numberProcessor(inst, ctx, json, params);
    inst.gt = (value, params) => inst.check(_checks_js__rspack_import_3.gt(value, params));
    inst.gte = (value, params) => inst.check(_checks_js__rspack_import_3.gte(value, params));
    inst.min = (value, params) => inst.check(_checks_js__rspack_import_3.gte(value, params));
    inst.lt = (value, params) => inst.check(_checks_js__rspack_import_3.lt(value, params));
    inst.lte = (value, params) => inst.check(_checks_js__rspack_import_3.lte(value, params));
    inst.max = (value, params) => inst.check(_checks_js__rspack_import_3.lte(value, params));
    inst.int = (params) => inst.check(int(params));
    inst.safe = (params) => inst.check(int(params));
    inst.positive = (params) => inst.check(_checks_js__rspack_import_3.gt(0, params));
    inst.nonnegative = (params) => inst.check(_checks_js__rspack_import_3.gte(0, params));
    inst.negative = (params) => inst.check(_checks_js__rspack_import_3.lt(0, params));
    inst.nonpositive = (params) => inst.check(_checks_js__rspack_import_3.lte(0, params));
    inst.multipleOf = (value, params) => inst.check(_checks_js__rspack_import_3.multipleOf(value, params));
    inst.step = (value, params) => inst.check(_checks_js__rspack_import_3.multipleOf(value, params));
    // inst.finite = (params) => inst.check(core.finite(params));
    inst.finite = () => inst;
    const bag = inst._zod.bag;
    inst.minValue =
        Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
    inst.maxValue =
        Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
    inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
    inst.isFinite = true;
    inst.format = bag.format ?? null;
});
function number(params) {
    return _core_index_js__rspack_import_0._number(ZodNumber, params);
}
const ZodNumberFormat = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodNumberFormat", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodNumberFormat.init(inst, def);
    ZodNumber.init(inst, def);
});
function int(params) {
    return _core_index_js__rspack_import_0._int(ZodNumberFormat, params);
}
function float32(params) {
    return _core_index_js__rspack_import_0._float32(ZodNumberFormat, params);
}
function float64(params) {
    return _core_index_js__rspack_import_0._float64(ZodNumberFormat, params);
}
function int32(params) {
    return _core_index_js__rspack_import_0._int32(ZodNumberFormat, params);
}
function uint32(params) {
    return _core_index_js__rspack_import_0._uint32(ZodNumberFormat, params);
}
const ZodBoolean = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodBoolean", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodBoolean.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.booleanProcessor(inst, ctx, json, params);
});
function boolean(params) {
    return _core_index_js__rspack_import_0._boolean(ZodBoolean, params);
}
const ZodBigInt = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodBigInt", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodBigInt.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.bigintProcessor(inst, ctx, json, params);
    inst.gte = (value, params) => inst.check(_checks_js__rspack_import_3.gte(value, params));
    inst.min = (value, params) => inst.check(_checks_js__rspack_import_3.gte(value, params));
    inst.gt = (value, params) => inst.check(_checks_js__rspack_import_3.gt(value, params));
    inst.gte = (value, params) => inst.check(_checks_js__rspack_import_3.gte(value, params));
    inst.min = (value, params) => inst.check(_checks_js__rspack_import_3.gte(value, params));
    inst.lt = (value, params) => inst.check(_checks_js__rspack_import_3.lt(value, params));
    inst.lte = (value, params) => inst.check(_checks_js__rspack_import_3.lte(value, params));
    inst.max = (value, params) => inst.check(_checks_js__rspack_import_3.lte(value, params));
    inst.positive = (params) => inst.check(_checks_js__rspack_import_3.gt(BigInt(0), params));
    inst.negative = (params) => inst.check(_checks_js__rspack_import_3.lt(BigInt(0), params));
    inst.nonpositive = (params) => inst.check(_checks_js__rspack_import_3.lte(BigInt(0), params));
    inst.nonnegative = (params) => inst.check(_checks_js__rspack_import_3.gte(BigInt(0), params));
    inst.multipleOf = (value, params) => inst.check(_checks_js__rspack_import_3.multipleOf(value, params));
    const bag = inst._zod.bag;
    inst.minValue = bag.minimum ?? null;
    inst.maxValue = bag.maximum ?? null;
    inst.format = bag.format ?? null;
});
function bigint(params) {
    return _core_index_js__rspack_import_0._bigint(ZodBigInt, params);
}
const ZodBigIntFormat = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodBigIntFormat", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodBigIntFormat.init(inst, def);
    ZodBigInt.init(inst, def);
});
// int64
function int64(params) {
    return _core_index_js__rspack_import_0._int64(ZodBigIntFormat, params);
}
// uint64
function uint64(params) {
    return _core_index_js__rspack_import_0._uint64(ZodBigIntFormat, params);
}
const ZodSymbol = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodSymbol", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodSymbol.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.symbolProcessor(inst, ctx, json, params);
});
function symbol(params) {
    return _core_index_js__rspack_import_0._symbol(ZodSymbol, params);
}
const ZodUndefined = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodUndefined", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodUndefined.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.undefinedProcessor(inst, ctx, json, params);
});
function _undefined(params) {
    return _core_index_js__rspack_import_0._undefined(ZodUndefined, params);
}

const ZodNull = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodNull", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodNull.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.nullProcessor(inst, ctx, json, params);
});
function _null(params) {
    return _core_index_js__rspack_import_0._null(ZodNull, params);
}

const ZodAny = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodAny", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodAny.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.anyProcessor(inst, ctx, json, params);
});
function any() {
    return _core_index_js__rspack_import_0._any(ZodAny);
}
const ZodUnknown = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodUnknown", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodUnknown.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.unknownProcessor(inst, ctx, json, params);
});
function unknown() {
    return _core_index_js__rspack_import_0._unknown(ZodUnknown);
}
const ZodNever = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodNever", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodNever.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.neverProcessor(inst, ctx, json, params);
});
function never(params) {
    return _core_index_js__rspack_import_0._never(ZodNever, params);
}
const ZodVoid = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodVoid", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodVoid.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.voidProcessor(inst, ctx, json, params);
});
function _void(params) {
    return _core_index_js__rspack_import_0._void(ZodVoid, params);
}

const ZodDate = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodDate", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodDate.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.dateProcessor(inst, ctx, json, params);
    inst.min = (value, params) => inst.check(_checks_js__rspack_import_3.gte(value, params));
    inst.max = (value, params) => inst.check(_checks_js__rspack_import_3.lte(value, params));
    const c = inst._zod.bag;
    inst.minDate = c.minimum ? new Date(c.minimum) : null;
    inst.maxDate = c.maximum ? new Date(c.maximum) : null;
});
function date(params) {
    return _core_index_js__rspack_import_0._date(ZodDate, params);
}
const ZodArray = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodArray", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodArray.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.arrayProcessor(inst, ctx, json, params);
    inst.element = def.element;
    inst.min = (minLength, params) => inst.check(_checks_js__rspack_import_3.minLength(minLength, params));
    inst.nonempty = (params) => inst.check(_checks_js__rspack_import_3.minLength(1, params));
    inst.max = (maxLength, params) => inst.check(_checks_js__rspack_import_3.maxLength(maxLength, params));
    inst.length = (len, params) => inst.check(_checks_js__rspack_import_3.length(len, params));
    inst.unwrap = () => inst.element;
});
function array(element, params) {
    return _core_index_js__rspack_import_0._array(ZodArray, element, params);
}
// .keyof
function keyof(schema) {
    const shape = schema._zod.def.shape;
    return _enum(Object.keys(shape));
}
const ZodObject = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodObject", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodObjectJIT.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.objectProcessor(inst, ctx, json, params);
    _core_index_js__rspack_import_0.util.defineLazy(inst, "shape", () => {
        return def.shape;
    });
    inst.keyof = () => _enum(Object.keys(inst._zod.def.shape));
    inst.catchall = (catchall) => inst.clone({ ...inst._zod.def, catchall: catchall });
    inst.passthrough = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
    inst.loose = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
    inst.strict = () => inst.clone({ ...inst._zod.def, catchall: never() });
    inst.strip = () => inst.clone({ ...inst._zod.def, catchall: undefined });
    inst.extend = (incoming) => {
        return _core_index_js__rspack_import_0.util.extend(inst, incoming);
    };
    inst.safeExtend = (incoming) => {
        return _core_index_js__rspack_import_0.util.safeExtend(inst, incoming);
    };
    inst.merge = (other) => _core_index_js__rspack_import_0.util.merge(inst, other);
    inst.pick = (mask) => _core_index_js__rspack_import_0.util.pick(inst, mask);
    inst.omit = (mask) => _core_index_js__rspack_import_0.util.omit(inst, mask);
    inst.partial = (...args) => _core_index_js__rspack_import_0.util.partial(ZodOptional, inst, args[0]);
    inst.required = (...args) => _core_index_js__rspack_import_0.util.required(ZodNonOptional, inst, args[0]);
});
function object(shape, params) {
    const def = {
        type: "object",
        shape: shape ?? {},
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    };
    return new ZodObject(def);
}
// strictObject
function strictObject(shape, params) {
    return new ZodObject({
        type: "object",
        shape,
        catchall: never(),
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
// looseObject
function looseObject(shape, params) {
    return new ZodObject({
        type: "object",
        shape,
        catchall: unknown(),
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodUnion = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodUnion", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodUnion.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.unionProcessor(inst, ctx, json, params);
    inst.options = def.options;
});
function union(options, params) {
    return new ZodUnion({
        type: "union",
        options: options,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodXor = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodXor", (inst, def) => {
    ZodUnion.init(inst, def);
    _core_index_js__rspack_import_0.$ZodXor.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.unionProcessor(inst, ctx, json, params);
    inst.options = def.options;
});
/** Creates an exclusive union (XOR) where exactly one option must match.
 * Unlike regular unions that succeed when any option matches, xor fails if
 * zero or more than one option matches the input. */
function xor(options, params) {
    return new ZodXor({
        type: "union",
        options: options,
        inclusive: false,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodDiscriminatedUnion = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodDiscriminatedUnion", (inst, def) => {
    ZodUnion.init(inst, def);
    _core_index_js__rspack_import_0.$ZodDiscriminatedUnion.init(inst, def);
});
function discriminatedUnion(discriminator, options, params) {
    // const [options, params] = args;
    return new ZodDiscriminatedUnion({
        type: "union",
        options,
        discriminator,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodIntersection = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodIntersection", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodIntersection.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
    return new ZodIntersection({
        type: "intersection",
        left: left,
        right: right,
    });
}
const ZodTuple = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodTuple", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodTuple.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.tupleProcessor(inst, ctx, json, params);
    inst.rest = (rest) => inst.clone({
        ...inst._zod.def,
        rest: rest,
    });
});
function tuple(items, _paramsOrRest, _params) {
    const hasRest = _paramsOrRest instanceof _core_index_js__rspack_import_0.$ZodType;
    const params = hasRest ? _params : _paramsOrRest;
    const rest = hasRest ? _paramsOrRest : null;
    return new ZodTuple({
        type: "tuple",
        items: items,
        rest,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodRecord = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodRecord", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodRecord.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.recordProcessor(inst, ctx, json, params);
    inst.keyType = def.keyType;
    inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
    return new ZodRecord({
        type: "record",
        keyType,
        valueType: valueType,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
// type alksjf = core.output<core.$ZodRecordKey>;
function partialRecord(keyType, valueType, params) {
    const k = _core_index_js__rspack_import_0.clone(keyType);
    k._zod.values = undefined;
    return new ZodRecord({
        type: "record",
        keyType: k,
        valueType: valueType,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
function looseRecord(keyType, valueType, params) {
    return new ZodRecord({
        type: "record",
        keyType,
        valueType: valueType,
        mode: "loose",
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodMap = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodMap", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodMap.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.mapProcessor(inst, ctx, json, params);
    inst.keyType = def.keyType;
    inst.valueType = def.valueType;
    inst.min = (...args) => inst.check(_core_index_js__rspack_import_0._minSize(...args));
    inst.nonempty = (params) => inst.check(_core_index_js__rspack_import_0._minSize(1, params));
    inst.max = (...args) => inst.check(_core_index_js__rspack_import_0._maxSize(...args));
    inst.size = (...args) => inst.check(_core_index_js__rspack_import_0._size(...args));
});
function map(keyType, valueType, params) {
    return new ZodMap({
        type: "map",
        keyType: keyType,
        valueType: valueType,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodSet = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodSet", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodSet.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.setProcessor(inst, ctx, json, params);
    inst.min = (...args) => inst.check(_core_index_js__rspack_import_0._minSize(...args));
    inst.nonempty = (params) => inst.check(_core_index_js__rspack_import_0._minSize(1, params));
    inst.max = (...args) => inst.check(_core_index_js__rspack_import_0._maxSize(...args));
    inst.size = (...args) => inst.check(_core_index_js__rspack_import_0._size(...args));
});
function set(valueType, params) {
    return new ZodSet({
        type: "set",
        valueType: valueType,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodEnum = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodEnum", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodEnum.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.enumProcessor(inst, ctx, json, params);
    inst.enum = def.entries;
    inst.options = Object.values(def.entries);
    const keys = new Set(Object.keys(def.entries));
    inst.extract = (values, params) => {
        const newEntries = {};
        for (const value of values) {
            if (keys.has(value)) {
                newEntries[value] = def.entries[value];
            }
            else
                throw new Error(`Key ${value} not found in enum`);
        }
        return new ZodEnum({
            ...def,
            checks: [],
            ..._core_index_js__rspack_import_0.util.normalizeParams(params),
            entries: newEntries,
        });
    };
    inst.exclude = (values, params) => {
        const newEntries = { ...def.entries };
        for (const value of values) {
            if (keys.has(value)) {
                delete newEntries[value];
            }
            else
                throw new Error(`Key ${value} not found in enum`);
        }
        return new ZodEnum({
            ...def,
            checks: [],
            ..._core_index_js__rspack_import_0.util.normalizeParams(params),
            entries: newEntries,
        });
    };
});
function _enum(values, params) {
    const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
    return new ZodEnum({
        type: "enum",
        entries,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}

/** @deprecated This API has been merged into `z.enum()`. Use `z.enum()` instead.
 *
 * ```ts
 * enum Colors { red, green, blue }
 * z.enum(Colors);
 * ```
 */
function nativeEnum(entries, params) {
    return new ZodEnum({
        type: "enum",
        entries,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodLiteral = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodLiteral", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodLiteral.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.literalProcessor(inst, ctx, json, params);
    inst.values = new Set(def.values);
    Object.defineProperty(inst, "value", {
        get() {
            if (def.values.length > 1) {
                throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
            }
            return def.values[0];
        },
    });
});
function literal(value, params) {
    return new ZodLiteral({
        type: "literal",
        values: Array.isArray(value) ? value : [value],
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodFile = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodFile", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodFile.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.fileProcessor(inst, ctx, json, params);
    inst.min = (size, params) => inst.check(_core_index_js__rspack_import_0._minSize(size, params));
    inst.max = (size, params) => inst.check(_core_index_js__rspack_import_0._maxSize(size, params));
    inst.mime = (types, params) => inst.check(_core_index_js__rspack_import_0._mime(Array.isArray(types) ? types : [types], params));
});
function file(params) {
    return _core_index_js__rspack_import_0._file(ZodFile, params);
}
const ZodTransform = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodTransform", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodTransform.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.transformProcessor(inst, ctx, json, params);
    inst._zod.parse = (payload, _ctx) => {
        if (_ctx.direction === "backward") {
            throw new _core_index_js__rspack_import_0.$ZodEncodeError(inst.constructor.name);
        }
        payload.addIssue = (issue) => {
            if (typeof issue === "string") {
                payload.issues.push(_core_index_js__rspack_import_0.util.issue(issue, payload.value, def));
            }
            else {
                // for Zod 3 backwards compatibility
                const _issue = issue;
                if (_issue.fatal)
                    _issue.continue = false;
                _issue.code ?? (_issue.code = "custom");
                _issue.input ?? (_issue.input = payload.value);
                _issue.inst ?? (_issue.inst = inst);
                // _issue.continue ??= true;
                payload.issues.push(_core_index_js__rspack_import_0.util.issue(_issue));
            }
        };
        const output = def.transform(payload.value, payload);
        if (output instanceof Promise) {
            return output.then((output) => {
                payload.value = output;
                return payload;
            });
        }
        payload.value = output;
        return payload;
    };
});
function transform(fn) {
    return new ZodTransform({
        type: "transform",
        transform: fn,
    });
}
const ZodOptional = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodOptional", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.optionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
    return new ZodOptional({
        type: "optional",
        innerType: innerType,
    });
}
const ZodExactOptional = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodExactOptional", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodExactOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.optionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
    return new ZodExactOptional({
        type: "optional",
        innerType: innerType,
    });
}
const ZodNullable = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodNullable", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodNullable.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.nullableProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
    return new ZodNullable({
        type: "nullable",
        innerType: innerType,
    });
}
// nullish
function nullish(innerType) {
    return optional(nullable(innerType));
}
const ZodDefault = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodDefault", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodDefault.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.defaultProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
    return new ZodDefault({
        type: "default",
        innerType: innerType,
        get defaultValue() {
            return typeof defaultValue === "function" ? defaultValue() : _core_index_js__rspack_import_0.util.shallowClone(defaultValue);
        },
    });
}
const ZodPrefault = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodPrefault", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodPrefault.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.prefaultProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
    return new ZodPrefault({
        type: "prefault",
        innerType: innerType,
        get defaultValue() {
            return typeof defaultValue === "function" ? defaultValue() : _core_index_js__rspack_import_0.util.shallowClone(defaultValue);
        },
    });
}
const ZodNonOptional = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodNonOptional", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodNonOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.nonoptionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
    return new ZodNonOptional({
        type: "nonoptional",
        innerType: innerType,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodSuccess = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodSuccess", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodSuccess.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.successProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function success(innerType) {
    return new ZodSuccess({
        type: "success",
        innerType: innerType,
    });
}
const ZodCatch = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodCatch", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodCatch.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.catchProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
    return new ZodCatch({
        type: "catch",
        innerType: innerType,
        catchValue: (typeof catchValue === "function" ? catchValue : () => catchValue),
    });
}

const ZodNaN = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodNaN", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodNaN.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.nanProcessor(inst, ctx, json, params);
});
function nan(params) {
    return _core_index_js__rspack_import_0._nan(ZodNaN, params);
}
const ZodPipe = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodPipe", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodPipe.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.pipeProcessor(inst, ctx, json, params);
    inst.in = def.in;
    inst.out = def.out;
});
function pipe(in_, out) {
    return new ZodPipe({
        type: "pipe",
        in: in_,
        out: out,
        // ...util.normalizeParams(params),
    });
}
const ZodCodec = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodCodec", (inst, def) => {
    ZodPipe.init(inst, def);
    _core_index_js__rspack_import_0.$ZodCodec.init(inst, def);
});
function codec(in_, out, params) {
    return new ZodCodec({
        type: "pipe",
        in: in_,
        out: out,
        transform: params.decode,
        reverseTransform: params.encode,
    });
}
const ZodReadonly = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodReadonly", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodReadonly.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.readonlyProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
    return new ZodReadonly({
        type: "readonly",
        innerType: innerType,
    });
}
const ZodTemplateLiteral = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodTemplateLiteral", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodTemplateLiteral.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.templateLiteralProcessor(inst, ctx, json, params);
});
function templateLiteral(parts, params) {
    return new ZodTemplateLiteral({
        type: "template_literal",
        parts,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
}
const ZodLazy = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodLazy", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodLazy.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.lazyProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.getter();
});
function lazy(getter) {
    return new ZodLazy({
        type: "lazy",
        getter: getter,
    });
}
const ZodPromise = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodPromise", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodPromise.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.promiseProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function promise(innerType) {
    return new ZodPromise({
        type: "promise",
        innerType: innerType,
    });
}
const ZodFunction = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodFunction", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodFunction.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.functionProcessor(inst, ctx, json, params);
});
function _function(params) {
    return new ZodFunction({
        type: "function",
        input: Array.isArray(params?.input) ? tuple(params?.input) : (params?.input ?? array(unknown())),
        output: params?.output ?? unknown(),
    });
}

const ZodCustom = /*@__PURE__*/ _core_index_js__rspack_import_0.$constructor("ZodCustom", (inst, def) => {
    _core_index_js__rspack_import_0.$ZodCustom.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => _core_json_schema_processors_js__rspack_import_1.customProcessor(inst, ctx, json, params);
});
// custom checks
function check(fn) {
    const ch = new _core_index_js__rspack_import_0.$ZodCheck({
        check: "custom",
        // ...util.normalizeParams(params),
    });
    ch._zod.check = fn;
    return ch;
}
function custom(fn, _params) {
    return _core_index_js__rspack_import_0._custom(ZodCustom, fn ?? (() => true), _params);
}
function refine(fn, _params = {}) {
    return _core_index_js__rspack_import_0._refine(ZodCustom, fn, _params);
}
// superRefine
function superRefine(fn) {
    return _core_index_js__rspack_import_0._superRefine(fn);
}
// Re-export describe and meta from core
const describe = _core_index_js__rspack_import_0.describe;
const meta = _core_index_js__rspack_import_0.meta;
function _instanceof(cls, params = {}) {
    const inst = new ZodCustom({
        type: "custom",
        check: "custom",
        fn: (data) => data instanceof cls,
        abort: true,
        ..._core_index_js__rspack_import_0.util.normalizeParams(params),
    });
    inst._zod.bag.Class = cls;
    // Override check to emit invalid_type instead of custom
    inst._zod.check = (payload) => {
        if (!(payload.value instanceof cls)) {
            payload.issues.push({
                code: "invalid_type",
                expected: cls.name,
                input: payload.value,
                inst,
                path: [...(inst._zod.def.path ?? [])],
            });
        }
    };
    return inst;
}

// stringbool
const stringbool = (...args) => _core_index_js__rspack_import_0._stringbool({
    Codec: ZodCodec,
    Boolean: ZodBoolean,
    String: ZodString,
}, ...args);
function json(params) {
    const jsonSchema = lazy(() => {
        return union([string(params), number(), boolean(), _null(), array(jsonSchema), record(string(), jsonSchema)]);
    });
    return jsonSchema;
}
// preprocess
// /** @deprecated Use `z.pipe()` and `z.transform()` instead. */
function preprocess(fn, schema) {
    return pipe(transform(fn), schema);
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/api.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  TimePrecision: () => (TimePrecision),
  _any: () => (_any),
  _array: () => (_array),
  _base64: () => (_base64),
  _base64url: () => (_base64url),
  _bigint: () => (_bigint),
  _boolean: () => (_boolean),
  _catch: () => (_catch),
  _check: () => (_check),
  _cidrv4: () => (_cidrv4),
  _cidrv6: () => (_cidrv6),
  _coercedBigint: () => (_coercedBigint),
  _coercedBoolean: () => (_coercedBoolean),
  _coercedDate: () => (_coercedDate),
  _coercedNumber: () => (_coercedNumber),
  _coercedString: () => (_coercedString),
  _cuid: () => (_cuid),
  _cuid2: () => (_cuid2),
  _custom: () => (_custom),
  _date: () => (_date),
  _default: () => (_default),
  _discriminatedUnion: () => (_discriminatedUnion),
  _e164: () => (_e164),
  _email: () => (_email),
  _emoji: () => (_emoji),
  _endsWith: () => (_endsWith),
  _enum: () => (_enum),
  _file: () => (_file),
  _float32: () => (_float32),
  _float64: () => (_float64),
  _gt: () => (_gt),
  _gte: () => (_gte),
  _guid: () => (_guid),
  _includes: () => (_includes),
  _int: () => (_int),
  _int32: () => (_int32),
  _int64: () => (_int64),
  _intersection: () => (_intersection),
  _ipv4: () => (_ipv4),
  _ipv6: () => (_ipv6),
  _isoDate: () => (_isoDate),
  _isoDateTime: () => (_isoDateTime),
  _isoDuration: () => (_isoDuration),
  _isoTime: () => (_isoTime),
  _jwt: () => (_jwt),
  _ksuid: () => (_ksuid),
  _lazy: () => (_lazy),
  _length: () => (_length),
  _literal: () => (_literal),
  _lowercase: () => (_lowercase),
  _lt: () => (_lt),
  _lte: () => (_lte),
  _mac: () => (_mac),
  _map: () => (_map),
  _max: () => (_lte),
  _maxLength: () => (_maxLength),
  _maxSize: () => (_maxSize),
  _mime: () => (_mime),
  _min: () => (_gte),
  _minLength: () => (_minLength),
  _minSize: () => (_minSize),
  _multipleOf: () => (_multipleOf),
  _nan: () => (_nan),
  _nanoid: () => (_nanoid),
  _nativeEnum: () => (_nativeEnum),
  _negative: () => (_negative),
  _never: () => (_never),
  _nonnegative: () => (_nonnegative),
  _nonoptional: () => (_nonoptional),
  _nonpositive: () => (_nonpositive),
  _normalize: () => (_normalize),
  _null: () => (_null),
  _nullable: () => (_nullable),
  _number: () => (_number),
  _optional: () => (_optional),
  _overwrite: () => (_overwrite),
  _pipe: () => (_pipe),
  _positive: () => (_positive),
  _promise: () => (_promise),
  _property: () => (_property),
  _readonly: () => (_readonly),
  _record: () => (_record),
  _refine: () => (_refine),
  _regex: () => (_regex),
  _set: () => (_set),
  _size: () => (_size),
  _slugify: () => (_slugify),
  _startsWith: () => (_startsWith),
  _string: () => (_string),
  _stringFormat: () => (_stringFormat),
  _stringbool: () => (_stringbool),
  _success: () => (_success),
  _superRefine: () => (_superRefine),
  _symbol: () => (_symbol),
  _templateLiteral: () => (_templateLiteral),
  _toLowerCase: () => (_toLowerCase),
  _toUpperCase: () => (_toUpperCase),
  _transform: () => (_transform),
  _trim: () => (_trim),
  _tuple: () => (_tuple),
  _uint32: () => (_uint32),
  _uint64: () => (_uint64),
  _ulid: () => (_ulid),
  _undefined: () => (_undefined),
  _union: () => (_union),
  _unknown: () => (_unknown),
  _uppercase: () => (_uppercase),
  _url: () => (_url),
  _uuid: () => (_uuid),
  _uuidv4: () => (_uuidv4),
  _uuidv6: () => (_uuidv6),
  _uuidv7: () => (_uuidv7),
  _void: () => (_void),
  _xid: () => (_xid),
  _xor: () => (_xor),
  describe: () => (describe),
  meta: () => (meta)
});
/* import */ var _checks_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/checks.js");
/* import */ var _registries_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/registries.js");
/* import */ var _schemas_js__rspack_import_2 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/schemas.js");
/* import */ var _util_js__rspack_import_3 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");




// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
    return new Class({
        type: "string",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _coercedString(Class, params) {
    return new Class({
        type: "string",
        coerce: true,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
    return new Class({
        type: "string",
        format: "email",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
    return new Class({
        type: "string",
        format: "guid",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v4",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v6",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v7",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
    return new Class({
        type: "string",
        format: "url",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
    return new Class({
        type: "string",
        format: "emoji",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
    return new Class({
        type: "string",
        format: "nanoid",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
    return new Class({
        type: "string",
        format: "cuid",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
    return new Class({
        type: "string",
        format: "cuid2",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
    return new Class({
        type: "string",
        format: "ulid",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
    return new Class({
        type: "string",
        format: "xid",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
    return new Class({
        type: "string",
        format: "ksuid",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
    return new Class({
        type: "string",
        format: "ipv4",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
    return new Class({
        type: "string",
        format: "ipv6",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _mac(Class, params) {
    return new Class({
        type: "string",
        format: "mac",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
    return new Class({
        type: "string",
        format: "cidrv4",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
    return new Class({
        type: "string",
        format: "cidrv6",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
    return new Class({
        type: "string",
        format: "base64",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
    return new Class({
        type: "string",
        format: "base64url",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
    return new Class({
        type: "string",
        format: "e164",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
    return new Class({
        type: "string",
        format: "jwt",
        check: "string_format",
        abort: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
const TimePrecision = {
    Any: null,
    Minute: -1,
    Second: 0,
    Millisecond: 3,
    Microsecond: 6,
};
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
    return new Class({
        type: "string",
        format: "datetime",
        check: "string_format",
        offset: false,
        local: false,
        precision: null,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
    return new Class({
        type: "string",
        format: "date",
        check: "string_format",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
    return new Class({
        type: "string",
        format: "time",
        check: "string_format",
        precision: null,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
    return new Class({
        type: "string",
        format: "duration",
        check: "string_format",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
    return new Class({
        type: "number",
        checks: [],
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _coercedNumber(Class, params) {
    return new Class({
        type: "number",
        coerce: true,
        checks: [],
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
    return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "safeint",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _float32(Class, params) {
    return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "float32",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _float64(Class, params) {
    return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "float64",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _int32(Class, params) {
    return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "int32",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uint32(Class, params) {
    return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "uint32",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
    return new Class({
        type: "boolean",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _coercedBoolean(Class, params) {
    return new Class({
        type: "boolean",
        coerce: true,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _bigint(Class, params) {
    return new Class({
        type: "bigint",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _coercedBigint(Class, params) {
    return new Class({
        type: "bigint",
        coerce: true,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _int64(Class, params) {
    return new Class({
        type: "bigint",
        check: "bigint_format",
        abort: false,
        format: "int64",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uint64(Class, params) {
    return new Class({
        type: "bigint",
        check: "bigint_format",
        abort: false,
        format: "uint64",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _symbol(Class, params) {
    return new Class({
        type: "symbol",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _undefined(Class, params) {
    return new Class({
        type: "undefined",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _null(Class, params) {
    return new Class({
        type: "null",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _any(Class) {
    return new Class({
        type: "any",
    });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
    return new Class({
        type: "unknown",
    });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
    return new Class({
        type: "never",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _void(Class, params) {
    return new Class({
        type: "void",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _date(Class, params) {
    return new Class({
        type: "date",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _coercedDate(Class, params) {
    return new Class({
        type: "date",
        coerce: true,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _nan(Class, params) {
    return new Class({
        type: "nan",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
    return new _checks_js__rspack_import_0.$ZodCheckLessThan({
        check: "less_than",
        ..._util_js__rspack_import_3.normalizeParams(params),
        value,
        inclusive: false,
    });
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
    return new _checks_js__rspack_import_0.$ZodCheckLessThan({
        check: "less_than",
        ..._util_js__rspack_import_3.normalizeParams(params),
        value,
        inclusive: true,
    });
}

// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
    return new _checks_js__rspack_import_0.$ZodCheckGreaterThan({
        check: "greater_than",
        ..._util_js__rspack_import_3.normalizeParams(params),
        value,
        inclusive: false,
    });
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
    return new _checks_js__rspack_import_0.$ZodCheckGreaterThan({
        check: "greater_than",
        ..._util_js__rspack_import_3.normalizeParams(params),
        value,
        inclusive: true,
    });
}

// @__NO_SIDE_EFFECTS__
function _positive(params) {
    return _gt(0, params);
}
// negative
// @__NO_SIDE_EFFECTS__
function _negative(params) {
    return _lt(0, params);
}
// nonpositive
// @__NO_SIDE_EFFECTS__
function _nonpositive(params) {
    return _lte(0, params);
}
// nonnegative
// @__NO_SIDE_EFFECTS__
function _nonnegative(params) {
    return _gte(0, params);
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
    return new _checks_js__rspack_import_0.$ZodCheckMultipleOf({
        check: "multiple_of",
        ..._util_js__rspack_import_3.normalizeParams(params),
        value,
    });
}
// @__NO_SIDE_EFFECTS__
function _maxSize(maximum, params) {
    return new _checks_js__rspack_import_0.$ZodCheckMaxSize({
        check: "max_size",
        ..._util_js__rspack_import_3.normalizeParams(params),
        maximum,
    });
}
// @__NO_SIDE_EFFECTS__
function _minSize(minimum, params) {
    return new _checks_js__rspack_import_0.$ZodCheckMinSize({
        check: "min_size",
        ..._util_js__rspack_import_3.normalizeParams(params),
        minimum,
    });
}
// @__NO_SIDE_EFFECTS__
function _size(size, params) {
    return new _checks_js__rspack_import_0.$ZodCheckSizeEquals({
        check: "size_equals",
        ..._util_js__rspack_import_3.normalizeParams(params),
        size,
    });
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
    const ch = new _checks_js__rspack_import_0.$ZodCheckMaxLength({
        check: "max_length",
        ..._util_js__rspack_import_3.normalizeParams(params),
        maximum,
    });
    return ch;
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
    return new _checks_js__rspack_import_0.$ZodCheckMinLength({
        check: "min_length",
        ..._util_js__rspack_import_3.normalizeParams(params),
        minimum,
    });
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
    return new _checks_js__rspack_import_0.$ZodCheckLengthEquals({
        check: "length_equals",
        ..._util_js__rspack_import_3.normalizeParams(params),
        length,
    });
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
    return new _checks_js__rspack_import_0.$ZodCheckRegex({
        check: "string_format",
        format: "regex",
        ..._util_js__rspack_import_3.normalizeParams(params),
        pattern,
    });
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
    return new _checks_js__rspack_import_0.$ZodCheckLowerCase({
        check: "string_format",
        format: "lowercase",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
    return new _checks_js__rspack_import_0.$ZodCheckUpperCase({
        check: "string_format",
        format: "uppercase",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
    return new _checks_js__rspack_import_0.$ZodCheckIncludes({
        check: "string_format",
        format: "includes",
        ..._util_js__rspack_import_3.normalizeParams(params),
        includes,
    });
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
    return new _checks_js__rspack_import_0.$ZodCheckStartsWith({
        check: "string_format",
        format: "starts_with",
        ..._util_js__rspack_import_3.normalizeParams(params),
        prefix,
    });
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
    return new _checks_js__rspack_import_0.$ZodCheckEndsWith({
        check: "string_format",
        format: "ends_with",
        ..._util_js__rspack_import_3.normalizeParams(params),
        suffix,
    });
}
// @__NO_SIDE_EFFECTS__
function _property(property, schema, params) {
    return new _checks_js__rspack_import_0.$ZodCheckProperty({
        check: "property",
        property,
        schema,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _mime(types, params) {
    return new _checks_js__rspack_import_0.$ZodCheckMimeType({
        check: "mime_type",
        mime: types,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
    return new _checks_js__rspack_import_0.$ZodCheckOverwrite({
        check: "overwrite",
        tx,
    });
}
// normalize
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
    return _overwrite((input) => input.normalize(form));
}
// trim
// @__NO_SIDE_EFFECTS__
function _trim() {
    return _overwrite((input) => input.trim());
}
// toLowerCase
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
    return _overwrite((input) => input.toLowerCase());
}
// toUpperCase
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
    return _overwrite((input) => input.toUpperCase());
}
// slugify
// @__NO_SIDE_EFFECTS__
function _slugify() {
    return _overwrite((input) => _util_js__rspack_import_3.slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
    return new Class({
        type: "array",
        element,
        // get element() {
        //   return element;
        // },
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _union(Class, options, params) {
    return new Class({
        type: "union",
        options,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
function _xor(Class, options, params) {
    return new Class({
        type: "union",
        options,
        inclusive: false,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _discriminatedUnion(Class, discriminator, options, params) {
    return new Class({
        type: "union",
        options,
        discriminator,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _intersection(Class, left, right) {
    return new Class({
        type: "intersection",
        left,
        right,
    });
}
// export function _tuple(
//   Class: util.SchemaClass<schemas.$ZodTuple>,
//   items: [],
//   params?: string | $ZodTupleParams
// ): schemas.$ZodTuple<[], null>;
// @__NO_SIDE_EFFECTS__
function _tuple(Class, items, _paramsOrRest, _params) {
    const hasRest = _paramsOrRest instanceof _schemas_js__rspack_import_2.$ZodType;
    const params = hasRest ? _params : _paramsOrRest;
    const rest = hasRest ? _paramsOrRest : null;
    return new Class({
        type: "tuple",
        items,
        rest,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _record(Class, keyType, valueType, params) {
    return new Class({
        type: "record",
        keyType,
        valueType,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _map(Class, keyType, valueType, params) {
    return new Class({
        type: "map",
        keyType,
        valueType,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _set(Class, valueType, params) {
    return new Class({
        type: "set",
        valueType,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _enum(Class, values, params) {
    const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
    // if (Array.isArray(values)) {
    //   for (const value of values) {
    //     entries[value] = value;
    //   }
    // } else {
    //   Object.assign(entries, values);
    // }
    // const entries: util.EnumLike = {};
    // for (const val of values) {
    //   entries[val] = val;
    // }
    return new Class({
        type: "enum",
        entries,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
/** @deprecated This API has been merged into `z.enum()`. Use `z.enum()` instead.
 *
 * ```ts
 * enum Colors { red, green, blue }
 * z.enum(Colors);
 * ```
 */
function _nativeEnum(Class, entries, params) {
    return new Class({
        type: "enum",
        entries,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _literal(Class, value, params) {
    return new Class({
        type: "literal",
        values: Array.isArray(value) ? value : [value],
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _file(Class, params) {
    return new Class({
        type: "file",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _transform(Class, fn) {
    return new Class({
        type: "transform",
        transform: fn,
    });
}
// @__NO_SIDE_EFFECTS__
function _optional(Class, innerType) {
    return new Class({
        type: "optional",
        innerType,
    });
}
// @__NO_SIDE_EFFECTS__
function _nullable(Class, innerType) {
    return new Class({
        type: "nullable",
        innerType,
    });
}
// @__NO_SIDE_EFFECTS__
function _default(Class, innerType, defaultValue) {
    return new Class({
        type: "default",
        innerType,
        get defaultValue() {
            return typeof defaultValue === "function" ? defaultValue() : _util_js__rspack_import_3.shallowClone(defaultValue);
        },
    });
}
// @__NO_SIDE_EFFECTS__
function _nonoptional(Class, innerType, params) {
    return new Class({
        type: "nonoptional",
        innerType,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _success(Class, innerType) {
    return new Class({
        type: "success",
        innerType,
    });
}
// @__NO_SIDE_EFFECTS__
function _catch(Class, innerType, catchValue) {
    return new Class({
        type: "catch",
        innerType,
        catchValue: (typeof catchValue === "function" ? catchValue : () => catchValue),
    });
}
// @__NO_SIDE_EFFECTS__
function _pipe(Class, in_, out) {
    return new Class({
        type: "pipe",
        in: in_,
        out,
    });
}
// @__NO_SIDE_EFFECTS__
function _readonly(Class, innerType) {
    return new Class({
        type: "readonly",
        innerType,
    });
}
// @__NO_SIDE_EFFECTS__
function _templateLiteral(Class, parts, params) {
    return new Class({
        type: "template_literal",
        parts,
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
}
// @__NO_SIDE_EFFECTS__
function _lazy(Class, getter) {
    return new Class({
        type: "lazy",
        getter,
    });
}
// @__NO_SIDE_EFFECTS__
function _promise(Class, innerType) {
    return new Class({
        type: "promise",
        innerType,
    });
}
// @__NO_SIDE_EFFECTS__
function _custom(Class, fn, _params) {
    const norm = _util_js__rspack_import_3.normalizeParams(_params);
    norm.abort ?? (norm.abort = true); // default to abort:false
    const schema = new Class({
        type: "custom",
        check: "custom",
        fn: fn,
        ...norm,
    });
    return schema;
}
// same as _custom but defaults to abort:false
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
    const schema = new Class({
        type: "custom",
        check: "custom",
        fn: fn,
        ..._util_js__rspack_import_3.normalizeParams(_params),
    });
    return schema;
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn) {
    const ch = _check((payload) => {
        payload.addIssue = (issue) => {
            if (typeof issue === "string") {
                payload.issues.push(_util_js__rspack_import_3.issue(issue, payload.value, ch._zod.def));
            }
            else {
                // for Zod 3 backwards compatibility
                const _issue = issue;
                if (_issue.fatal)
                    _issue.continue = false;
                _issue.code ?? (_issue.code = "custom");
                _issue.input ?? (_issue.input = payload.value);
                _issue.inst ?? (_issue.inst = ch);
                _issue.continue ?? (_issue.continue = !ch._zod.def.abort); // abort is always undefined, so this is always true...
                payload.issues.push(_util_js__rspack_import_3.issue(_issue));
            }
        };
        return fn(payload.value, payload);
    });
    return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
    const ch = new _checks_js__rspack_import_0.$ZodCheck({
        check: "custom",
        ..._util_js__rspack_import_3.normalizeParams(params),
    });
    ch._zod.check = fn;
    return ch;
}
// @__NO_SIDE_EFFECTS__
function describe(description) {
    const ch = new _checks_js__rspack_import_0.$ZodCheck({ check: "describe" });
    ch._zod.onattach = [
        (inst) => {
            const existing = _registries_js__rspack_import_1.globalRegistry.get(inst) ?? {};
            _registries_js__rspack_import_1.globalRegistry.add(inst, { ...existing, description });
        },
    ];
    ch._zod.check = () => { }; // no-op check
    return ch;
}
// @__NO_SIDE_EFFECTS__
function meta(metadata) {
    const ch = new _checks_js__rspack_import_0.$ZodCheck({ check: "meta" });
    ch._zod.onattach = [
        (inst) => {
            const existing = _registries_js__rspack_import_1.globalRegistry.get(inst) ?? {};
            _registries_js__rspack_import_1.globalRegistry.add(inst, { ...existing, ...metadata });
        },
    ];
    ch._zod.check = () => { }; // no-op check
    return ch;
}
// @__NO_SIDE_EFFECTS__
function _stringbool(Classes, _params) {
    const params = _util_js__rspack_import_3.normalizeParams(_params);
    let truthyArray = params.truthy ?? ["true", "1", "yes", "on", "y", "enabled"];
    let falsyArray = params.falsy ?? ["false", "0", "no", "off", "n", "disabled"];
    if (params.case !== "sensitive") {
        truthyArray = truthyArray.map((v) => (typeof v === "string" ? v.toLowerCase() : v));
        falsyArray = falsyArray.map((v) => (typeof v === "string" ? v.toLowerCase() : v));
    }
    const truthySet = new Set(truthyArray);
    const falsySet = new Set(falsyArray);
    const _Codec = Classes.Codec ?? _schemas_js__rspack_import_2.$ZodCodec;
    const _Boolean = Classes.Boolean ?? _schemas_js__rspack_import_2.$ZodBoolean;
    const _String = Classes.String ?? _schemas_js__rspack_import_2.$ZodString;
    const stringSchema = new _String({ type: "string", error: params.error });
    const booleanSchema = new _Boolean({ type: "boolean", error: params.error });
    const codec = new _Codec({
        type: "pipe",
        in: stringSchema,
        out: booleanSchema,
        transform: ((input, payload) => {
            let data = input;
            if (params.case !== "sensitive")
                data = data.toLowerCase();
            if (truthySet.has(data)) {
                return true;
            }
            else if (falsySet.has(data)) {
                return false;
            }
            else {
                payload.issues.push({
                    code: "invalid_value",
                    expected: "stringbool",
                    values: [...truthySet, ...falsySet],
                    input: payload.value,
                    inst: codec,
                    continue: false,
                });
                return {};
            }
        }),
        reverseTransform: ((input, _payload) => {
            if (input === true) {
                return truthyArray[0] || "true";
            }
            else {
                return falsyArray[0] || "false";
            }
        }),
        error: params.error,
    });
    return codec;
}
// @__NO_SIDE_EFFECTS__
function _stringFormat(Class, format, fnOrRegex, _params = {}) {
    const params = _util_js__rspack_import_3.normalizeParams(_params);
    const def = {
        ..._util_js__rspack_import_3.normalizeParams(_params),
        check: "string_format",
        type: "string",
        format,
        fn: typeof fnOrRegex === "function" ? fnOrRegex : (val) => fnOrRegex.test(val),
        ...params,
    };
    if (fnOrRegex instanceof RegExp) {
        def.pattern = fnOrRegex;
    }
    const inst = new Class(def);
    return inst;
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/checks.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  $ZodCheck: () => ($ZodCheck),
  $ZodCheckBigIntFormat: () => ($ZodCheckBigIntFormat),
  $ZodCheckEndsWith: () => ($ZodCheckEndsWith),
  $ZodCheckGreaterThan: () => ($ZodCheckGreaterThan),
  $ZodCheckIncludes: () => ($ZodCheckIncludes),
  $ZodCheckLengthEquals: () => ($ZodCheckLengthEquals),
  $ZodCheckLessThan: () => ($ZodCheckLessThan),
  $ZodCheckLowerCase: () => ($ZodCheckLowerCase),
  $ZodCheckMaxLength: () => ($ZodCheckMaxLength),
  $ZodCheckMaxSize: () => ($ZodCheckMaxSize),
  $ZodCheckMimeType: () => ($ZodCheckMimeType),
  $ZodCheckMinLength: () => ($ZodCheckMinLength),
  $ZodCheckMinSize: () => ($ZodCheckMinSize),
  $ZodCheckMultipleOf: () => ($ZodCheckMultipleOf),
  $ZodCheckNumberFormat: () => ($ZodCheckNumberFormat),
  $ZodCheckOverwrite: () => ($ZodCheckOverwrite),
  $ZodCheckProperty: () => ($ZodCheckProperty),
  $ZodCheckRegex: () => ($ZodCheckRegex),
  $ZodCheckSizeEquals: () => ($ZodCheckSizeEquals),
  $ZodCheckStartsWith: () => ($ZodCheckStartsWith),
  $ZodCheckStringFormat: () => ($ZodCheckStringFormat),
  $ZodCheckUpperCase: () => ($ZodCheckUpperCase)
});
/* import */ var _core_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/core.js");
/* import */ var _regexes_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/regexes.js");
/* import */ var _util_js__rspack_import_2 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");
// import { $ZodType } from "./schemas.js";



const $ZodCheck = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheck", (inst, def) => {
    var _a;
    inst._zod ?? (inst._zod = {});
    inst._zod.def = def;
    (_a = inst._zod).onattach ?? (_a.onattach = []);
});
const numericOriginMap = {
    number: "number",
    bigint: "bigint",
    object: "date",
};
const $ZodCheckLessThan = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckLessThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
        if (def.value < curr) {
            if (def.inclusive)
                bag.maximum = def.value;
            else
                bag.exclusiveMaximum = def.value;
        }
    });
    inst._zod.check = (payload) => {
        if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
            return;
        }
        payload.issues.push({
            origin,
            code: "too_big",
            maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
            input: payload.value,
            inclusive: def.inclusive,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckGreaterThan = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckGreaterThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
        if (def.value > curr) {
            if (def.inclusive)
                bag.minimum = def.value;
            else
                bag.exclusiveMinimum = def.value;
        }
    });
    inst._zod.check = (payload) => {
        if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
            return;
        }
        payload.issues.push({
            origin,
            code: "too_small",
            minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
            input: payload.value,
            inclusive: def.inclusive,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckMultipleOf = 
/*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckMultipleOf", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.onattach.push((inst) => {
        var _a;
        (_a = inst._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
    });
    inst._zod.check = (payload) => {
        if (typeof payload.value !== typeof def.value)
            throw new Error("Cannot mix number and bigint in multiple_of check.");
        const isMultiple = typeof payload.value === "bigint"
            ? payload.value % def.value === BigInt(0)
            : _util_js__rspack_import_2.floatSafeRemainder(payload.value, def.value) === 0;
        if (isMultiple)
            return;
        payload.issues.push({
            origin: typeof payload.value,
            code: "not_multiple_of",
            divisor: def.value,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckNumberFormat = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckNumberFormat", (inst, def) => {
    $ZodCheck.init(inst, def); // no format checks
    def.format = def.format || "float64";
    const isInt = def.format?.includes("int");
    const origin = isInt ? "int" : "number";
    const [minimum, maximum] = _util_js__rspack_import_2.NUMBER_FORMAT_RANGES[def.format];
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.format = def.format;
        bag.minimum = minimum;
        bag.maximum = maximum;
        if (isInt)
            bag.pattern = _regexes_js__rspack_import_1.integer;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        if (isInt) {
            if (!Number.isInteger(input)) {
                // invalid_format issue
                // payload.issues.push({
                //   expected: def.format,
                //   format: def.format,
                //   code: "invalid_format",
                //   input,
                //   inst,
                // });
                // invalid_type issue
                payload.issues.push({
                    expected: origin,
                    format: def.format,
                    code: "invalid_type",
                    continue: false,
                    input,
                    inst,
                });
                return;
                // not_multiple_of issue
                // payload.issues.push({
                //   code: "not_multiple_of",
                //   origin: "number",
                //   input,
                //   inst,
                //   divisor: 1,
                // });
            }
            if (!Number.isSafeInteger(input)) {
                if (input > 0) {
                    // too_big
                    payload.issues.push({
                        input,
                        code: "too_big",
                        maximum: Number.MAX_SAFE_INTEGER,
                        note: "Integers must be within the safe integer range.",
                        inst,
                        origin,
                        inclusive: true,
                        continue: !def.abort,
                    });
                }
                else {
                    // too_small
                    payload.issues.push({
                        input,
                        code: "too_small",
                        minimum: Number.MIN_SAFE_INTEGER,
                        note: "Integers must be within the safe integer range.",
                        inst,
                        origin,
                        inclusive: true,
                        continue: !def.abort,
                    });
                }
                return;
            }
        }
        if (input < minimum) {
            payload.issues.push({
                origin: "number",
                input,
                code: "too_small",
                minimum,
                inclusive: true,
                inst,
                continue: !def.abort,
            });
        }
        if (input > maximum) {
            payload.issues.push({
                origin: "number",
                input,
                code: "too_big",
                maximum,
                inclusive: true,
                inst,
                continue: !def.abort,
            });
        }
    };
});
const $ZodCheckBigIntFormat = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckBigIntFormat", (inst, def) => {
    $ZodCheck.init(inst, def); // no format checks
    const [minimum, maximum] = _util_js__rspack_import_2.BIGINT_FORMAT_RANGES[def.format];
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.format = def.format;
        bag.minimum = minimum;
        bag.maximum = maximum;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        if (input < minimum) {
            payload.issues.push({
                origin: "bigint",
                input,
                code: "too_small",
                minimum: minimum,
                inclusive: true,
                inst,
                continue: !def.abort,
            });
        }
        if (input > maximum) {
            payload.issues.push({
                origin: "bigint",
                input,
                code: "too_big",
                maximum,
                inclusive: true,
                inst,
                continue: !def.abort,
            });
        }
    };
});
const $ZodCheckMaxSize = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckMaxSize", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !_util_js__rspack_import_2.nullish(val) && val.size !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const curr = (inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY);
        if (def.maximum < curr)
            inst._zod.bag.maximum = def.maximum;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const size = input.size;
        if (size <= def.maximum)
            return;
        payload.issues.push({
            origin: _util_js__rspack_import_2.getSizableOrigin(input),
            code: "too_big",
            maximum: def.maximum,
            inclusive: true,
            input,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckMinSize = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckMinSize", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !_util_js__rspack_import_2.nullish(val) && val.size !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const curr = (inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY);
        if (def.minimum > curr)
            inst._zod.bag.minimum = def.minimum;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const size = input.size;
        if (size >= def.minimum)
            return;
        payload.issues.push({
            origin: _util_js__rspack_import_2.getSizableOrigin(input),
            code: "too_small",
            minimum: def.minimum,
            inclusive: true,
            input,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckSizeEquals = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckSizeEquals", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !_util_js__rspack_import_2.nullish(val) && val.size !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.minimum = def.size;
        bag.maximum = def.size;
        bag.size = def.size;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const size = input.size;
        if (size === def.size)
            return;
        const tooBig = size > def.size;
        payload.issues.push({
            origin: _util_js__rspack_import_2.getSizableOrigin(input),
            ...(tooBig ? { code: "too_big", maximum: def.size } : { code: "too_small", minimum: def.size }),
            inclusive: true,
            exact: true,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckMaxLength = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckMaxLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !_util_js__rspack_import_2.nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const curr = (inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY);
        if (def.maximum < curr)
            inst._zod.bag.maximum = def.maximum;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length <= def.maximum)
            return;
        const origin = _util_js__rspack_import_2.getLengthableOrigin(input);
        payload.issues.push({
            origin,
            code: "too_big",
            maximum: def.maximum,
            inclusive: true,
            input,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckMinLength = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckMinLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !_util_js__rspack_import_2.nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const curr = (inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY);
        if (def.minimum > curr)
            inst._zod.bag.minimum = def.minimum;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length >= def.minimum)
            return;
        const origin = _util_js__rspack_import_2.getLengthableOrigin(input);
        payload.issues.push({
            origin,
            code: "too_small",
            minimum: def.minimum,
            inclusive: true,
            input,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckLengthEquals = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckLengthEquals", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !_util_js__rspack_import_2.nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.minimum = def.length;
        bag.maximum = def.length;
        bag.length = def.length;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length === def.length)
            return;
        const origin = _util_js__rspack_import_2.getLengthableOrigin(input);
        const tooBig = length > def.length;
        payload.issues.push({
            origin,
            ...(tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length }),
            inclusive: true,
            exact: true,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckStringFormat = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckStringFormat", (inst, def) => {
    var _a, _b;
    $ZodCheck.init(inst, def);
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.format = def.format;
        if (def.pattern) {
            bag.patterns ?? (bag.patterns = new Set());
            bag.patterns.add(def.pattern);
        }
    });
    if (def.pattern)
        (_a = inst._zod).check ?? (_a.check = (payload) => {
            def.pattern.lastIndex = 0;
            if (def.pattern.test(payload.value))
                return;
            payload.issues.push({
                origin: "string",
                code: "invalid_format",
                format: def.format,
                input: payload.value,
                ...(def.pattern ? { pattern: def.pattern.toString() } : {}),
                inst,
                continue: !def.abort,
            });
        });
    else
        (_b = inst._zod).check ?? (_b.check = () => { });
});
const $ZodCheckRegex = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckRegex", (inst, def) => {
    $ZodCheckStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        def.pattern.lastIndex = 0;
        if (def.pattern.test(payload.value))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "regex",
            input: payload.value,
            pattern: def.pattern.toString(),
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckLowerCase = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckLowerCase", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_1.lowercase);
    $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckUpperCase", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_1.uppercase);
    $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckIncludes", (inst, def) => {
    $ZodCheck.init(inst, def);
    const escapedRegex = _util_js__rspack_import_2.escapeRegex(def.includes);
    const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
    def.pattern = pattern;
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.patterns ?? (bag.patterns = new Set());
        bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
        if (payload.value.includes(def.includes, def.position))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "includes",
            includes: def.includes,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckStartsWith = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckStartsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`^${_util_js__rspack_import_2.escapeRegex(def.prefix)}.*`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.patterns ?? (bag.patterns = new Set());
        bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
        if (payload.value.startsWith(def.prefix))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "starts_with",
            prefix: def.prefix,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckEndsWith = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckEndsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`.*${_util_js__rspack_import_2.escapeRegex(def.suffix)}$`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.patterns ?? (bag.patterns = new Set());
        bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
        if (payload.value.endsWith(def.suffix))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "ends_with",
            suffix: def.suffix,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
///////////////////////////////////
/////    $ZodCheckProperty    /////
///////////////////////////////////
function handleCheckPropertyResult(result, payload, property) {
    if (result.issues.length) {
        payload.issues.push(..._util_js__rspack_import_2.prefixIssues(property, result.issues));
    }
}
const $ZodCheckProperty = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckProperty", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.check = (payload) => {
        const result = def.schema._zod.run({
            value: payload.value[def.property],
            issues: [],
        }, {});
        if (result instanceof Promise) {
            return result.then((result) => handleCheckPropertyResult(result, payload, def.property));
        }
        handleCheckPropertyResult(result, payload, def.property);
        return;
    };
});
const $ZodCheckMimeType = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckMimeType", (inst, def) => {
    $ZodCheck.init(inst, def);
    const mimeSet = new Set(def.mime);
    inst._zod.onattach.push((inst) => {
        inst._zod.bag.mime = def.mime;
    });
    inst._zod.check = (payload) => {
        if (mimeSet.has(payload.value.type))
            return;
        payload.issues.push({
            code: "invalid_value",
            values: def.mime,
            input: payload.value.type,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckOverwrite = /*@__PURE__*/ _core_js__rspack_import_0.$constructor("$ZodCheckOverwrite", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.check = (payload) => {
        payload.value = def.tx(payload.value);
    };
});


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/core.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  $ZodAsyncError: () => ($ZodAsyncError),
  $ZodEncodeError: () => ($ZodEncodeError),
  $brand: () => ($brand),
  $constructor: () => ($constructor),
  NEVER: () => (NEVER),
  config: () => (config),
  globalConfig: () => (globalConfig)
});
/** A special constant with type `never` */
const NEVER = Object.freeze({
    status: "aborted",
});
function $constructor(name, initializer, params) {
    function init(inst, def) {
        if (!inst._zod) {
            Object.defineProperty(inst, "_zod", {
                value: {
                    def,
                    constr: _,
                    traits: new Set(),
                },
                enumerable: false,
            });
        }
        if (inst._zod.traits.has(name)) {
            return;
        }
        inst._zod.traits.add(name);
        initializer(inst, def);
        // support prototype modifications
        const proto = _.prototype;
        const keys = Object.keys(proto);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (!(k in inst)) {
                inst[k] = proto[k].bind(inst);
            }
        }
    }
    // doesn't work if Parent has a constructor with arguments
    const Parent = params?.Parent ?? Object;
    class Definition extends Parent {
    }
    Object.defineProperty(Definition, "name", { value: name });
    function _(def) {
        var _a;
        const inst = params?.Parent ? new Definition() : this;
        init(inst, def);
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        for (const fn of inst._zod.deferred) {
            fn();
        }
        return inst;
    }
    Object.defineProperty(_, "init", { value: init });
    Object.defineProperty(_, Symbol.hasInstance, {
        value: (inst) => {
            if (params?.Parent && inst instanceof params.Parent)
                return true;
            return inst?._zod?.traits?.has(name);
        },
    });
    Object.defineProperty(_, "name", { value: name });
    return _;
}
//////////////////////////////   UTILITIES   ///////////////////////////////////////
const $brand = Symbol("zod_brand");
class $ZodAsyncError extends Error {
    constructor() {
        super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
    }
}
class $ZodEncodeError extends Error {
    constructor(name) {
        super(`Encountered unidirectional transform during encode: ${name}`);
        this.name = "ZodEncodeError";
    }
}
const globalConfig = {};
function config(newConfig) {
    if (newConfig)
        Object.assign(globalConfig, newConfig);
    return globalConfig;
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/doc.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  Doc: () => (Doc)
});
class Doc {
    constructor(args = []) {
        this.content = [];
        this.indent = 0;
        if (this)
            this.args = args;
    }
    indented(fn) {
        this.indent += 1;
        fn(this);
        this.indent -= 1;
    }
    write(arg) {
        if (typeof arg === "function") {
            arg(this, { execution: "sync" });
            arg(this, { execution: "async" });
            return;
        }
        const content = arg;
        const lines = content.split("\n").filter((x) => x);
        const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
        const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
        for (const line of dedented) {
            this.content.push(line);
        }
    }
    compile() {
        const F = Function;
        const args = this?.args;
        const content = this?.content ?? [``];
        const lines = [...content.map((x) => `  ${x}`)];
        // console.log(lines.join("\n"));
        return new F(...args, lines.join("\n"));
    }
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/errors.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  $ZodError: () => ($ZodError),
  $ZodRealError: () => ($ZodRealError),
  flattenError: () => (flattenError),
  formatError: () => (formatError),
  prettifyError: () => (prettifyError),
  toDotPath: () => (toDotPath),
  treeifyError: () => (treeifyError)
});
/* import */ var _core_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/core.js");
/* import */ var _util_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");


const initializer = (inst, def) => {
    inst.name = "$ZodError";
    Object.defineProperty(inst, "_zod", {
        value: inst._zod,
        enumerable: false,
    });
    Object.defineProperty(inst, "issues", {
        value: def,
        enumerable: false,
    });
    inst.message = JSON.stringify(def, _util_js__rspack_import_1.jsonStringifyReplacer, 2);
    Object.defineProperty(inst, "toString", {
        value: () => inst.message,
        enumerable: false,
    });
};
const $ZodError = (0,_core_js__rspack_import_0.$constructor)("$ZodError", initializer);
const $ZodRealError = (0,_core_js__rspack_import_0.$constructor)("$ZodError", initializer, { Parent: Error });
function flattenError(error, mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of error.issues) {
        if (sub.path.length > 0) {
            fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
            fieldErrors[sub.path[0]].push(mapper(sub));
        }
        else {
            formErrors.push(mapper(sub));
        }
    }
    return { formErrors, fieldErrors };
}
function formatError(error, mapper = (issue) => issue.message) {
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
        for (const issue of error.issues) {
            if (issue.code === "invalid_union" && issue.errors.length) {
                issue.errors.map((issues) => processError({ issues }));
            }
            else if (issue.code === "invalid_key") {
                processError({ issues: issue.issues });
            }
            else if (issue.code === "invalid_element") {
                processError({ issues: issue.issues });
            }
            else if (issue.path.length === 0) {
                fieldErrors._errors.push(mapper(issue));
            }
            else {
                let curr = fieldErrors;
                let i = 0;
                while (i < issue.path.length) {
                    const el = issue.path[i];
                    const terminal = i === issue.path.length - 1;
                    if (!terminal) {
                        curr[el] = curr[el] || { _errors: [] };
                    }
                    else {
                        curr[el] = curr[el] || { _errors: [] };
                        curr[el]._errors.push(mapper(issue));
                    }
                    curr = curr[el];
                    i++;
                }
            }
        }
    };
    processError(error);
    return fieldErrors;
}
function treeifyError(error, mapper = (issue) => issue.message) {
    const result = { errors: [] };
    const processError = (error, path = []) => {
        var _a, _b;
        for (const issue of error.issues) {
            if (issue.code === "invalid_union" && issue.errors.length) {
                // regular union error
                issue.errors.map((issues) => processError({ issues }, issue.path));
            }
            else if (issue.code === "invalid_key") {
                processError({ issues: issue.issues }, issue.path);
            }
            else if (issue.code === "invalid_element") {
                processError({ issues: issue.issues }, issue.path);
            }
            else {
                const fullpath = [...path, ...issue.path];
                if (fullpath.length === 0) {
                    result.errors.push(mapper(issue));
                    continue;
                }
                let curr = result;
                let i = 0;
                while (i < fullpath.length) {
                    const el = fullpath[i];
                    const terminal = i === fullpath.length - 1;
                    if (typeof el === "string") {
                        curr.properties ?? (curr.properties = {});
                        (_a = curr.properties)[el] ?? (_a[el] = { errors: [] });
                        curr = curr.properties[el];
                    }
                    else {
                        curr.items ?? (curr.items = []);
                        (_b = curr.items)[el] ?? (_b[el] = { errors: [] });
                        curr = curr.items[el];
                    }
                    if (terminal) {
                        curr.errors.push(mapper(issue));
                    }
                    i++;
                }
            }
        }
    };
    processError(error);
    return result;
}
/** Format a ZodError as a human-readable string in the following form.
 *
 * From
 *
 * ```ts
 * ZodError {
 *   issues: [
 *     {
 *       expected: 'string',
 *       code: 'invalid_type',
 *       path: [ 'username' ],
 *       message: 'Invalid input: expected string'
 *     },
 *     {
 *       expected: 'number',
 *       code: 'invalid_type',
 *       path: [ 'favoriteNumbers', 1 ],
 *       message: 'Invalid input: expected number'
 *     }
 *   ];
 * }
 * ```
 *
 * to
 *
 * ```
 * username
 *   ✖ Expected number, received string at "username
 * favoriteNumbers[0]
 *   ✖ Invalid input: expected number
 * ```
 */
function toDotPath(_path) {
    const segs = [];
    const path = _path.map((seg) => (typeof seg === "object" ? seg.key : seg));
    for (const seg of path) {
        if (typeof seg === "number")
            segs.push(`[${seg}]`);
        else if (typeof seg === "symbol")
            segs.push(`[${JSON.stringify(String(seg))}]`);
        else if (/[^\w$]/.test(seg))
            segs.push(`[${JSON.stringify(seg)}]`);
        else {
            if (segs.length)
                segs.push(".");
            segs.push(seg);
        }
    }
    return segs.join("");
}
function prettifyError(error) {
    const lines = [];
    // sort by path length
    const issues = [...error.issues].sort((a, b) => (a.path ?? []).length - (b.path ?? []).length);
    // Process each issue
    for (const issue of issues) {
        lines.push(`✖ ${issue.message}`);
        if (issue.path?.length)
            lines.push(`  → at ${toDotPath(issue.path)}`);
    }
    // Convert Map to formatted string
    return lines.join("\n");
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/index.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  $ZodAny: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodAny),
  $ZodArray: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodArray),
  $ZodAsyncError: () => (/* reexport safe */ _core_js__rspack_import_0.$ZodAsyncError),
  $ZodBase64: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodBase64),
  $ZodBase64URL: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodBase64URL),
  $ZodBigInt: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodBigInt),
  $ZodBigIntFormat: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodBigIntFormat),
  $ZodBoolean: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodBoolean),
  $ZodCIDRv4: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodCIDRv4),
  $ZodCIDRv6: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodCIDRv6),
  $ZodCUID: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodCUID),
  $ZodCUID2: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodCUID2),
  $ZodCatch: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodCatch),
  $ZodCheck: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheck),
  $ZodCheckBigIntFormat: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckBigIntFormat),
  $ZodCheckEndsWith: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckEndsWith),
  $ZodCheckGreaterThan: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckGreaterThan),
  $ZodCheckIncludes: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckIncludes),
  $ZodCheckLengthEquals: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckLengthEquals),
  $ZodCheckLessThan: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckLessThan),
  $ZodCheckLowerCase: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckLowerCase),
  $ZodCheckMaxLength: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckMaxLength),
  $ZodCheckMaxSize: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckMaxSize),
  $ZodCheckMimeType: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckMimeType),
  $ZodCheckMinLength: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckMinLength),
  $ZodCheckMinSize: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckMinSize),
  $ZodCheckMultipleOf: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckMultipleOf),
  $ZodCheckNumberFormat: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckNumberFormat),
  $ZodCheckOverwrite: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckOverwrite),
  $ZodCheckProperty: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckProperty),
  $ZodCheckRegex: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckRegex),
  $ZodCheckSizeEquals: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckSizeEquals),
  $ZodCheckStartsWith: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckStartsWith),
  $ZodCheckStringFormat: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckStringFormat),
  $ZodCheckUpperCase: () => (/* reexport safe */ _checks_js__rspack_import_4.$ZodCheckUpperCase),
  $ZodCodec: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodCodec),
  $ZodCustom: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodCustom),
  $ZodCustomStringFormat: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodCustomStringFormat),
  $ZodDate: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodDate),
  $ZodDefault: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodDefault),
  $ZodDiscriminatedUnion: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodDiscriminatedUnion),
  $ZodE164: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodE164),
  $ZodEmail: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodEmail),
  $ZodEmoji: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodEmoji),
  $ZodEncodeError: () => (/* reexport safe */ _core_js__rspack_import_0.$ZodEncodeError),
  $ZodEnum: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodEnum),
  $ZodError: () => (/* reexport safe */ _errors_js__rspack_import_2.$ZodError),
  $ZodExactOptional: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodExactOptional),
  $ZodFile: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodFile),
  $ZodFunction: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodFunction),
  $ZodGUID: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodGUID),
  $ZodIPv4: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodIPv4),
  $ZodIPv6: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodIPv6),
  $ZodISODate: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodISODate),
  $ZodISODateTime: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodISODateTime),
  $ZodISODuration: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodISODuration),
  $ZodISOTime: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodISOTime),
  $ZodIntersection: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodIntersection),
  $ZodJWT: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodJWT),
  $ZodKSUID: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodKSUID),
  $ZodLazy: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodLazy),
  $ZodLiteral: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodLiteral),
  $ZodMAC: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodMAC),
  $ZodMap: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodMap),
  $ZodNaN: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodNaN),
  $ZodNanoID: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodNanoID),
  $ZodNever: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodNever),
  $ZodNonOptional: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodNonOptional),
  $ZodNull: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodNull),
  $ZodNullable: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodNullable),
  $ZodNumber: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodNumber),
  $ZodNumberFormat: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodNumberFormat),
  $ZodObject: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodObject),
  $ZodObjectJIT: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodObjectJIT),
  $ZodOptional: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodOptional),
  $ZodPipe: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodPipe),
  $ZodPrefault: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodPrefault),
  $ZodPromise: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodPromise),
  $ZodReadonly: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodReadonly),
  $ZodRealError: () => (/* reexport safe */ _errors_js__rspack_import_2.$ZodRealError),
  $ZodRecord: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodRecord),
  $ZodRegistry: () => (/* reexport safe */ _registries_js__rspack_import_9.$ZodRegistry),
  $ZodSet: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodSet),
  $ZodString: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodString),
  $ZodStringFormat: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodStringFormat),
  $ZodSuccess: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodSuccess),
  $ZodSymbol: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodSymbol),
  $ZodTemplateLiteral: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodTemplateLiteral),
  $ZodTransform: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodTransform),
  $ZodTuple: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodTuple),
  $ZodType: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodType),
  $ZodULID: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodULID),
  $ZodURL: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodURL),
  $ZodUUID: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodUUID),
  $ZodUndefined: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodUndefined),
  $ZodUnion: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodUnion),
  $ZodUnknown: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodUnknown),
  $ZodVoid: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodVoid),
  $ZodXID: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodXID),
  $ZodXor: () => (/* reexport safe */ _schemas_js__rspack_import_3.$ZodXor),
  $brand: () => (/* reexport safe */ _core_js__rspack_import_0.$brand),
  $constructor: () => (/* reexport safe */ _core_js__rspack_import_0.$constructor),
  $input: () => (/* reexport safe */ _registries_js__rspack_import_9.$input),
  $output: () => (/* reexport safe */ _registries_js__rspack_import_9.$output),
  Doc: () => (/* reexport safe */ _doc_js__rspack_import_10.Doc),
  JSONSchema: () => (/* reexport module object */ _json_schema_js__rspack_import_15),
  JSONSchemaGenerator: () => (/* reexport safe */ _json_schema_generator_js__rspack_import_14.JSONSchemaGenerator),
  NEVER: () => (/* reexport safe */ _core_js__rspack_import_0.NEVER),
  TimePrecision: () => (/* reexport safe */ _api_js__rspack_import_11.TimePrecision),
  _any: () => (/* reexport safe */ _api_js__rspack_import_11._any),
  _array: () => (/* reexport safe */ _api_js__rspack_import_11._array),
  _base64: () => (/* reexport safe */ _api_js__rspack_import_11._base64),
  _base64url: () => (/* reexport safe */ _api_js__rspack_import_11._base64url),
  _bigint: () => (/* reexport safe */ _api_js__rspack_import_11._bigint),
  _boolean: () => (/* reexport safe */ _api_js__rspack_import_11._boolean),
  _catch: () => (/* reexport safe */ _api_js__rspack_import_11._catch),
  _check: () => (/* reexport safe */ _api_js__rspack_import_11._check),
  _cidrv4: () => (/* reexport safe */ _api_js__rspack_import_11._cidrv4),
  _cidrv6: () => (/* reexport safe */ _api_js__rspack_import_11._cidrv6),
  _coercedBigint: () => (/* reexport safe */ _api_js__rspack_import_11._coercedBigint),
  _coercedBoolean: () => (/* reexport safe */ _api_js__rspack_import_11._coercedBoolean),
  _coercedDate: () => (/* reexport safe */ _api_js__rspack_import_11._coercedDate),
  _coercedNumber: () => (/* reexport safe */ _api_js__rspack_import_11._coercedNumber),
  _coercedString: () => (/* reexport safe */ _api_js__rspack_import_11._coercedString),
  _cuid: () => (/* reexport safe */ _api_js__rspack_import_11._cuid),
  _cuid2: () => (/* reexport safe */ _api_js__rspack_import_11._cuid2),
  _custom: () => (/* reexport safe */ _api_js__rspack_import_11._custom),
  _date: () => (/* reexport safe */ _api_js__rspack_import_11._date),
  _decode: () => (/* reexport safe */ _parse_js__rspack_import_1._decode),
  _decodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_1._decodeAsync),
  _default: () => (/* reexport safe */ _api_js__rspack_import_11._default),
  _discriminatedUnion: () => (/* reexport safe */ _api_js__rspack_import_11._discriminatedUnion),
  _e164: () => (/* reexport safe */ _api_js__rspack_import_11._e164),
  _email: () => (/* reexport safe */ _api_js__rspack_import_11._email),
  _emoji: () => (/* reexport safe */ _api_js__rspack_import_11._emoji),
  _encode: () => (/* reexport safe */ _parse_js__rspack_import_1._encode),
  _encodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_1._encodeAsync),
  _endsWith: () => (/* reexport safe */ _api_js__rspack_import_11._endsWith),
  _enum: () => (/* reexport safe */ _api_js__rspack_import_11._enum),
  _file: () => (/* reexport safe */ _api_js__rspack_import_11._file),
  _float32: () => (/* reexport safe */ _api_js__rspack_import_11._float32),
  _float64: () => (/* reexport safe */ _api_js__rspack_import_11._float64),
  _gt: () => (/* reexport safe */ _api_js__rspack_import_11._gt),
  _gte: () => (/* reexport safe */ _api_js__rspack_import_11._gte),
  _guid: () => (/* reexport safe */ _api_js__rspack_import_11._guid),
  _includes: () => (/* reexport safe */ _api_js__rspack_import_11._includes),
  _int: () => (/* reexport safe */ _api_js__rspack_import_11._int),
  _int32: () => (/* reexport safe */ _api_js__rspack_import_11._int32),
  _int64: () => (/* reexport safe */ _api_js__rspack_import_11._int64),
  _intersection: () => (/* reexport safe */ _api_js__rspack_import_11._intersection),
  _ipv4: () => (/* reexport safe */ _api_js__rspack_import_11._ipv4),
  _ipv6: () => (/* reexport safe */ _api_js__rspack_import_11._ipv6),
  _isoDate: () => (/* reexport safe */ _api_js__rspack_import_11._isoDate),
  _isoDateTime: () => (/* reexport safe */ _api_js__rspack_import_11._isoDateTime),
  _isoDuration: () => (/* reexport safe */ _api_js__rspack_import_11._isoDuration),
  _isoTime: () => (/* reexport safe */ _api_js__rspack_import_11._isoTime),
  _jwt: () => (/* reexport safe */ _api_js__rspack_import_11._jwt),
  _ksuid: () => (/* reexport safe */ _api_js__rspack_import_11._ksuid),
  _lazy: () => (/* reexport safe */ _api_js__rspack_import_11._lazy),
  _length: () => (/* reexport safe */ _api_js__rspack_import_11._length),
  _literal: () => (/* reexport safe */ _api_js__rspack_import_11._literal),
  _lowercase: () => (/* reexport safe */ _api_js__rspack_import_11._lowercase),
  _lt: () => (/* reexport safe */ _api_js__rspack_import_11._lt),
  _lte: () => (/* reexport safe */ _api_js__rspack_import_11._lte),
  _mac: () => (/* reexport safe */ _api_js__rspack_import_11._mac),
  _map: () => (/* reexport safe */ _api_js__rspack_import_11._map),
  _max: () => (/* reexport safe */ _api_js__rspack_import_11._max),
  _maxLength: () => (/* reexport safe */ _api_js__rspack_import_11._maxLength),
  _maxSize: () => (/* reexport safe */ _api_js__rspack_import_11._maxSize),
  _mime: () => (/* reexport safe */ _api_js__rspack_import_11._mime),
  _min: () => (/* reexport safe */ _api_js__rspack_import_11._min),
  _minLength: () => (/* reexport safe */ _api_js__rspack_import_11._minLength),
  _minSize: () => (/* reexport safe */ _api_js__rspack_import_11._minSize),
  _multipleOf: () => (/* reexport safe */ _api_js__rspack_import_11._multipleOf),
  _nan: () => (/* reexport safe */ _api_js__rspack_import_11._nan),
  _nanoid: () => (/* reexport safe */ _api_js__rspack_import_11._nanoid),
  _nativeEnum: () => (/* reexport safe */ _api_js__rspack_import_11._nativeEnum),
  _negative: () => (/* reexport safe */ _api_js__rspack_import_11._negative),
  _never: () => (/* reexport safe */ _api_js__rspack_import_11._never),
  _nonnegative: () => (/* reexport safe */ _api_js__rspack_import_11._nonnegative),
  _nonoptional: () => (/* reexport safe */ _api_js__rspack_import_11._nonoptional),
  _nonpositive: () => (/* reexport safe */ _api_js__rspack_import_11._nonpositive),
  _normalize: () => (/* reexport safe */ _api_js__rspack_import_11._normalize),
  _null: () => (/* reexport safe */ _api_js__rspack_import_11._null),
  _nullable: () => (/* reexport safe */ _api_js__rspack_import_11._nullable),
  _number: () => (/* reexport safe */ _api_js__rspack_import_11._number),
  _optional: () => (/* reexport safe */ _api_js__rspack_import_11._optional),
  _overwrite: () => (/* reexport safe */ _api_js__rspack_import_11._overwrite),
  _parse: () => (/* reexport safe */ _parse_js__rspack_import_1._parse),
  _parseAsync: () => (/* reexport safe */ _parse_js__rspack_import_1._parseAsync),
  _pipe: () => (/* reexport safe */ _api_js__rspack_import_11._pipe),
  _positive: () => (/* reexport safe */ _api_js__rspack_import_11._positive),
  _promise: () => (/* reexport safe */ _api_js__rspack_import_11._promise),
  _property: () => (/* reexport safe */ _api_js__rspack_import_11._property),
  _readonly: () => (/* reexport safe */ _api_js__rspack_import_11._readonly),
  _record: () => (/* reexport safe */ _api_js__rspack_import_11._record),
  _refine: () => (/* reexport safe */ _api_js__rspack_import_11._refine),
  _regex: () => (/* reexport safe */ _api_js__rspack_import_11._regex),
  _safeDecode: () => (/* reexport safe */ _parse_js__rspack_import_1._safeDecode),
  _safeDecodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_1._safeDecodeAsync),
  _safeEncode: () => (/* reexport safe */ _parse_js__rspack_import_1._safeEncode),
  _safeEncodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_1._safeEncodeAsync),
  _safeParse: () => (/* reexport safe */ _parse_js__rspack_import_1._safeParse),
  _safeParseAsync: () => (/* reexport safe */ _parse_js__rspack_import_1._safeParseAsync),
  _set: () => (/* reexport safe */ _api_js__rspack_import_11._set),
  _size: () => (/* reexport safe */ _api_js__rspack_import_11._size),
  _slugify: () => (/* reexport safe */ _api_js__rspack_import_11._slugify),
  _startsWith: () => (/* reexport safe */ _api_js__rspack_import_11._startsWith),
  _string: () => (/* reexport safe */ _api_js__rspack_import_11._string),
  _stringFormat: () => (/* reexport safe */ _api_js__rspack_import_11._stringFormat),
  _stringbool: () => (/* reexport safe */ _api_js__rspack_import_11._stringbool),
  _success: () => (/* reexport safe */ _api_js__rspack_import_11._success),
  _superRefine: () => (/* reexport safe */ _api_js__rspack_import_11._superRefine),
  _symbol: () => (/* reexport safe */ _api_js__rspack_import_11._symbol),
  _templateLiteral: () => (/* reexport safe */ _api_js__rspack_import_11._templateLiteral),
  _toLowerCase: () => (/* reexport safe */ _api_js__rspack_import_11._toLowerCase),
  _toUpperCase: () => (/* reexport safe */ _api_js__rspack_import_11._toUpperCase),
  _transform: () => (/* reexport safe */ _api_js__rspack_import_11._transform),
  _trim: () => (/* reexport safe */ _api_js__rspack_import_11._trim),
  _tuple: () => (/* reexport safe */ _api_js__rspack_import_11._tuple),
  _uint32: () => (/* reexport safe */ _api_js__rspack_import_11._uint32),
  _uint64: () => (/* reexport safe */ _api_js__rspack_import_11._uint64),
  _ulid: () => (/* reexport safe */ _api_js__rspack_import_11._ulid),
  _undefined: () => (/* reexport safe */ _api_js__rspack_import_11._undefined),
  _union: () => (/* reexport safe */ _api_js__rspack_import_11._union),
  _unknown: () => (/* reexport safe */ _api_js__rspack_import_11._unknown),
  _uppercase: () => (/* reexport safe */ _api_js__rspack_import_11._uppercase),
  _url: () => (/* reexport safe */ _api_js__rspack_import_11._url),
  _uuid: () => (/* reexport safe */ _api_js__rspack_import_11._uuid),
  _uuidv4: () => (/* reexport safe */ _api_js__rspack_import_11._uuidv4),
  _uuidv6: () => (/* reexport safe */ _api_js__rspack_import_11._uuidv6),
  _uuidv7: () => (/* reexport safe */ _api_js__rspack_import_11._uuidv7),
  _void: () => (/* reexport safe */ _api_js__rspack_import_11._void),
  _xid: () => (/* reexport safe */ _api_js__rspack_import_11._xid),
  _xor: () => (/* reexport safe */ _api_js__rspack_import_11._xor),
  clone: () => (/* reexport safe */ _schemas_js__rspack_import_3.clone),
  config: () => (/* reexport safe */ _core_js__rspack_import_0.config),
  createStandardJSONSchemaMethod: () => (/* reexport safe */ _to_json_schema_js__rspack_import_12.createStandardJSONSchemaMethod),
  createToJSONSchemaMethod: () => (/* reexport safe */ _to_json_schema_js__rspack_import_12.createToJSONSchemaMethod),
  decode: () => (/* reexport safe */ _parse_js__rspack_import_1.decode),
  decodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_1.decodeAsync),
  describe: () => (/* reexport safe */ _api_js__rspack_import_11.describe),
  encode: () => (/* reexport safe */ _parse_js__rspack_import_1.encode),
  encodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_1.encodeAsync),
  extractDefs: () => (/* reexport safe */ _to_json_schema_js__rspack_import_12.extractDefs),
  finalize: () => (/* reexport safe */ _to_json_schema_js__rspack_import_12.finalize),
  flattenError: () => (/* reexport safe */ _errors_js__rspack_import_2.flattenError),
  formatError: () => (/* reexport safe */ _errors_js__rspack_import_2.formatError),
  globalConfig: () => (/* reexport safe */ _core_js__rspack_import_0.globalConfig),
  globalRegistry: () => (/* reexport safe */ _registries_js__rspack_import_9.globalRegistry),
  initializeContext: () => (/* reexport safe */ _to_json_schema_js__rspack_import_12.initializeContext),
  isValidBase64: () => (/* reexport safe */ _schemas_js__rspack_import_3.isValidBase64),
  isValidBase64URL: () => (/* reexport safe */ _schemas_js__rspack_import_3.isValidBase64URL),
  isValidJWT: () => (/* reexport safe */ _schemas_js__rspack_import_3.isValidJWT),
  locales: () => (/* reexport module object */ _locales_index_js__rspack_import_8),
  meta: () => (/* reexport safe */ _api_js__rspack_import_11.meta),
  parse: () => (/* reexport safe */ _parse_js__rspack_import_1.parse),
  parseAsync: () => (/* reexport safe */ _parse_js__rspack_import_1.parseAsync),
  prettifyError: () => (/* reexport safe */ _errors_js__rspack_import_2.prettifyError),
  process: () => (/* reexport safe */ _to_json_schema_js__rspack_import_12.process),
  regexes: () => (/* reexport module object */ _regexes_js__rspack_import_7),
  registry: () => (/* reexport safe */ _registries_js__rspack_import_9.registry),
  safeDecode: () => (/* reexport safe */ _parse_js__rspack_import_1.safeDecode),
  safeDecodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_1.safeDecodeAsync),
  safeEncode: () => (/* reexport safe */ _parse_js__rspack_import_1.safeEncode),
  safeEncodeAsync: () => (/* reexport safe */ _parse_js__rspack_import_1.safeEncodeAsync),
  safeParse: () => (/* reexport safe */ _parse_js__rspack_import_1.safeParse),
  safeParseAsync: () => (/* reexport safe */ _parse_js__rspack_import_1.safeParseAsync),
  toDotPath: () => (/* reexport safe */ _errors_js__rspack_import_2.toDotPath),
  toJSONSchema: () => (/* reexport safe */ _json_schema_processors_js__rspack_import_13.toJSONSchema),
  treeifyError: () => (/* reexport safe */ _errors_js__rspack_import_2.treeifyError),
  util: () => (/* reexport module object */ _util_js__rspack_import_6),
  version: () => (/* reexport safe */ _versions_js__rspack_import_5.version)
});
/* import */ var _core_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/core.js");
/* import */ var _parse_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/parse.js");
/* import */ var _errors_js__rspack_import_2 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/errors.js");
/* import */ var _schemas_js__rspack_import_3 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/schemas.js");
/* import */ var _checks_js__rspack_import_4 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/checks.js");
/* import */ var _versions_js__rspack_import_5 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/versions.js");
/* import */ var _util_js__rspack_import_6 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");
/* import */ var _regexes_js__rspack_import_7 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/regexes.js");
/* import */ var _locales_index_js__rspack_import_8 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/index.js");
/* import */ var _registries_js__rspack_import_9 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/registries.js");
/* import */ var _doc_js__rspack_import_10 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/doc.js");
/* import */ var _api_js__rspack_import_11 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/api.js");
/* import */ var _to_json_schema_js__rspack_import_12 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/to-json-schema.js");
/* import */ var _json_schema_processors_js__rspack_import_13 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/json-schema-processors.js");
/* import */ var _json_schema_generator_js__rspack_import_14 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/json-schema-generator.js");
/* import */ var _json_schema_js__rspack_import_15 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/json-schema.js");


















},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/json-schema-generator.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  JSONSchemaGenerator: () => (JSONSchemaGenerator)
});
/* import */ var _json_schema_processors_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/json-schema-processors.js");
/* import */ var _to_json_schema_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/to-json-schema.js");


/**
 * Legacy class-based interface for JSON Schema generation.
 * This class wraps the new functional implementation to provide backward compatibility.
 *
 * @deprecated Use the `toJSONSchema` function instead for new code.
 *
 * @example
 * ```typescript
 * // Legacy usage (still supported)
 * const gen = new JSONSchemaGenerator({ target: "draft-07" });
 * gen.process(schema);
 * const result = gen.emit(schema);
 *
 * // Preferred modern usage
 * const result = toJSONSchema(schema, { target: "draft-07" });
 * ```
 */
class JSONSchemaGenerator {
    /** @deprecated Access via ctx instead */
    get metadataRegistry() {
        return this.ctx.metadataRegistry;
    }
    /** @deprecated Access via ctx instead */
    get target() {
        return this.ctx.target;
    }
    /** @deprecated Access via ctx instead */
    get unrepresentable() {
        return this.ctx.unrepresentable;
    }
    /** @deprecated Access via ctx instead */
    get override() {
        return this.ctx.override;
    }
    /** @deprecated Access via ctx instead */
    get io() {
        return this.ctx.io;
    }
    /** @deprecated Access via ctx instead */
    get counter() {
        return this.ctx.counter;
    }
    set counter(value) {
        this.ctx.counter = value;
    }
    /** @deprecated Access via ctx instead */
    get seen() {
        return this.ctx.seen;
    }
    constructor(params) {
        // Normalize target for internal context
        let normalizedTarget = params?.target ?? "draft-2020-12";
        if (normalizedTarget === "draft-4")
            normalizedTarget = "draft-04";
        if (normalizedTarget === "draft-7")
            normalizedTarget = "draft-07";
        this.ctx = (0,_to_json_schema_js__rspack_import_1.initializeContext)({
            processors: _json_schema_processors_js__rspack_import_0.allProcessors,
            target: normalizedTarget,
            ...(params?.metadata && { metadata: params.metadata }),
            ...(params?.unrepresentable && { unrepresentable: params.unrepresentable }),
            ...(params?.override && { override: params.override }),
            ...(params?.io && { io: params.io }),
        });
    }
    /**
     * Process a schema to prepare it for JSON Schema generation.
     * This must be called before emit().
     */
    process(schema, _params = { path: [], schemaPath: [] }) {
        return (0,_to_json_schema_js__rspack_import_1.process)(schema, this.ctx, _params);
    }
    /**
     * Emit the final JSON Schema after processing.
     * Must call process() first.
     */
    emit(schema, _params) {
        // Apply emit params to the context
        if (_params) {
            if (_params.cycles)
                this.ctx.cycles = _params.cycles;
            if (_params.reused)
                this.ctx.reused = _params.reused;
            if (_params.external)
                this.ctx.external = _params.external;
        }
        (0,_to_json_schema_js__rspack_import_1.extractDefs)(this.ctx, schema);
        const result = (0,_to_json_schema_js__rspack_import_1.finalize)(this.ctx, schema);
        // Strip ~standard property to match old implementation's return type
        const { "~standard": _, ...plainResult } = result;
        return plainResult;
    }
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/json-schema-processors.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  allProcessors: () => (allProcessors),
  anyProcessor: () => (anyProcessor),
  arrayProcessor: () => (arrayProcessor),
  bigintProcessor: () => (bigintProcessor),
  booleanProcessor: () => (booleanProcessor),
  catchProcessor: () => (catchProcessor),
  customProcessor: () => (customProcessor),
  dateProcessor: () => (dateProcessor),
  defaultProcessor: () => (defaultProcessor),
  enumProcessor: () => (enumProcessor),
  fileProcessor: () => (fileProcessor),
  functionProcessor: () => (functionProcessor),
  intersectionProcessor: () => (intersectionProcessor),
  lazyProcessor: () => (lazyProcessor),
  literalProcessor: () => (literalProcessor),
  mapProcessor: () => (mapProcessor),
  nanProcessor: () => (nanProcessor),
  neverProcessor: () => (neverProcessor),
  nonoptionalProcessor: () => (nonoptionalProcessor),
  nullProcessor: () => (nullProcessor),
  nullableProcessor: () => (nullableProcessor),
  numberProcessor: () => (numberProcessor),
  objectProcessor: () => (objectProcessor),
  optionalProcessor: () => (optionalProcessor),
  pipeProcessor: () => (pipeProcessor),
  prefaultProcessor: () => (prefaultProcessor),
  promiseProcessor: () => (promiseProcessor),
  readonlyProcessor: () => (readonlyProcessor),
  recordProcessor: () => (recordProcessor),
  setProcessor: () => (setProcessor),
  stringProcessor: () => (stringProcessor),
  successProcessor: () => (successProcessor),
  symbolProcessor: () => (symbolProcessor),
  templateLiteralProcessor: () => (templateLiteralProcessor),
  toJSONSchema: () => (toJSONSchema),
  transformProcessor: () => (transformProcessor),
  tupleProcessor: () => (tupleProcessor),
  undefinedProcessor: () => (undefinedProcessor),
  unionProcessor: () => (unionProcessor),
  unknownProcessor: () => (unknownProcessor),
  voidProcessor: () => (voidProcessor)
});
/* import */ var _to_json_schema_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/to-json-schema.js");
/* import */ var _util_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");


const formatMap = {
    guid: "uuid",
    url: "uri",
    datetime: "date-time",
    json_string: "json-string",
    regex: "", // do not set
};
// ==================== SIMPLE TYPE PROCESSORS ====================
const stringProcessor = (schema, ctx, _json, _params) => {
    const json = _json;
    json.type = "string";
    const { minimum, maximum, format, patterns, contentEncoding } = schema._zod
        .bag;
    if (typeof minimum === "number")
        json.minLength = minimum;
    if (typeof maximum === "number")
        json.maxLength = maximum;
    // custom pattern overrides format
    if (format) {
        json.format = formatMap[format] ?? format;
        if (json.format === "")
            delete json.format; // empty format is not valid
        // JSON Schema format: "time" requires a full time with offset or Z
        // z.iso.time() does not include timezone information, so format: "time" should never be used
        if (format === "time") {
            delete json.format;
        }
    }
    if (contentEncoding)
        json.contentEncoding = contentEncoding;
    if (patterns && patterns.size > 0) {
        const regexes = [...patterns];
        if (regexes.length === 1)
            json.pattern = regexes[0].source;
        else if (regexes.length > 1) {
            json.allOf = [
                ...regexes.map((regex) => ({
                    ...(ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0"
                        ? { type: "string" }
                        : {}),
                    pattern: regex.source,
                })),
            ];
        }
    }
};
const numberProcessor = (schema, ctx, _json, _params) => {
    const json = _json;
    const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
    if (typeof format === "string" && format.includes("int"))
        json.type = "integer";
    else
        json.type = "number";
    if (typeof exclusiveMinimum === "number") {
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
            json.minimum = exclusiveMinimum;
            json.exclusiveMinimum = true;
        }
        else {
            json.exclusiveMinimum = exclusiveMinimum;
        }
    }
    if (typeof minimum === "number") {
        json.minimum = minimum;
        if (typeof exclusiveMinimum === "number" && ctx.target !== "draft-04") {
            if (exclusiveMinimum >= minimum)
                delete json.minimum;
            else
                delete json.exclusiveMinimum;
        }
    }
    if (typeof exclusiveMaximum === "number") {
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
            json.maximum = exclusiveMaximum;
            json.exclusiveMaximum = true;
        }
        else {
            json.exclusiveMaximum = exclusiveMaximum;
        }
    }
    if (typeof maximum === "number") {
        json.maximum = maximum;
        if (typeof exclusiveMaximum === "number" && ctx.target !== "draft-04") {
            if (exclusiveMaximum <= maximum)
                delete json.maximum;
            else
                delete json.exclusiveMaximum;
        }
    }
    if (typeof multipleOf === "number")
        json.multipleOf = multipleOf;
};
const booleanProcessor = (_schema, _ctx, json, _params) => {
    json.type = "boolean";
};
const bigintProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("BigInt cannot be represented in JSON Schema");
    }
};
const symbolProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Symbols cannot be represented in JSON Schema");
    }
};
const nullProcessor = (_schema, ctx, json, _params) => {
    if (ctx.target === "openapi-3.0") {
        json.type = "string";
        json.nullable = true;
        json.enum = [null];
    }
    else {
        json.type = "null";
    }
};
const undefinedProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Undefined cannot be represented in JSON Schema");
    }
};
const voidProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Void cannot be represented in JSON Schema");
    }
};
const neverProcessor = (_schema, _ctx, json, _params) => {
    json.not = {};
};
const anyProcessor = (_schema, _ctx, _json, _params) => {
    // empty schema accepts anything
};
const unknownProcessor = (_schema, _ctx, _json, _params) => {
    // empty schema accepts anything
};
const dateProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Date cannot be represented in JSON Schema");
    }
};
const enumProcessor = (schema, _ctx, json, _params) => {
    const def = schema._zod.def;
    const values = (0,_util_js__rspack_import_1.getEnumValues)(def.entries);
    // Number enums can have both string and number values
    if (values.every((v) => typeof v === "number"))
        json.type = "number";
    if (values.every((v) => typeof v === "string"))
        json.type = "string";
    json.enum = values;
};
const literalProcessor = (schema, ctx, json, _params) => {
    const def = schema._zod.def;
    const vals = [];
    for (const val of def.values) {
        if (val === undefined) {
            if (ctx.unrepresentable === "throw") {
                throw new Error("Literal `undefined` cannot be represented in JSON Schema");
            }
            else {
                // do not add to vals
            }
        }
        else if (typeof val === "bigint") {
            if (ctx.unrepresentable === "throw") {
                throw new Error("BigInt literals cannot be represented in JSON Schema");
            }
            else {
                vals.push(Number(val));
            }
        }
        else {
            vals.push(val);
        }
    }
    if (vals.length === 0) {
        // do nothing (an undefined literal was stripped)
    }
    else if (vals.length === 1) {
        const val = vals[0];
        json.type = val === null ? "null" : typeof val;
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
            json.enum = [val];
        }
        else {
            json.const = val;
        }
    }
    else {
        if (vals.every((v) => typeof v === "number"))
            json.type = "number";
        if (vals.every((v) => typeof v === "string"))
            json.type = "string";
        if (vals.every((v) => typeof v === "boolean"))
            json.type = "boolean";
        if (vals.every((v) => v === null))
            json.type = "null";
        json.enum = vals;
    }
};
const nanProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("NaN cannot be represented in JSON Schema");
    }
};
const templateLiteralProcessor = (schema, _ctx, json, _params) => {
    const _json = json;
    const pattern = schema._zod.pattern;
    if (!pattern)
        throw new Error("Pattern not found in template literal");
    _json.type = "string";
    _json.pattern = pattern.source;
};
const fileProcessor = (schema, _ctx, json, _params) => {
    const _json = json;
    const file = {
        type: "string",
        format: "binary",
        contentEncoding: "binary",
    };
    const { minimum, maximum, mime } = schema._zod.bag;
    if (minimum !== undefined)
        file.minLength = minimum;
    if (maximum !== undefined)
        file.maxLength = maximum;
    if (mime) {
        if (mime.length === 1) {
            file.contentMediaType = mime[0];
            Object.assign(_json, file);
        }
        else {
            Object.assign(_json, file); // shared props at root
            _json.anyOf = mime.map((m) => ({ contentMediaType: m })); // only contentMediaType differs
        }
    }
    else {
        Object.assign(_json, file);
    }
};
const successProcessor = (_schema, _ctx, json, _params) => {
    json.type = "boolean";
};
const customProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Custom types cannot be represented in JSON Schema");
    }
};
const functionProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Function types cannot be represented in JSON Schema");
    }
};
const transformProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Transforms cannot be represented in JSON Schema");
    }
};
const mapProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Map cannot be represented in JSON Schema");
    }
};
const setProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Set cannot be represented in JSON Schema");
    }
};
// ==================== COMPOSITE TYPE PROCESSORS ====================
const arrayProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    const { minimum, maximum } = schema._zod.bag;
    if (typeof minimum === "number")
        json.minItems = minimum;
    if (typeof maximum === "number")
        json.maxItems = maximum;
    json.type = "array";
    json.items = (0,_to_json_schema_js__rspack_import_0.process)(def.element, ctx, { ...params, path: [...params.path, "items"] });
};
const objectProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    json.type = "object";
    json.properties = {};
    const shape = def.shape;
    for (const key in shape) {
        json.properties[key] = (0,_to_json_schema_js__rspack_import_0.process)(shape[key], ctx, {
            ...params,
            path: [...params.path, "properties", key],
        });
    }
    // required keys
    const allKeys = new Set(Object.keys(shape));
    const requiredKeys = new Set([...allKeys].filter((key) => {
        const v = def.shape[key]._zod;
        if (ctx.io === "input") {
            return v.optin === undefined;
        }
        else {
            return v.optout === undefined;
        }
    }));
    if (requiredKeys.size > 0) {
        json.required = Array.from(requiredKeys);
    }
    // catchall
    if (def.catchall?._zod.def.type === "never") {
        // strict
        json.additionalProperties = false;
    }
    else if (!def.catchall) {
        // regular
        if (ctx.io === "output")
            json.additionalProperties = false;
    }
    else if (def.catchall) {
        json.additionalProperties = (0,_to_json_schema_js__rspack_import_0.process)(def.catchall, ctx, {
            ...params,
            path: [...params.path, "additionalProperties"],
        });
    }
};
const unionProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    // Exclusive unions (inclusive === false) use oneOf (exactly one match) instead of anyOf (one or more matches)
    // This includes both z.xor() and discriminated unions
    const isExclusive = def.inclusive === false;
    const options = def.options.map((x, i) => (0,_to_json_schema_js__rspack_import_0.process)(x, ctx, {
        ...params,
        path: [...params.path, isExclusive ? "oneOf" : "anyOf", i],
    }));
    if (isExclusive) {
        json.oneOf = options;
    }
    else {
        json.anyOf = options;
    }
};
const intersectionProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    const a = (0,_to_json_schema_js__rspack_import_0.process)(def.left, ctx, {
        ...params,
        path: [...params.path, "allOf", 0],
    });
    const b = (0,_to_json_schema_js__rspack_import_0.process)(def.right, ctx, {
        ...params,
        path: [...params.path, "allOf", 1],
    });
    const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
    const allOf = [
        ...(isSimpleIntersection(a) ? a.allOf : [a]),
        ...(isSimpleIntersection(b) ? b.allOf : [b]),
    ];
    json.allOf = allOf;
};
const tupleProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    json.type = "array";
    const prefixPath = ctx.target === "draft-2020-12" ? "prefixItems" : "items";
    const restPath = ctx.target === "draft-2020-12" ? "items" : ctx.target === "openapi-3.0" ? "items" : "additionalItems";
    const prefixItems = def.items.map((x, i) => (0,_to_json_schema_js__rspack_import_0.process)(x, ctx, {
        ...params,
        path: [...params.path, prefixPath, i],
    }));
    const rest = def.rest
        ? (0,_to_json_schema_js__rspack_import_0.process)(def.rest, ctx, {
            ...params,
            path: [...params.path, restPath, ...(ctx.target === "openapi-3.0" ? [def.items.length] : [])],
        })
        : null;
    if (ctx.target === "draft-2020-12") {
        json.prefixItems = prefixItems;
        if (rest) {
            json.items = rest;
        }
    }
    else if (ctx.target === "openapi-3.0") {
        json.items = {
            anyOf: prefixItems,
        };
        if (rest) {
            json.items.anyOf.push(rest);
        }
        json.minItems = prefixItems.length;
        if (!rest) {
            json.maxItems = prefixItems.length;
        }
    }
    else {
        json.items = prefixItems;
        if (rest) {
            json.additionalItems = rest;
        }
    }
    // length
    const { minimum, maximum } = schema._zod.bag;
    if (typeof minimum === "number")
        json.minItems = minimum;
    if (typeof maximum === "number")
        json.maxItems = maximum;
};
const recordProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    json.type = "object";
    // For looseRecord with regex patterns, use patternProperties
    // This correctly represents "only validate keys matching the pattern" semantics
    // and composes well with allOf (intersections)
    const keyType = def.keyType;
    const keyBag = keyType._zod.bag;
    const patterns = keyBag?.patterns;
    if (def.mode === "loose" && patterns && patterns.size > 0) {
        // Use patternProperties for looseRecord with regex patterns
        const valueSchema = (0,_to_json_schema_js__rspack_import_0.process)(def.valueType, ctx, {
            ...params,
            path: [...params.path, "patternProperties", "*"],
        });
        json.patternProperties = {};
        for (const pattern of patterns) {
            json.patternProperties[pattern.source] = valueSchema;
        }
    }
    else {
        // Default behavior: use propertyNames + additionalProperties
        if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
            json.propertyNames = (0,_to_json_schema_js__rspack_import_0.process)(def.keyType, ctx, {
                ...params,
                path: [...params.path, "propertyNames"],
            });
        }
        json.additionalProperties = (0,_to_json_schema_js__rspack_import_0.process)(def.valueType, ctx, {
            ...params,
            path: [...params.path, "additionalProperties"],
        });
    }
    // Add required for keys with discrete values (enum, literal, etc.)
    const keyValues = keyType._zod.values;
    if (keyValues) {
        const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
        if (validKeyValues.length > 0) {
            json.required = validKeyValues;
        }
    }
};
const nullableProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    const inner = (0,_to_json_schema_js__rspack_import_0.process)(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    if (ctx.target === "openapi-3.0") {
        seen.ref = def.innerType;
        json.nullable = true;
    }
    else {
        json.anyOf = [inner, { type: "null" }];
    }
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    (0,_to_json_schema_js__rspack_import_0.process)(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
};
const defaultProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    (0,_to_json_schema_js__rspack_import_0.process)(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    json.default = JSON.parse(JSON.stringify(def.defaultValue));
};
const prefaultProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    (0,_to_json_schema_js__rspack_import_0.process)(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    if (ctx.io === "input")
        json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
const catchProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    (0,_to_json_schema_js__rspack_import_0.process)(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    let catchValue;
    try {
        catchValue = def.catchValue(undefined);
    }
    catch {
        throw new Error("Dynamic catch values are not supported in JSON Schema");
    }
    json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    const innerType = ctx.io === "input" ? (def.in._zod.def.type === "transform" ? def.out : def.in) : def.out;
    (0,_to_json_schema_js__rspack_import_0.process)(innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    (0,_to_json_schema_js__rspack_import_0.process)(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    json.readOnly = true;
};
const promiseProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    (0,_to_json_schema_js__rspack_import_0.process)(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
};
const optionalProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    (0,_to_json_schema_js__rspack_import_0.process)(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
};
const lazyProcessor = (schema, ctx, _json, params) => {
    const innerType = schema._zod.innerType;
    (0,_to_json_schema_js__rspack_import_0.process)(innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = innerType;
};
// ==================== ALL PROCESSORS ====================
const allProcessors = {
    string: stringProcessor,
    number: numberProcessor,
    boolean: booleanProcessor,
    bigint: bigintProcessor,
    symbol: symbolProcessor,
    null: nullProcessor,
    undefined: undefinedProcessor,
    void: voidProcessor,
    never: neverProcessor,
    any: anyProcessor,
    unknown: unknownProcessor,
    date: dateProcessor,
    enum: enumProcessor,
    literal: literalProcessor,
    nan: nanProcessor,
    template_literal: templateLiteralProcessor,
    file: fileProcessor,
    success: successProcessor,
    custom: customProcessor,
    function: functionProcessor,
    transform: transformProcessor,
    map: mapProcessor,
    set: setProcessor,
    array: arrayProcessor,
    object: objectProcessor,
    union: unionProcessor,
    intersection: intersectionProcessor,
    tuple: tupleProcessor,
    record: recordProcessor,
    nullable: nullableProcessor,
    nonoptional: nonoptionalProcessor,
    default: defaultProcessor,
    prefault: prefaultProcessor,
    catch: catchProcessor,
    pipe: pipeProcessor,
    readonly: readonlyProcessor,
    promise: promiseProcessor,
    optional: optionalProcessor,
    lazy: lazyProcessor,
};
function toJSONSchema(input, params) {
    if ("_idmap" in input) {
        // Registry case
        const registry = input;
        const ctx = (0,_to_json_schema_js__rspack_import_0.initializeContext)({ ...params, processors: allProcessors });
        const defs = {};
        // First pass: process all schemas to build the seen map
        for (const entry of registry._idmap.entries()) {
            const [_, schema] = entry;
            (0,_to_json_schema_js__rspack_import_0.process)(schema, ctx);
        }
        const schemas = {};
        const external = {
            registry,
            uri: params?.uri,
            defs,
        };
        // Update the context with external configuration
        ctx.external = external;
        // Second pass: emit each schema
        for (const entry of registry._idmap.entries()) {
            const [key, schema] = entry;
            (0,_to_json_schema_js__rspack_import_0.extractDefs)(ctx, schema);
            schemas[key] = (0,_to_json_schema_js__rspack_import_0.finalize)(ctx, schema);
        }
        if (Object.keys(defs).length > 0) {
            const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
            schemas.__shared = {
                [defsSegment]: defs,
            };
        }
        return { schemas };
    }
    // Single schema case
    const ctx = (0,_to_json_schema_js__rspack_import_0.initializeContext)({ ...params, processors: allProcessors });
    (0,_to_json_schema_js__rspack_import_0.process)(input, ctx);
    (0,_to_json_schema_js__rspack_import_0.extractDefs)(ctx, input);
    return (0,_to_json_schema_js__rspack_import_0.finalize)(ctx, input);
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/json-schema.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);



},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/parse.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  _decode: () => (_decode),
  _decodeAsync: () => (_decodeAsync),
  _encode: () => (_encode),
  _encodeAsync: () => (_encodeAsync),
  _parse: () => (_parse),
  _parseAsync: () => (_parseAsync),
  _safeDecode: () => (_safeDecode),
  _safeDecodeAsync: () => (_safeDecodeAsync),
  _safeEncode: () => (_safeEncode),
  _safeEncodeAsync: () => (_safeEncodeAsync),
  _safeParse: () => (_safeParse),
  _safeParseAsync: () => (_safeParseAsync),
  decode: () => (decode),
  decodeAsync: () => (decodeAsync),
  encode: () => (encode),
  encodeAsync: () => (encodeAsync),
  parse: () => (parse),
  parseAsync: () => (parseAsync),
  safeDecode: () => (safeDecode),
  safeDecodeAsync: () => (safeDecodeAsync),
  safeEncode: () => (safeEncode),
  safeEncodeAsync: () => (safeEncodeAsync),
  safeParse: () => (safeParse),
  safeParseAsync: () => (safeParseAsync)
});
/* import */ var _core_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/core.js");
/* import */ var _errors_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/errors.js");
/* import */ var _util_js__rspack_import_2 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");



const _parse = (_Err) => (schema, value, _ctx, _params) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: false }) : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
        throw new _core_js__rspack_import_0.$ZodAsyncError();
    }
    if (result.issues.length) {
        const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => _util_js__rspack_import_2.finalizeIssue(iss, ctx, _core_js__rspack_import_0.config())));
        _util_js__rspack_import_2.captureStackTrace(e, _params?.callee);
        throw e;
    }
    return result.value;
};
const parse = /* @__PURE__*/ _parse(_errors_js__rspack_import_1.$ZodRealError);
const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
        result = await result;
    if (result.issues.length) {
        const e = new (params?.Err ?? _Err)(result.issues.map((iss) => _util_js__rspack_import_2.finalizeIssue(iss, ctx, _core_js__rspack_import_0.config())));
        _util_js__rspack_import_2.captureStackTrace(e, params?.callee);
        throw e;
    }
    return result.value;
};
const parseAsync = /* @__PURE__*/ _parseAsync(_errors_js__rspack_import_1.$ZodRealError);
const _safeParse = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
        throw new _core_js__rspack_import_0.$ZodAsyncError();
    }
    return result.issues.length
        ? {
            success: false,
            error: new (_Err ?? _errors_js__rspack_import_1.$ZodError)(result.issues.map((iss) => _util_js__rspack_import_2.finalizeIssue(iss, ctx, _core_js__rspack_import_0.config()))),
        }
        : { success: true, data: result.value };
};
const safeParse = /* @__PURE__*/ _safeParse(_errors_js__rspack_import_1.$ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
        result = await result;
    return result.issues.length
        ? {
            success: false,
            error: new _Err(result.issues.map((iss) => _util_js__rspack_import_2.finalizeIssue(iss, ctx, _core_js__rspack_import_0.config()))),
        }
        : { success: true, data: result.value };
};
const safeParseAsync = /* @__PURE__*/ _safeParseAsync(_errors_js__rspack_import_1.$ZodRealError);
const _encode = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _parse(_Err)(schema, value, ctx);
};
const encode = /* @__PURE__*/ _encode(_errors_js__rspack_import_1.$ZodRealError);
const _decode = (_Err) => (schema, value, _ctx) => {
    return _parse(_Err)(schema, value, _ctx);
};
const decode = /* @__PURE__*/ _decode(_errors_js__rspack_import_1.$ZodRealError);
const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _parseAsync(_Err)(schema, value, ctx);
};
const encodeAsync = /* @__PURE__*/ _encodeAsync(_errors_js__rspack_import_1.$ZodRealError);
const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
    return _parseAsync(_Err)(schema, value, _ctx);
};
const decodeAsync = /* @__PURE__*/ _decodeAsync(_errors_js__rspack_import_1.$ZodRealError);
const _safeEncode = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _safeParse(_Err)(schema, value, ctx);
};
const safeEncode = /* @__PURE__*/ _safeEncode(_errors_js__rspack_import_1.$ZodRealError);
const _safeDecode = (_Err) => (schema, value, _ctx) => {
    return _safeParse(_Err)(schema, value, _ctx);
};
const safeDecode = /* @__PURE__*/ _safeDecode(_errors_js__rspack_import_1.$ZodRealError);
const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _safeParseAsync(_Err)(schema, value, ctx);
};
const safeEncodeAsync = /* @__PURE__*/ _safeEncodeAsync(_errors_js__rspack_import_1.$ZodRealError);
const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
    return _safeParseAsync(_Err)(schema, value, _ctx);
};
const safeDecodeAsync = /* @__PURE__*/ _safeDecodeAsync(_errors_js__rspack_import_1.$ZodRealError);


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/regexes.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  base64: () => (base64),
  base64url: () => (base64url),
  bigint: () => (bigint),
  boolean: () => (boolean),
  browserEmail: () => (browserEmail),
  cidrv4: () => (cidrv4),
  cidrv6: () => (cidrv6),
  cuid: () => (cuid),
  cuid2: () => (cuid2),
  date: () => (date),
  datetime: () => (datetime),
  domain: () => (domain),
  duration: () => (duration),
  e164: () => (e164),
  email: () => (email),
  emoji: () => (emoji),
  extendedDuration: () => (extendedDuration),
  guid: () => (guid),
  hex: () => (hex),
  hostname: () => (hostname),
  html5Email: () => (html5Email),
  idnEmail: () => (idnEmail),
  integer: () => (integer),
  ipv4: () => (ipv4),
  ipv6: () => (ipv6),
  ksuid: () => (ksuid),
  lowercase: () => (lowercase),
  mac: () => (mac),
  md5_base64: () => (md5_base64),
  md5_base64url: () => (md5_base64url),
  md5_hex: () => (md5_hex),
  nanoid: () => (nanoid),
  "null": () => (_null),
  number: () => (number),
  rfc5322Email: () => (rfc5322Email),
  sha1_base64: () => (sha1_base64),
  sha1_base64url: () => (sha1_base64url),
  sha1_hex: () => (sha1_hex),
  sha256_base64: () => (sha256_base64),
  sha256_base64url: () => (sha256_base64url),
  sha256_hex: () => (sha256_hex),
  sha384_base64: () => (sha384_base64),
  sha384_base64url: () => (sha384_base64url),
  sha384_hex: () => (sha384_hex),
  sha512_base64: () => (sha512_base64),
  sha512_base64url: () => (sha512_base64url),
  sha512_hex: () => (sha512_hex),
  string: () => (string),
  time: () => (time),
  ulid: () => (ulid),
  undefined: () => (_undefined),
  unicodeEmail: () => (unicodeEmail),
  uppercase: () => (uppercase),
  uuid: () => (uuid),
  uuid4: () => (uuid4),
  uuid6: () => (uuid6),
  uuid7: () => (uuid7),
  xid: () => (xid)
});
/* import */ var _util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const cuid = /^[cC][^\s-]{8,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
const duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** Implements ISO 8601-2 extensions like explicit +- prefixes, mixing weeks with other units, and fractional/negative components. */
const extendedDuration = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
 *
 * @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
const uuid = (version) => {
    if (!version)
        return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
    return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
const uuid4 = /*@__PURE__*/ uuid(4);
const uuid6 = /*@__PURE__*/ uuid(6);
const uuid7 = /*@__PURE__*/ uuid(7);
/** Practical email validation */
const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
/** Equivalent to the HTML5 input[type=email] validation implemented by browsers. Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/email */
const html5Email = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
/** The classic emailregex.com regex for RFC 5322-compliant emails */
const rfc5322Email = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
/** A loose regex that allows Unicode characters, enforces length limits, and that's about it. */
const unicodeEmail = /^[^\s@"]{1,64}@[^\s@]{1,255}$/u;
const idnEmail = unicodeEmail;
const browserEmail = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
// from https://thekevinscott.com/emojis-in-javascript/#writing-a-regular-expression
const _emoji = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
    return new RegExp(_emoji, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const mac = (delimiter) => {
    const escapedDelim = _util_js__rspack_import_0.escapeRegex(delimiter ?? ":");
    return new RegExp(`^(?:[0-9A-F]{2}${escapedDelim}){5}[0-9A-F]{2}$|^(?:[0-9a-f]{2}${escapedDelim}){5}[0-9a-f]{2}$`);
};
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
// https://stackoverflow.com/questions/7860392/determine-if-string-is-in-base64-using-javascript
const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^[A-Za-z0-9_-]*$/;
// based on https://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
// export const hostname: RegExp = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/;
const hostname = /^(?=.{1,253}\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$/;
const domain = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
// https://blog.stevenlevithan.com/archives/validate-phone-number#r4-3 (regex sans spaces)
// E.164: leading digit must be 1-9; total digits (excluding '+') between 7-15
const e164 = /^\+[1-9]\d{6,14}$/;
// const dateSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
const date = /*@__PURE__*/ new RegExp(`^${dateSource}$`);
function timeSource(args) {
    const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
    const regex = typeof args.precision === "number"
        ? args.precision === -1
            ? `${hhmm}`
            : args.precision === 0
                ? `${hhmm}:[0-5]\\d`
                : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}`
        : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
    return regex;
}
function time(args) {
    return new RegExp(`^${timeSource(args)}$`);
}
// Adapted from https://stackoverflow.com/a/3143231
function datetime(args) {
    const time = timeSource({ precision: args.precision });
    const opts = ["Z"];
    if (args.local)
        opts.push("");
    // if (args.offset) opts.push(`([+-]\\d{2}:\\d{2})`);
    if (args.offset)
        opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
    const timeRegex = `${time}(?:${opts.join("|")})`;
    return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
const string = (params) => {
    const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
    return new RegExp(`^${regex}$`);
};
const bigint = /^-?\d+n?$/;
const integer = /^-?\d+$/;
const number = /^-?\d+(?:\.\d+)?$/;
const boolean = /^(?:true|false)$/i;
const _null = /^null$/i;

const _undefined = /^undefined$/i;

// regex for string with no uppercase letters
const lowercase = /^[^A-Z]*$/;
// regex for string with no lowercase letters
const uppercase = /^[^a-z]*$/;
// regex for hexadecimal strings (any length)
const hex = /^[0-9a-fA-F]*$/;
// Hash regexes for different algorithms and encodings
// Helper function to create base64 regex with exact length and padding
function fixedBase64(bodyLength, padding) {
    return new RegExp(`^[A-Za-z0-9+/]{${bodyLength}}${padding}$`);
}
// Helper function to create base64url regex with exact length (no padding)
function fixedBase64url(length) {
    return new RegExp(`^[A-Za-z0-9_-]{${length}}$`);
}
// MD5 (16 bytes): base64 = 24 chars total (22 + "==")
const md5_hex = /^[0-9a-fA-F]{32}$/;
const md5_base64 = /*@__PURE__*/ fixedBase64(22, "==");
const md5_base64url = /*@__PURE__*/ fixedBase64url(22);
// SHA1 (20 bytes): base64 = 28 chars total (27 + "=")
const sha1_hex = /^[0-9a-fA-F]{40}$/;
const sha1_base64 = /*@__PURE__*/ fixedBase64(27, "=");
const sha1_base64url = /*@__PURE__*/ fixedBase64url(27);
// SHA256 (32 bytes): base64 = 44 chars total (43 + "=")
const sha256_hex = /^[0-9a-fA-F]{64}$/;
const sha256_base64 = /*@__PURE__*/ fixedBase64(43, "=");
const sha256_base64url = /*@__PURE__*/ fixedBase64url(43);
// SHA384 (48 bytes): base64 = 64 chars total (no padding)
const sha384_hex = /^[0-9a-fA-F]{96}$/;
const sha384_base64 = /*@__PURE__*/ fixedBase64(64, "");
const sha384_base64url = /*@__PURE__*/ fixedBase64url(64);
// SHA512 (64 bytes): base64 = 88 chars total (86 + "==")
const sha512_hex = /^[0-9a-fA-F]{128}$/;
const sha512_base64 = /*@__PURE__*/ fixedBase64(86, "==");
const sha512_base64url = /*@__PURE__*/ fixedBase64url(86);


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/registries.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  $ZodRegistry: () => ($ZodRegistry),
  $input: () => ($input),
  $output: () => ($output),
  globalRegistry: () => (globalRegistry),
  registry: () => (registry)
});
var _a;
const $output = Symbol("ZodOutput");
const $input = Symbol("ZodInput");
class $ZodRegistry {
    constructor() {
        this._map = new WeakMap();
        this._idmap = new Map();
    }
    add(schema, ..._meta) {
        const meta = _meta[0];
        this._map.set(schema, meta);
        if (meta && typeof meta === "object" && "id" in meta) {
            this._idmap.set(meta.id, schema);
        }
        return this;
    }
    clear() {
        this._map = new WeakMap();
        this._idmap = new Map();
        return this;
    }
    remove(schema) {
        const meta = this._map.get(schema);
        if (meta && typeof meta === "object" && "id" in meta) {
            this._idmap.delete(meta.id);
        }
        this._map.delete(schema);
        return this;
    }
    get(schema) {
        // return this._map.get(schema) as any;
        // inherit metadata
        const p = schema._zod.parent;
        if (p) {
            const pm = { ...(this.get(p) ?? {}) };
            delete pm.id; // do not inherit id
            const f = { ...pm, ...this._map.get(schema) };
            return Object.keys(f).length ? f : undefined;
        }
        return this._map.get(schema);
    }
    has(schema) {
        return this._map.has(schema);
    }
}
// registries
function registry() {
    return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/schemas.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  $ZodAny: () => ($ZodAny),
  $ZodArray: () => ($ZodArray),
  $ZodBase64: () => ($ZodBase64),
  $ZodBase64URL: () => ($ZodBase64URL),
  $ZodBigInt: () => ($ZodBigInt),
  $ZodBigIntFormat: () => ($ZodBigIntFormat),
  $ZodBoolean: () => ($ZodBoolean),
  $ZodCIDRv4: () => ($ZodCIDRv4),
  $ZodCIDRv6: () => ($ZodCIDRv6),
  $ZodCUID: () => ($ZodCUID),
  $ZodCUID2: () => ($ZodCUID2),
  $ZodCatch: () => ($ZodCatch),
  $ZodCodec: () => ($ZodCodec),
  $ZodCustom: () => ($ZodCustom),
  $ZodCustomStringFormat: () => ($ZodCustomStringFormat),
  $ZodDate: () => ($ZodDate),
  $ZodDefault: () => ($ZodDefault),
  $ZodDiscriminatedUnion: () => ($ZodDiscriminatedUnion),
  $ZodE164: () => ($ZodE164),
  $ZodEmail: () => ($ZodEmail),
  $ZodEmoji: () => ($ZodEmoji),
  $ZodEnum: () => ($ZodEnum),
  $ZodExactOptional: () => ($ZodExactOptional),
  $ZodFile: () => ($ZodFile),
  $ZodFunction: () => ($ZodFunction),
  $ZodGUID: () => ($ZodGUID),
  $ZodIPv4: () => ($ZodIPv4),
  $ZodIPv6: () => ($ZodIPv6),
  $ZodISODate: () => ($ZodISODate),
  $ZodISODateTime: () => ($ZodISODateTime),
  $ZodISODuration: () => ($ZodISODuration),
  $ZodISOTime: () => ($ZodISOTime),
  $ZodIntersection: () => ($ZodIntersection),
  $ZodJWT: () => ($ZodJWT),
  $ZodKSUID: () => ($ZodKSUID),
  $ZodLazy: () => ($ZodLazy),
  $ZodLiteral: () => ($ZodLiteral),
  $ZodMAC: () => ($ZodMAC),
  $ZodMap: () => ($ZodMap),
  $ZodNaN: () => ($ZodNaN),
  $ZodNanoID: () => ($ZodNanoID),
  $ZodNever: () => ($ZodNever),
  $ZodNonOptional: () => ($ZodNonOptional),
  $ZodNull: () => ($ZodNull),
  $ZodNullable: () => ($ZodNullable),
  $ZodNumber: () => ($ZodNumber),
  $ZodNumberFormat: () => ($ZodNumberFormat),
  $ZodObject: () => ($ZodObject),
  $ZodObjectJIT: () => ($ZodObjectJIT),
  $ZodOptional: () => ($ZodOptional),
  $ZodPipe: () => ($ZodPipe),
  $ZodPrefault: () => ($ZodPrefault),
  $ZodPromise: () => ($ZodPromise),
  $ZodReadonly: () => ($ZodReadonly),
  $ZodRecord: () => ($ZodRecord),
  $ZodSet: () => ($ZodSet),
  $ZodString: () => ($ZodString),
  $ZodStringFormat: () => ($ZodStringFormat),
  $ZodSuccess: () => ($ZodSuccess),
  $ZodSymbol: () => ($ZodSymbol),
  $ZodTemplateLiteral: () => ($ZodTemplateLiteral),
  $ZodTransform: () => ($ZodTransform),
  $ZodTuple: () => ($ZodTuple),
  $ZodType: () => ($ZodType),
  $ZodULID: () => ($ZodULID),
  $ZodURL: () => ($ZodURL),
  $ZodUUID: () => ($ZodUUID),
  $ZodUndefined: () => ($ZodUndefined),
  $ZodUnion: () => ($ZodUnion),
  $ZodUnknown: () => ($ZodUnknown),
  $ZodVoid: () => ($ZodVoid),
  $ZodXID: () => ($ZodXID),
  $ZodXor: () => ($ZodXor),
  clone: () => (/* reexport safe */ _util_js__rspack_import_5.clone),
  isValidBase64: () => (isValidBase64),
  isValidBase64URL: () => (isValidBase64URL),
  isValidJWT: () => (isValidJWT)
});
/* import */ var _checks_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/checks.js");
/* import */ var _core_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/core.js");
/* import */ var _doc_js__rspack_import_2 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/doc.js");
/* import */ var _parse_js__rspack_import_3 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/parse.js");
/* import */ var _regexes_js__rspack_import_4 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/regexes.js");
/* import */ var _util_js__rspack_import_5 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");
/* import */ var _versions_js__rspack_import_6 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/versions.js");







const $ZodType = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodType", (inst, def) => {
    var _a;
    inst ?? (inst = {});
    inst._zod.def = def; // set _def property
    inst._zod.bag = inst._zod.bag || {}; // initialize _bag object
    inst._zod.version = _versions_js__rspack_import_6.version;
    const checks = [...(inst._zod.def.checks ?? [])];
    // if inst is itself a checks.$ZodCheck, run it as a check
    if (inst._zod.traits.has("$ZodCheck")) {
        checks.unshift(inst);
    }
    for (const ch of checks) {
        for (const fn of ch._zod.onattach) {
            fn(inst);
        }
    }
    if (checks.length === 0) {
        // deferred initializer
        // inst._zod.parse is not yet defined
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        inst._zod.deferred?.push(() => {
            inst._zod.run = inst._zod.parse;
        });
    }
    else {
        const runChecks = (payload, checks, ctx) => {
            let isAborted = _util_js__rspack_import_5.aborted(payload);
            let asyncResult;
            for (const ch of checks) {
                if (ch._zod.def.when) {
                    const shouldRun = ch._zod.def.when(payload);
                    if (!shouldRun)
                        continue;
                }
                else if (isAborted) {
                    continue;
                }
                const currLen = payload.issues.length;
                const _ = ch._zod.check(payload);
                if (_ instanceof Promise && ctx?.async === false) {
                    throw new _core_js__rspack_import_1.$ZodAsyncError();
                }
                if (asyncResult || _ instanceof Promise) {
                    asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
                        await _;
                        const nextLen = payload.issues.length;
                        if (nextLen === currLen)
                            return;
                        if (!isAborted)
                            isAborted = _util_js__rspack_import_5.aborted(payload, currLen);
                    });
                }
                else {
                    const nextLen = payload.issues.length;
                    if (nextLen === currLen)
                        continue;
                    if (!isAborted)
                        isAborted = _util_js__rspack_import_5.aborted(payload, currLen);
                }
            }
            if (asyncResult) {
                return asyncResult.then(() => {
                    return payload;
                });
            }
            return payload;
        };
        const handleCanaryResult = (canary, payload, ctx) => {
            // abort if the canary is aborted
            if (_util_js__rspack_import_5.aborted(canary)) {
                canary.aborted = true;
                return canary;
            }
            // run checks first, then
            const checkResult = runChecks(payload, checks, ctx);
            if (checkResult instanceof Promise) {
                if (ctx.async === false)
                    throw new _core_js__rspack_import_1.$ZodAsyncError();
                return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
            }
            return inst._zod.parse(checkResult, ctx);
        };
        inst._zod.run = (payload, ctx) => {
            if (ctx.skipChecks) {
                return inst._zod.parse(payload, ctx);
            }
            if (ctx.direction === "backward") {
                // run canary
                // initial pass (no checks)
                const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
                if (canary instanceof Promise) {
                    return canary.then((canary) => {
                        return handleCanaryResult(canary, payload, ctx);
                    });
                }
                return handleCanaryResult(canary, payload, ctx);
            }
            // forward
            const result = inst._zod.parse(payload, ctx);
            if (result instanceof Promise) {
                if (ctx.async === false)
                    throw new _core_js__rspack_import_1.$ZodAsyncError();
                return result.then((result) => runChecks(result, checks, ctx));
            }
            return runChecks(result, checks, ctx);
        };
    }
    // Lazy initialize ~standard to avoid creating objects for every schema
    _util_js__rspack_import_5.defineLazy(inst, "~standard", () => ({
        validate: (value) => {
            try {
                const r = (0,_parse_js__rspack_import_3.safeParse)(inst, value);
                return r.success ? { value: r.data } : { issues: r.error?.issues };
            }
            catch (_) {
                return (0,_parse_js__rspack_import_3.safeParseAsync)(inst, value).then((r) => (r.success ? { value: r.data } : { issues: r.error?.issues }));
            }
        },
        vendor: "zod",
        version: 1,
    }));
});

const $ZodString = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodString", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = [...(inst?._zod.bag?.patterns ?? [])].pop() ?? _regexes_js__rspack_import_4.string(inst._zod.bag);
    inst._zod.parse = (payload, _) => {
        if (def.coerce)
            try {
                payload.value = String(payload.value);
            }
            catch (_) { }
        if (typeof payload.value === "string")
            return payload;
        payload.issues.push({
            expected: "string",
            code: "invalid_type",
            input: payload.value,
            inst,
        });
        return payload;
    };
});
const $ZodStringFormat = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodStringFormat", (inst, def) => {
    // check initialization must come first
    _checks_js__rspack_import_0.$ZodCheckStringFormat.init(inst, def);
    $ZodString.init(inst, def);
});
const $ZodGUID = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodGUID", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.guid);
    $ZodStringFormat.init(inst, def);
});
const $ZodUUID = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodUUID", (inst, def) => {
    if (def.version) {
        const versionMap = {
            v1: 1,
            v2: 2,
            v3: 3,
            v4: 4,
            v5: 5,
            v6: 6,
            v7: 7,
            v8: 8,
        };
        const v = versionMap[def.version];
        if (v === undefined)
            throw new Error(`Invalid UUID version: "${def.version}"`);
        def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.uuid(v));
    }
    else
        def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.uuid());
    $ZodStringFormat.init(inst, def);
});
const $ZodEmail = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodEmail", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.email);
    $ZodStringFormat.init(inst, def);
});
const $ZodURL = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodURL", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        try {
            // Trim whitespace from input
            const trimmed = payload.value.trim();
            // @ts-ignore
            const url = new URL(trimmed);
            if (def.hostname) {
                def.hostname.lastIndex = 0;
                if (!def.hostname.test(url.hostname)) {
                    payload.issues.push({
                        code: "invalid_format",
                        format: "url",
                        note: "Invalid hostname",
                        pattern: def.hostname.source,
                        input: payload.value,
                        inst,
                        continue: !def.abort,
                    });
                }
            }
            if (def.protocol) {
                def.protocol.lastIndex = 0;
                if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) {
                    payload.issues.push({
                        code: "invalid_format",
                        format: "url",
                        note: "Invalid protocol",
                        pattern: def.protocol.source,
                        input: payload.value,
                        inst,
                        continue: !def.abort,
                    });
                }
            }
            // Set the output value based on normalize flag
            if (def.normalize) {
                // Use normalized URL
                payload.value = url.href;
            }
            else {
                // Preserve the original input (trimmed)
                payload.value = trimmed;
            }
            return;
        }
        catch (_) {
            payload.issues.push({
                code: "invalid_format",
                format: "url",
                input: payload.value,
                inst,
                continue: !def.abort,
            });
        }
    };
});
const $ZodEmoji = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodEmoji", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.emoji());
    $ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodNanoID", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.nanoid);
    $ZodStringFormat.init(inst, def);
});
const $ZodCUID = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodCUID", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.cuid);
    $ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodCUID2", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.cuid2);
    $ZodStringFormat.init(inst, def);
});
const $ZodULID = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodULID", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.ulid);
    $ZodStringFormat.init(inst, def);
});
const $ZodXID = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodXID", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.xid);
    $ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodKSUID", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.ksuid);
    $ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodISODateTime", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.datetime(def));
    $ZodStringFormat.init(inst, def);
});
const $ZodISODate = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodISODate", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.date);
    $ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodISOTime", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.time(def));
    $ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodISODuration", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.duration);
    $ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodIPv4", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.ipv4);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.format = `ipv4`;
});
const $ZodIPv6 = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodIPv6", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.ipv6);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.format = `ipv6`;
    inst._zod.check = (payload) => {
        try {
            // @ts-ignore
            new URL(`http://[${payload.value}]`);
            // return;
        }
        catch {
            payload.issues.push({
                code: "invalid_format",
                format: "ipv6",
                input: payload.value,
                inst,
                continue: !def.abort,
            });
        }
    };
});
const $ZodMAC = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodMAC", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.mac(def.delimiter));
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.format = `mac`;
});
const $ZodCIDRv4 = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodCIDRv4", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.cidrv4);
    $ZodStringFormat.init(inst, def);
});
const $ZodCIDRv6 = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodCIDRv6", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.cidrv6); // not used for validation
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        const parts = payload.value.split("/");
        try {
            if (parts.length !== 2)
                throw new Error();
            const [address, prefix] = parts;
            if (!prefix)
                throw new Error();
            const prefixNum = Number(prefix);
            if (`${prefixNum}` !== prefix)
                throw new Error();
            if (prefixNum < 0 || prefixNum > 128)
                throw new Error();
            // @ts-ignore
            new URL(`http://[${address}]`);
        }
        catch {
            payload.issues.push({
                code: "invalid_format",
                format: "cidrv6",
                input: payload.value,
                inst,
                continue: !def.abort,
            });
        }
    };
});
//////////////////////////////   ZodBase64   //////////////////////////////
function isValidBase64(data) {
    if (data === "")
        return true;
    if (data.length % 4 !== 0)
        return false;
    try {
        // @ts-ignore
        atob(data);
        return true;
    }
    catch {
        return false;
    }
}
const $ZodBase64 = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodBase64", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.base64);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.contentEncoding = "base64";
    inst._zod.check = (payload) => {
        if (isValidBase64(payload.value))
            return;
        payload.issues.push({
            code: "invalid_format",
            format: "base64",
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
//////////////////////////////   ZodBase64   //////////////////////////////
function isValidBase64URL(data) {
    if (!_regexes_js__rspack_import_4.base64url.test(data))
        return false;
    const base64 = data.replace(/[-_]/g, (c) => (c === "-" ? "+" : "/"));
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return isValidBase64(padded);
}
const $ZodBase64URL = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodBase64URL", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.base64url);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.contentEncoding = "base64url";
    inst._zod.check = (payload) => {
        if (isValidBase64URL(payload.value))
            return;
        payload.issues.push({
            code: "invalid_format",
            format: "base64url",
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodE164 = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodE164", (inst, def) => {
    def.pattern ?? (def.pattern = _regexes_js__rspack_import_4.e164);
    $ZodStringFormat.init(inst, def);
});
//////////////////////////////   ZodJWT   //////////////////////////////
function isValidJWT(token, algorithm = null) {
    try {
        const tokensParts = token.split(".");
        if (tokensParts.length !== 3)
            return false;
        const [header] = tokensParts;
        if (!header)
            return false;
        // @ts-ignore
        const parsedHeader = JSON.parse(atob(header));
        if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
            return false;
        if (!parsedHeader.alg)
            return false;
        if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
            return false;
        return true;
    }
    catch {
        return false;
    }
}
const $ZodJWT = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodJWT", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        if (isValidJWT(payload.value, def.alg))
            return;
        payload.issues.push({
            code: "invalid_format",
            format: "jwt",
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCustomStringFormat = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodCustomStringFormat", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        if (def.fn(payload.value))
            return;
        payload.issues.push({
            code: "invalid_format",
            format: def.format,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodNumber = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodNumber", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = inst._zod.bag.pattern ?? _regexes_js__rspack_import_4.number;
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
            try {
                payload.value = Number(payload.value);
            }
            catch (_) { }
        const input = payload.value;
        if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
            return payload;
        }
        const received = typeof input === "number"
            ? Number.isNaN(input)
                ? "NaN"
                : !Number.isFinite(input)
                    ? "Infinity"
                    : undefined
            : undefined;
        payload.issues.push({
            expected: "number",
            code: "invalid_type",
            input,
            inst,
            ...(received ? { received } : {}),
        });
        return payload;
    };
});
const $ZodNumberFormat = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodNumberFormat", (inst, def) => {
    _checks_js__rspack_import_0.$ZodCheckNumberFormat.init(inst, def);
    $ZodNumber.init(inst, def); // no format checks
});
const $ZodBoolean = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodBoolean", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = _regexes_js__rspack_import_4.boolean;
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
            try {
                payload.value = Boolean(payload.value);
            }
            catch (_) { }
        const input = payload.value;
        if (typeof input === "boolean")
            return payload;
        payload.issues.push({
            expected: "boolean",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
const $ZodBigInt = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodBigInt", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = _regexes_js__rspack_import_4.bigint;
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
            try {
                payload.value = BigInt(payload.value);
            }
            catch (_) { }
        if (typeof payload.value === "bigint")
            return payload;
        payload.issues.push({
            expected: "bigint",
            code: "invalid_type",
            input: payload.value,
            inst,
        });
        return payload;
    };
});
const $ZodBigIntFormat = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodBigIntFormat", (inst, def) => {
    _checks_js__rspack_import_0.$ZodCheckBigIntFormat.init(inst, def);
    $ZodBigInt.init(inst, def); // no format checks
});
const $ZodSymbol = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodSymbol", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (typeof input === "symbol")
            return payload;
        payload.issues.push({
            expected: "symbol",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
const $ZodUndefined = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodUndefined", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = _regexes_js__rspack_import_4.undefined;
    inst._zod.values = new Set([undefined]);
    inst._zod.optin = "optional";
    inst._zod.optout = "optional";
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (typeof input === "undefined")
            return payload;
        payload.issues.push({
            expected: "undefined",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
const $ZodNull = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodNull", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = _regexes_js__rspack_import_4["null"];
    inst._zod.values = new Set([null]);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (input === null)
            return payload;
        payload.issues.push({
            expected: "null",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
const $ZodAny = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodAny", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload) => payload;
});
const $ZodUnknown = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodUnknown", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload) => payload;
});
const $ZodNever = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodNever", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
        payload.issues.push({
            expected: "never",
            code: "invalid_type",
            input: payload.value,
            inst,
        });
        return payload;
    };
});
const $ZodVoid = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodVoid", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (typeof input === "undefined")
            return payload;
        payload.issues.push({
            expected: "void",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
const $ZodDate = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodDate", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce) {
            try {
                payload.value = new Date(payload.value);
            }
            catch (_err) { }
        }
        const input = payload.value;
        const isDate = input instanceof Date;
        const isValidDate = isDate && !Number.isNaN(input.getTime());
        if (isValidDate)
            return payload;
        payload.issues.push({
            expected: "date",
            code: "invalid_type",
            input,
            ...(isDate ? { received: "Invalid Date" } : {}),
            inst,
        });
        return payload;
    };
});
function handleArrayResult(result, final, index) {
    if (result.issues.length) {
        final.issues.push(..._util_js__rspack_import_5.prefixIssues(index, result.issues));
    }
    final.value[index] = result.value;
}
const $ZodArray = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodArray", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!Array.isArray(input)) {
            payload.issues.push({
                expected: "array",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        payload.value = Array(input.length);
        const proms = [];
        for (let i = 0; i < input.length; i++) {
            const item = input[i];
            const result = def.element._zod.run({
                value: item,
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                proms.push(result.then((result) => handleArrayResult(result, payload, i)));
            }
            else {
                handleArrayResult(result, payload, i);
            }
        }
        if (proms.length) {
            return Promise.all(proms).then(() => payload);
        }
        return payload; //handleArrayResultsAsync(parseResults, final);
    };
});
function handlePropertyResult(result, final, key, input, isOptionalOut) {
    if (result.issues.length) {
        // For optional-out schemas, ignore errors on absent keys
        if (isOptionalOut && !(key in input)) {
            return;
        }
        final.issues.push(..._util_js__rspack_import_5.prefixIssues(key, result.issues));
    }
    if (result.value === undefined) {
        if (key in input) {
            final.value[key] = undefined;
        }
    }
    else {
        final.value[key] = result.value;
    }
}
function normalizeDef(def) {
    const keys = Object.keys(def.shape);
    for (const k of keys) {
        if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
            throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
        }
    }
    const okeys = _util_js__rspack_import_5.optionalKeys(def.shape);
    return {
        ...def,
        keys,
        keySet: new Set(keys),
        numKeys: keys.length,
        optionalKeys: new Set(okeys),
    };
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
    const unrecognized = [];
    // iterate over input keys
    const keySet = def.keySet;
    const _catchall = def.catchall._zod;
    const t = _catchall.def.type;
    const isOptionalOut = _catchall.optout === "optional";
    for (const key in input) {
        if (keySet.has(key))
            continue;
        if (t === "never") {
            unrecognized.push(key);
            continue;
        }
        const r = _catchall.run({ value: input[key], issues: [] }, ctx);
        if (r instanceof Promise) {
            proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalOut)));
        }
        else {
            handlePropertyResult(r, payload, key, input, isOptionalOut);
        }
    }
    if (unrecognized.length) {
        payload.issues.push({
            code: "unrecognized_keys",
            keys: unrecognized,
            input,
            inst,
        });
    }
    if (!proms.length)
        return payload;
    return Promise.all(proms).then(() => {
        return payload;
    });
}
const $ZodObject = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodObject", (inst, def) => {
    // requires cast because technically $ZodObject doesn't extend
    $ZodType.init(inst, def);
    // const sh = def.shape;
    const desc = Object.getOwnPropertyDescriptor(def, "shape");
    if (!desc?.get) {
        const sh = def.shape;
        Object.defineProperty(def, "shape", {
            get: () => {
                const newSh = { ...sh };
                Object.defineProperty(def, "shape", {
                    value: newSh,
                });
                return newSh;
            },
        });
    }
    const _normalized = _util_js__rspack_import_5.cached(() => normalizeDef(def));
    _util_js__rspack_import_5.defineLazy(inst._zod, "propValues", () => {
        const shape = def.shape;
        const propValues = {};
        for (const key in shape) {
            const field = shape[key]._zod;
            if (field.values) {
                propValues[key] ?? (propValues[key] = new Set());
                for (const v of field.values)
                    propValues[key].add(v);
            }
        }
        return propValues;
    });
    const isObject = _util_js__rspack_import_5.isObject;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject(input)) {
            payload.issues.push({
                expected: "object",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        payload.value = {};
        const proms = [];
        const shape = value.shape;
        for (const key of value.keys) {
            const el = shape[key];
            const isOptionalOut = el._zod.optout === "optional";
            const r = el._zod.run({ value: input[key], issues: [] }, ctx);
            if (r instanceof Promise) {
                proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalOut)));
            }
            else {
                handlePropertyResult(r, payload, key, input, isOptionalOut);
            }
        }
        if (!catchall) {
            return proms.length ? Promise.all(proms).then(() => payload) : payload;
        }
        return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
    };
});
const $ZodObjectJIT = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodObjectJIT", (inst, def) => {
    // requires cast because technically $ZodObject doesn't extend
    $ZodObject.init(inst, def);
    const superParse = inst._zod.parse;
    const _normalized = _util_js__rspack_import_5.cached(() => normalizeDef(def));
    const generateFastpass = (shape) => {
        const doc = new _doc_js__rspack_import_2.Doc(["shape", "payload", "ctx"]);
        const normalized = _normalized.value;
        const parseStr = (key) => {
            const k = _util_js__rspack_import_5.esc(key);
            return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
        };
        doc.write(`const input = payload.value;`);
        const ids = Object.create(null);
        let counter = 0;
        for (const key of normalized.keys) {
            ids[key] = `key_${counter++}`;
        }
        // A: preserve key order {
        doc.write(`const newResult = {};`);
        for (const key of normalized.keys) {
            const id = ids[key];
            const k = _util_js__rspack_import_5.esc(key);
            const schema = shape[key];
            const isOptionalOut = schema?._zod?.optout === "optional";
            doc.write(`const ${id} = ${parseStr(key)};`);
            if (isOptionalOut) {
                // For optional-out schemas, ignore errors on absent keys
                doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
            }
            else {
                doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
            }
        }
        doc.write(`payload.value = newResult;`);
        doc.write(`return payload;`);
        const fn = doc.compile();
        return (payload, ctx) => fn(shape, payload, ctx);
    };
    let fastpass;
    const isObject = _util_js__rspack_import_5.isObject;
    const jit = !_core_js__rspack_import_1.globalConfig.jitless;
    const allowsEval = _util_js__rspack_import_5.allowsEval;
    const fastEnabled = jit && allowsEval.value; // && !def.catchall;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject(input)) {
            payload.issues.push({
                expected: "object",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
            // always synchronous
            if (!fastpass)
                fastpass = generateFastpass(def.shape);
            payload = fastpass(payload, ctx);
            if (!catchall)
                return payload;
            return handleCatchall([], input, payload, ctx, value, inst);
        }
        return superParse(payload, ctx);
    };
});
function handleUnionResults(results, final, inst, ctx) {
    for (const result of results) {
        if (result.issues.length === 0) {
            final.value = result.value;
            return final;
        }
    }
    const nonaborted = results.filter((r) => !_util_js__rspack_import_5.aborted(r));
    if (nonaborted.length === 1) {
        final.value = nonaborted[0].value;
        return nonaborted[0];
    }
    final.issues.push({
        code: "invalid_union",
        input: final.value,
        inst,
        errors: results.map((result) => result.issues.map((iss) => _util_js__rspack_import_5.finalizeIssue(iss, ctx, _core_js__rspack_import_1.config()))),
    });
    return final;
}
const $ZodUnion = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodUnion", (inst, def) => {
    $ZodType.init(inst, def);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : undefined);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : undefined);
    _util_js__rspack_import_5.defineLazy(inst._zod, "values", () => {
        if (def.options.every((o) => o._zod.values)) {
            return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
        }
        return undefined;
    });
    _util_js__rspack_import_5.defineLazy(inst._zod, "pattern", () => {
        if (def.options.every((o) => o._zod.pattern)) {
            const patterns = def.options.map((o) => o._zod.pattern);
            return new RegExp(`^(${patterns.map((p) => _util_js__rspack_import_5.cleanRegex(p.source)).join("|")})$`);
        }
        return undefined;
    });
    const single = def.options.length === 1;
    const first = def.options[0]._zod.run;
    inst._zod.parse = (payload, ctx) => {
        if (single) {
            return first(payload, ctx);
        }
        let async = false;
        const results = [];
        for (const option of def.options) {
            const result = option._zod.run({
                value: payload.value,
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                results.push(result);
                async = true;
            }
            else {
                if (result.issues.length === 0)
                    return result;
                results.push(result);
            }
        }
        if (!async)
            return handleUnionResults(results, payload, inst, ctx);
        return Promise.all(results).then((results) => {
            return handleUnionResults(results, payload, inst, ctx);
        });
    };
});
function handleExclusiveUnionResults(results, final, inst, ctx) {
    const successes = results.filter((r) => r.issues.length === 0);
    if (successes.length === 1) {
        final.value = successes[0].value;
        return final;
    }
    if (successes.length === 0) {
        // No matches - same as regular union
        final.issues.push({
            code: "invalid_union",
            input: final.value,
            inst,
            errors: results.map((result) => result.issues.map((iss) => _util_js__rspack_import_5.finalizeIssue(iss, ctx, _core_js__rspack_import_1.config()))),
        });
    }
    else {
        // Multiple matches - exclusive union failure
        final.issues.push({
            code: "invalid_union",
            input: final.value,
            inst,
            errors: [],
            inclusive: false,
        });
    }
    return final;
}
const $ZodXor = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodXor", (inst, def) => {
    $ZodUnion.init(inst, def);
    def.inclusive = false;
    const single = def.options.length === 1;
    const first = def.options[0]._zod.run;
    inst._zod.parse = (payload, ctx) => {
        if (single) {
            return first(payload, ctx);
        }
        let async = false;
        const results = [];
        for (const option of def.options) {
            const result = option._zod.run({
                value: payload.value,
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                results.push(result);
                async = true;
            }
            else {
                results.push(result);
            }
        }
        if (!async)
            return handleExclusiveUnionResults(results, payload, inst, ctx);
        return Promise.all(results).then((results) => {
            return handleExclusiveUnionResults(results, payload, inst, ctx);
        });
    };
});
const $ZodDiscriminatedUnion = 
/*@__PURE__*/
_core_js__rspack_import_1.$constructor("$ZodDiscriminatedUnion", (inst, def) => {
    def.inclusive = false;
    $ZodUnion.init(inst, def);
    const _super = inst._zod.parse;
    _util_js__rspack_import_5.defineLazy(inst._zod, "propValues", () => {
        const propValues = {};
        for (const option of def.options) {
            const pv = option._zod.propValues;
            if (!pv || Object.keys(pv).length === 0)
                throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
            for (const [k, v] of Object.entries(pv)) {
                if (!propValues[k])
                    propValues[k] = new Set();
                for (const val of v) {
                    propValues[k].add(val);
                }
            }
        }
        return propValues;
    });
    const disc = _util_js__rspack_import_5.cached(() => {
        const opts = def.options;
        const map = new Map();
        for (const o of opts) {
            const values = o._zod.propValues?.[def.discriminator];
            if (!values || values.size === 0)
                throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
            for (const v of values) {
                if (map.has(v)) {
                    throw new Error(`Duplicate discriminator value "${String(v)}"`);
                }
                map.set(v, o);
            }
        }
        return map;
    });
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!_util_js__rspack_import_5.isObject(input)) {
            payload.issues.push({
                code: "invalid_type",
                expected: "object",
                input,
                inst,
            });
            return payload;
        }
        const opt = disc.value.get(input?.[def.discriminator]);
        if (opt) {
            return opt._zod.run(payload, ctx);
        }
        if (def.unionFallback) {
            return _super(payload, ctx);
        }
        // no matching discriminator
        payload.issues.push({
            code: "invalid_union",
            errors: [],
            note: "No matching discriminator",
            discriminator: def.discriminator,
            input,
            path: [def.discriminator],
            inst,
        });
        return payload;
    };
});
const $ZodIntersection = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodIntersection", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        const left = def.left._zod.run({ value: input, issues: [] }, ctx);
        const right = def.right._zod.run({ value: input, issues: [] }, ctx);
        const async = left instanceof Promise || right instanceof Promise;
        if (async) {
            return Promise.all([left, right]).then(([left, right]) => {
                return handleIntersectionResults(payload, left, right);
            });
        }
        return handleIntersectionResults(payload, left, right);
    };
});
function mergeValues(a, b) {
    // const aType = parse.t(a);
    // const bType = parse.t(b);
    if (a === b) {
        return { valid: true, data: a };
    }
    if (a instanceof Date && b instanceof Date && +a === +b) {
        return { valid: true, data: a };
    }
    if (_util_js__rspack_import_5.isPlainObject(a) && _util_js__rspack_import_5.isPlainObject(b)) {
        const bKeys = Object.keys(b);
        const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
        const newObj = { ...a, ...b };
        for (const key of sharedKeys) {
            const sharedValue = mergeValues(a[key], b[key]);
            if (!sharedValue.valid) {
                return {
                    valid: false,
                    mergeErrorPath: [key, ...sharedValue.mergeErrorPath],
                };
            }
            newObj[key] = sharedValue.data;
        }
        return { valid: true, data: newObj };
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return { valid: false, mergeErrorPath: [] };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
            const itemA = a[index];
            const itemB = b[index];
            const sharedValue = mergeValues(itemA, itemB);
            if (!sharedValue.valid) {
                return {
                    valid: false,
                    mergeErrorPath: [index, ...sharedValue.mergeErrorPath],
                };
            }
            newArray.push(sharedValue.data);
        }
        return { valid: true, data: newArray };
    }
    return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
    // Track which side(s) report each key as unrecognized
    const unrecKeys = new Map();
    let unrecIssue;
    for (const iss of left.issues) {
        if (iss.code === "unrecognized_keys") {
            unrecIssue ?? (unrecIssue = iss);
            for (const k of iss.keys) {
                if (!unrecKeys.has(k))
                    unrecKeys.set(k, {});
                unrecKeys.get(k).l = true;
            }
        }
        else {
            result.issues.push(iss);
        }
    }
    for (const iss of right.issues) {
        if (iss.code === "unrecognized_keys") {
            for (const k of iss.keys) {
                if (!unrecKeys.has(k))
                    unrecKeys.set(k, {});
                unrecKeys.get(k).r = true;
            }
        }
        else {
            result.issues.push(iss);
        }
    }
    // Report only keys unrecognized by BOTH sides
    const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
    if (bothKeys.length && unrecIssue) {
        result.issues.push({ ...unrecIssue, keys: bothKeys });
    }
    if (_util_js__rspack_import_5.aborted(result))
        return result;
    const merged = mergeValues(left.value, right.value);
    if (!merged.valid) {
        throw new Error(`Unmergable intersection. Error path: ` + `${JSON.stringify(merged.mergeErrorPath)}`);
    }
    result.value = merged.data;
    return result;
}
const $ZodTuple = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodTuple", (inst, def) => {
    $ZodType.init(inst, def);
    const items = def.items;
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!Array.isArray(input)) {
            payload.issues.push({
                input,
                inst,
                expected: "tuple",
                code: "invalid_type",
            });
            return payload;
        }
        payload.value = [];
        const proms = [];
        const reversedIndex = [...items].reverse().findIndex((item) => item._zod.optin !== "optional");
        const optStart = reversedIndex === -1 ? 0 : items.length - reversedIndex;
        if (!def.rest) {
            const tooBig = input.length > items.length;
            const tooSmall = input.length < optStart - 1;
            if (tooBig || tooSmall) {
                payload.issues.push({
                    ...(tooBig
                        ? { code: "too_big", maximum: items.length, inclusive: true }
                        : { code: "too_small", minimum: items.length }),
                    input,
                    inst,
                    origin: "array",
                });
                return payload;
            }
        }
        let i = -1;
        for (const item of items) {
            i++;
            if (i >= input.length)
                if (i >= optStart)
                    continue;
            const result = item._zod.run({
                value: input[i],
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                proms.push(result.then((result) => handleTupleResult(result, payload, i)));
            }
            else {
                handleTupleResult(result, payload, i);
            }
        }
        if (def.rest) {
            const rest = input.slice(items.length);
            for (const el of rest) {
                i++;
                const result = def.rest._zod.run({
                    value: el,
                    issues: [],
                }, ctx);
                if (result instanceof Promise) {
                    proms.push(result.then((result) => handleTupleResult(result, payload, i)));
                }
                else {
                    handleTupleResult(result, payload, i);
                }
            }
        }
        if (proms.length)
            return Promise.all(proms).then(() => payload);
        return payload;
    };
});
function handleTupleResult(result, final, index) {
    if (result.issues.length) {
        final.issues.push(..._util_js__rspack_import_5.prefixIssues(index, result.issues));
    }
    final.value[index] = result.value;
}
const $ZodRecord = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodRecord", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!_util_js__rspack_import_5.isPlainObject(input)) {
            payload.issues.push({
                expected: "record",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        const proms = [];
        const values = def.keyType._zod.values;
        if (values) {
            payload.value = {};
            const recordKeys = new Set();
            for (const key of values) {
                if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
                    recordKeys.add(typeof key === "number" ? key.toString() : key);
                    const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
                    if (result instanceof Promise) {
                        proms.push(result.then((result) => {
                            if (result.issues.length) {
                                payload.issues.push(..._util_js__rspack_import_5.prefixIssues(key, result.issues));
                            }
                            payload.value[key] = result.value;
                        }));
                    }
                    else {
                        if (result.issues.length) {
                            payload.issues.push(..._util_js__rspack_import_5.prefixIssues(key, result.issues));
                        }
                        payload.value[key] = result.value;
                    }
                }
            }
            let unrecognized;
            for (const key in input) {
                if (!recordKeys.has(key)) {
                    unrecognized = unrecognized ?? [];
                    unrecognized.push(key);
                }
            }
            if (unrecognized && unrecognized.length > 0) {
                payload.issues.push({
                    code: "unrecognized_keys",
                    input,
                    inst,
                    keys: unrecognized,
                });
            }
        }
        else {
            payload.value = {};
            for (const key of Reflect.ownKeys(input)) {
                if (key === "__proto__")
                    continue;
                let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
                if (keyResult instanceof Promise) {
                    throw new Error("Async schemas not supported in object keys currently");
                }
                // Numeric string fallback: if key failed with "expected number", retry with Number(key)
                const checkNumericKey = typeof key === "string" &&
                    _regexes_js__rspack_import_4.number.test(key) &&
                    keyResult.issues.length &&
                    keyResult.issues.some((iss) => iss.code === "invalid_type" && iss.expected === "number");
                if (checkNumericKey) {
                    const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
                    if (retryResult instanceof Promise) {
                        throw new Error("Async schemas not supported in object keys currently");
                    }
                    if (retryResult.issues.length === 0) {
                        keyResult = retryResult;
                    }
                }
                if (keyResult.issues.length) {
                    if (def.mode === "loose") {
                        // Pass through unchanged
                        payload.value[key] = input[key];
                    }
                    else {
                        // Default "strict" behavior: error on invalid key
                        payload.issues.push({
                            code: "invalid_key",
                            origin: "record",
                            issues: keyResult.issues.map((iss) => _util_js__rspack_import_5.finalizeIssue(iss, ctx, _core_js__rspack_import_1.config())),
                            input: key,
                            path: [key],
                            inst,
                        });
                    }
                    continue;
                }
                const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
                if (result instanceof Promise) {
                    proms.push(result.then((result) => {
                        if (result.issues.length) {
                            payload.issues.push(..._util_js__rspack_import_5.prefixIssues(key, result.issues));
                        }
                        payload.value[keyResult.value] = result.value;
                    }));
                }
                else {
                    if (result.issues.length) {
                        payload.issues.push(..._util_js__rspack_import_5.prefixIssues(key, result.issues));
                    }
                    payload.value[keyResult.value] = result.value;
                }
            }
        }
        if (proms.length) {
            return Promise.all(proms).then(() => payload);
        }
        return payload;
    };
});
const $ZodMap = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodMap", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!(input instanceof Map)) {
            payload.issues.push({
                expected: "map",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        const proms = [];
        payload.value = new Map();
        for (const [key, value] of input) {
            const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
            const valueResult = def.valueType._zod.run({ value: value, issues: [] }, ctx);
            if (keyResult instanceof Promise || valueResult instanceof Promise) {
                proms.push(Promise.all([keyResult, valueResult]).then(([keyResult, valueResult]) => {
                    handleMapResult(keyResult, valueResult, payload, key, input, inst, ctx);
                }));
            }
            else {
                handleMapResult(keyResult, valueResult, payload, key, input, inst, ctx);
            }
        }
        if (proms.length)
            return Promise.all(proms).then(() => payload);
        return payload;
    };
});
function handleMapResult(keyResult, valueResult, final, key, input, inst, ctx) {
    if (keyResult.issues.length) {
        if (_util_js__rspack_import_5.propertyKeyTypes.has(typeof key)) {
            final.issues.push(..._util_js__rspack_import_5.prefixIssues(key, keyResult.issues));
        }
        else {
            final.issues.push({
                code: "invalid_key",
                origin: "map",
                input,
                inst,
                issues: keyResult.issues.map((iss) => _util_js__rspack_import_5.finalizeIssue(iss, ctx, _core_js__rspack_import_1.config())),
            });
        }
    }
    if (valueResult.issues.length) {
        if (_util_js__rspack_import_5.propertyKeyTypes.has(typeof key)) {
            final.issues.push(..._util_js__rspack_import_5.prefixIssues(key, valueResult.issues));
        }
        else {
            final.issues.push({
                origin: "map",
                code: "invalid_element",
                input,
                inst,
                key: key,
                issues: valueResult.issues.map((iss) => _util_js__rspack_import_5.finalizeIssue(iss, ctx, _core_js__rspack_import_1.config())),
            });
        }
    }
    final.value.set(keyResult.value, valueResult.value);
}
const $ZodSet = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodSet", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!(input instanceof Set)) {
            payload.issues.push({
                input,
                inst,
                expected: "set",
                code: "invalid_type",
            });
            return payload;
        }
        const proms = [];
        payload.value = new Set();
        for (const item of input) {
            const result = def.valueType._zod.run({ value: item, issues: [] }, ctx);
            if (result instanceof Promise) {
                proms.push(result.then((result) => handleSetResult(result, payload)));
            }
            else
                handleSetResult(result, payload);
        }
        if (proms.length)
            return Promise.all(proms).then(() => payload);
        return payload;
    };
});
function handleSetResult(result, final) {
    if (result.issues.length) {
        final.issues.push(...result.issues);
    }
    final.value.add(result.value);
}
const $ZodEnum = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodEnum", (inst, def) => {
    $ZodType.init(inst, def);
    const values = _util_js__rspack_import_5.getEnumValues(def.entries);
    const valuesSet = new Set(values);
    inst._zod.values = valuesSet;
    inst._zod.pattern = new RegExp(`^(${values
        .filter((k) => _util_js__rspack_import_5.propertyKeyTypes.has(typeof k))
        .map((o) => (typeof o === "string" ? _util_js__rspack_import_5.escapeRegex(o) : o.toString()))
        .join("|")})$`);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (valuesSet.has(input)) {
            return payload;
        }
        payload.issues.push({
            code: "invalid_value",
            values,
            input,
            inst,
        });
        return payload;
    };
});
const $ZodLiteral = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodLiteral", (inst, def) => {
    $ZodType.init(inst, def);
    if (def.values.length === 0) {
        throw new Error("Cannot create literal schema with no valid values");
    }
    const values = new Set(def.values);
    inst._zod.values = values;
    inst._zod.pattern = new RegExp(`^(${def.values
        .map((o) => (typeof o === "string" ? _util_js__rspack_import_5.escapeRegex(o) : o ? _util_js__rspack_import_5.escapeRegex(o.toString()) : String(o)))
        .join("|")})$`);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (values.has(input)) {
            return payload;
        }
        payload.issues.push({
            code: "invalid_value",
            values: def.values,
            input,
            inst,
        });
        return payload;
    };
});
const $ZodFile = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodFile", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        // @ts-ignore
        if (input instanceof File)
            return payload;
        payload.issues.push({
            expected: "file",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
const $ZodTransform = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodTransform", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            throw new _core_js__rspack_import_1.$ZodEncodeError(inst.constructor.name);
        }
        const _out = def.transform(payload.value, payload);
        if (ctx.async) {
            const output = _out instanceof Promise ? _out : Promise.resolve(_out);
            return output.then((output) => {
                payload.value = output;
                return payload;
            });
        }
        if (_out instanceof Promise) {
            throw new _core_js__rspack_import_1.$ZodAsyncError();
        }
        payload.value = _out;
        return payload;
    };
});
function handleOptionalResult(result, input) {
    if (result.issues.length && input === undefined) {
        return { issues: [], value: undefined };
    }
    return result;
}
const $ZodOptional = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodOptional", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    inst._zod.optout = "optional";
    _util_js__rspack_import_5.defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? new Set([...def.innerType._zod.values, undefined]) : undefined;
    });
    _util_js__rspack_import_5.defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${_util_js__rspack_import_5.cleanRegex(pattern.source)})?$`) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        if (def.innerType._zod.optin === "optional") {
            const result = def.innerType._zod.run(payload, ctx);
            if (result instanceof Promise)
                return result.then((r) => handleOptionalResult(r, payload.value));
            return handleOptionalResult(result, payload.value);
        }
        if (payload.value === undefined) {
            return payload;
        }
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodExactOptional = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodExactOptional", (inst, def) => {
    // Call parent init - inherits optin/optout = "optional"
    $ZodOptional.init(inst, def);
    // Override values/pattern to NOT add undefined
    _util_js__rspack_import_5.defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    _util_js__rspack_import_5.defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
    // Override parse to just delegate (no undefined handling)
    inst._zod.parse = (payload, ctx) => {
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodNullable = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodNullable", (inst, def) => {
    $ZodType.init(inst, def);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    _util_js__rspack_import_5.defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${_util_js__rspack_import_5.cleanRegex(pattern.source)}|null)$`) : undefined;
    });
    _util_js__rspack_import_5.defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? new Set([...def.innerType._zod.values, null]) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        // Forward direction (decode): allow null to pass through
        if (payload.value === null)
            return payload;
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodDefault = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodDefault", (inst, def) => {
    $ZodType.init(inst, def);
    // inst._zod.qin = "true";
    inst._zod.optin = "optional";
    _util_js__rspack_import_5.defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        // Forward direction (decode): apply defaults for undefined input
        if (payload.value === undefined) {
            payload.value = def.defaultValue;
            /**
             * $ZodDefault returns the default value immediately in forward direction.
             * It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
            return payload;
        }
        // Forward direction: continue with default handling
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then((result) => handleDefaultResult(result, def));
        }
        return handleDefaultResult(result, def);
    };
});
function handleDefaultResult(payload, def) {
    if (payload.value === undefined) {
        payload.value = def.defaultValue;
    }
    return payload;
}
const $ZodPrefault = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodPrefault", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    _util_js__rspack_import_5.defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        // Forward direction (decode): apply prefault for undefined input
        if (payload.value === undefined) {
            payload.value = def.defaultValue;
        }
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodNonOptional = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodNonOptional", (inst, def) => {
    $ZodType.init(inst, def);
    _util_js__rspack_import_5.defineLazy(inst._zod, "values", () => {
        const v = def.innerType._zod.values;
        return v ? new Set([...v].filter((x) => x !== undefined)) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then((result) => handleNonOptionalResult(result, inst));
        }
        return handleNonOptionalResult(result, inst);
    };
});
function handleNonOptionalResult(payload, inst) {
    if (!payload.issues.length && payload.value === undefined) {
        payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: payload.value,
            inst,
        });
    }
    return payload;
}
const $ZodSuccess = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodSuccess", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            throw new _core_js__rspack_import_1.$ZodEncodeError("ZodSuccess");
        }
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then((result) => {
                payload.value = result.issues.length === 0;
                return payload;
            });
        }
        payload.value = result.issues.length === 0;
        return payload;
    };
});
const $ZodCatch = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodCatch", (inst, def) => {
    $ZodType.init(inst, def);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    _util_js__rspack_import_5.defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        // Forward direction (decode): apply catch logic
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then((result) => {
                payload.value = result.value;
                if (result.issues.length) {
                    payload.value = def.catchValue({
                        ...payload,
                        error: {
                            issues: result.issues.map((iss) => _util_js__rspack_import_5.finalizeIssue(iss, ctx, _core_js__rspack_import_1.config())),
                        },
                        input: payload.value,
                    });
                    payload.issues = [];
                }
                return payload;
            });
        }
        payload.value = result.value;
        if (result.issues.length) {
            payload.value = def.catchValue({
                ...payload,
                error: {
                    issues: result.issues.map((iss) => _util_js__rspack_import_5.finalizeIssue(iss, ctx, _core_js__rspack_import_1.config())),
                },
                input: payload.value,
            });
            payload.issues = [];
        }
        return payload;
    };
});
const $ZodNaN = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodNaN", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
        if (typeof payload.value !== "number" || !Number.isNaN(payload.value)) {
            payload.issues.push({
                input: payload.value,
                inst,
                expected: "nan",
                code: "invalid_type",
            });
            return payload;
        }
        return payload;
    };
});
const $ZodPipe = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodPipe", (inst, def) => {
    $ZodType.init(inst, def);
    _util_js__rspack_import_5.defineLazy(inst._zod, "values", () => def.in._zod.values);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optin", () => def.in._zod.optin);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optout", () => def.out._zod.optout);
    _util_js__rspack_import_5.defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            const right = def.out._zod.run(payload, ctx);
            if (right instanceof Promise) {
                return right.then((right) => handlePipeResult(right, def.in, ctx));
            }
            return handlePipeResult(right, def.in, ctx);
        }
        const left = def.in._zod.run(payload, ctx);
        if (left instanceof Promise) {
            return left.then((left) => handlePipeResult(left, def.out, ctx));
        }
        return handlePipeResult(left, def.out, ctx);
    };
});
function handlePipeResult(left, next, ctx) {
    if (left.issues.length) {
        // prevent further checks
        left.aborted = true;
        return left;
    }
    return next._zod.run({ value: left.value, issues: left.issues }, ctx);
}
const $ZodCodec = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodCodec", (inst, def) => {
    $ZodType.init(inst, def);
    _util_js__rspack_import_5.defineLazy(inst._zod, "values", () => def.in._zod.values);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optin", () => def.in._zod.optin);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optout", () => def.out._zod.optout);
    _util_js__rspack_import_5.defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
    inst._zod.parse = (payload, ctx) => {
        const direction = ctx.direction || "forward";
        if (direction === "forward") {
            const left = def.in._zod.run(payload, ctx);
            if (left instanceof Promise) {
                return left.then((left) => handleCodecAResult(left, def, ctx));
            }
            return handleCodecAResult(left, def, ctx);
        }
        else {
            const right = def.out._zod.run(payload, ctx);
            if (right instanceof Promise) {
                return right.then((right) => handleCodecAResult(right, def, ctx));
            }
            return handleCodecAResult(right, def, ctx);
        }
    };
});
function handleCodecAResult(result, def, ctx) {
    if (result.issues.length) {
        // prevent further checks
        result.aborted = true;
        return result;
    }
    const direction = ctx.direction || "forward";
    if (direction === "forward") {
        const transformed = def.transform(result.value, result);
        if (transformed instanceof Promise) {
            return transformed.then((value) => handleCodecTxResult(result, value, def.out, ctx));
        }
        return handleCodecTxResult(result, transformed, def.out, ctx);
    }
    else {
        const transformed = def.reverseTransform(result.value, result);
        if (transformed instanceof Promise) {
            return transformed.then((value) => handleCodecTxResult(result, value, def.in, ctx));
        }
        return handleCodecTxResult(result, transformed, def.in, ctx);
    }
}
function handleCodecTxResult(left, value, nextSchema, ctx) {
    // Check if transform added any issues
    if (left.issues.length) {
        left.aborted = true;
        return left;
    }
    return nextSchema._zod.run({ value, issues: left.issues }, ctx);
}
const $ZodReadonly = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodReadonly", (inst, def) => {
    $ZodType.init(inst, def);
    _util_js__rspack_import_5.defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
    _util_js__rspack_import_5.defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then(handleReadonlyResult);
        }
        return handleReadonlyResult(result);
    };
});
function handleReadonlyResult(payload) {
    payload.value = Object.freeze(payload.value);
    return payload;
}
const $ZodTemplateLiteral = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodTemplateLiteral", (inst, def) => {
    $ZodType.init(inst, def);
    const regexParts = [];
    for (const part of def.parts) {
        if (typeof part === "object" && part !== null) {
            // is Zod schema
            if (!part._zod.pattern) {
                // if (!source)
                throw new Error(`Invalid template literal part, no pattern found: ${[...part._zod.traits].shift()}`);
            }
            const source = part._zod.pattern instanceof RegExp ? part._zod.pattern.source : part._zod.pattern;
            if (!source)
                throw new Error(`Invalid template literal part: ${part._zod.traits}`);
            const start = source.startsWith("^") ? 1 : 0;
            const end = source.endsWith("$") ? source.length - 1 : source.length;
            regexParts.push(source.slice(start, end));
        }
        else if (part === null || _util_js__rspack_import_5.primitiveTypes.has(typeof part)) {
            regexParts.push(_util_js__rspack_import_5.escapeRegex(`${part}`));
        }
        else {
            throw new Error(`Invalid template literal part: ${part}`);
        }
    }
    inst._zod.pattern = new RegExp(`^${regexParts.join("")}$`);
    inst._zod.parse = (payload, _ctx) => {
        if (typeof payload.value !== "string") {
            payload.issues.push({
                input: payload.value,
                inst,
                expected: "string",
                code: "invalid_type",
            });
            return payload;
        }
        inst._zod.pattern.lastIndex = 0;
        if (!inst._zod.pattern.test(payload.value)) {
            payload.issues.push({
                input: payload.value,
                inst,
                code: "invalid_format",
                format: def.format ?? "template_literal",
                pattern: inst._zod.pattern.source,
            });
            return payload;
        }
        return payload;
    };
});
const $ZodFunction = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodFunction", (inst, def) => {
    $ZodType.init(inst, def);
    inst._def = def;
    inst._zod.def = def;
    inst.implement = (func) => {
        if (typeof func !== "function") {
            throw new Error("implement() must be called with a function");
        }
        return function (...args) {
            const parsedArgs = inst._def.input ? (0,_parse_js__rspack_import_3.parse)(inst._def.input, args) : args;
            const result = Reflect.apply(func, this, parsedArgs);
            if (inst._def.output) {
                return (0,_parse_js__rspack_import_3.parse)(inst._def.output, result);
            }
            return result;
        };
    };
    inst.implementAsync = (func) => {
        if (typeof func !== "function") {
            throw new Error("implementAsync() must be called with a function");
        }
        return async function (...args) {
            const parsedArgs = inst._def.input ? await (0,_parse_js__rspack_import_3.parseAsync)(inst._def.input, args) : args;
            const result = await Reflect.apply(func, this, parsedArgs);
            if (inst._def.output) {
                return await (0,_parse_js__rspack_import_3.parseAsync)(inst._def.output, result);
            }
            return result;
        };
    };
    inst._zod.parse = (payload, _ctx) => {
        if (typeof payload.value !== "function") {
            payload.issues.push({
                code: "invalid_type",
                expected: "function",
                input: payload.value,
                inst,
            });
            return payload;
        }
        // Check if output is a promise type to determine if we should use async implementation
        const hasPromiseOutput = inst._def.output && inst._def.output._zod.def.type === "promise";
        if (hasPromiseOutput) {
            payload.value = inst.implementAsync(payload.value);
        }
        else {
            payload.value = inst.implement(payload.value);
        }
        return payload;
    };
    inst.input = (...args) => {
        const F = inst.constructor;
        if (Array.isArray(args[0])) {
            return new F({
                type: "function",
                input: new $ZodTuple({
                    type: "tuple",
                    items: args[0],
                    rest: args[1],
                }),
                output: inst._def.output,
            });
        }
        return new F({
            type: "function",
            input: args[0],
            output: inst._def.output,
        });
    };
    inst.output = (output) => {
        const F = inst.constructor;
        return new F({
            type: "function",
            input: inst._def.input,
            output,
        });
    };
    return inst;
});
const $ZodPromise = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodPromise", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        return Promise.resolve(payload.value).then((inner) => def.innerType._zod.run({ value: inner, issues: [] }, ctx));
    };
});
const $ZodLazy = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodLazy", (inst, def) => {
    $ZodType.init(inst, def);
    // let _innerType!: any;
    // util.defineLazy(def, "getter", () => {
    //   if (!_innerType) {
    //     _innerType = def.getter();
    //   }
    //   return () => _innerType;
    // });
    _util_js__rspack_import_5.defineLazy(inst._zod, "innerType", () => def.getter());
    _util_js__rspack_import_5.defineLazy(inst._zod, "pattern", () => inst._zod.innerType?._zod?.pattern);
    _util_js__rspack_import_5.defineLazy(inst._zod, "propValues", () => inst._zod.innerType?._zod?.propValues);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optin", () => inst._zod.innerType?._zod?.optin ?? undefined);
    _util_js__rspack_import_5.defineLazy(inst._zod, "optout", () => inst._zod.innerType?._zod?.optout ?? undefined);
    inst._zod.parse = (payload, ctx) => {
        const inner = inst._zod.innerType;
        return inner._zod.run(payload, ctx);
    };
});
const $ZodCustom = /*@__PURE__*/ _core_js__rspack_import_1.$constructor("$ZodCustom", (inst, def) => {
    _checks_js__rspack_import_0.$ZodCheck.init(inst, def);
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _) => {
        return payload;
    };
    inst._zod.check = (payload) => {
        const input = payload.value;
        const r = def.fn(input);
        if (r instanceof Promise) {
            return r.then((r) => handleRefineResult(r, payload, input, inst));
        }
        handleRefineResult(r, payload, input, inst);
        return;
    };
});
function handleRefineResult(result, payload, input, inst) {
    if (!result) {
        const _iss = {
            code: "custom",
            input,
            inst, // incorporates params.error into issue reporting
            path: [...(inst._zod.def.path ?? [])], // incorporates params.error into issue reporting
            continue: !inst._zod.def.abort,
            // params: inst._zod.def.params,
        };
        if (inst._zod.def.params)
            _iss.params = inst._zod.def.params;
        payload.issues.push(_util_js__rspack_import_5.issue(_iss));
    }
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/to-json-schema.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  createStandardJSONSchemaMethod: () => (createStandardJSONSchemaMethod),
  createToJSONSchemaMethod: () => (createToJSONSchemaMethod),
  extractDefs: () => (extractDefs),
  finalize: () => (finalize),
  initializeContext: () => (initializeContext),
  process: () => (process)
});
/* import */ var _registries_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/registries.js");

// function initializeContext<T extends schemas.$ZodType>(inputs: JSONSchemaGeneratorParams<T>): ToJSONSchemaContext<T> {
//   return {
//     processor: inputs.processor,
//     metadataRegistry: inputs.metadata ?? globalRegistry,
//     target: inputs.target ?? "draft-2020-12",
//     unrepresentable: inputs.unrepresentable ?? "throw",
//   };
// }
function initializeContext(params) {
    // Normalize target: convert old non-hyphenated versions to hyphenated versions
    let target = params?.target ?? "draft-2020-12";
    if (target === "draft-4")
        target = "draft-04";
    if (target === "draft-7")
        target = "draft-07";
    return {
        processors: params.processors ?? {},
        metadataRegistry: params?.metadata ?? _registries_js__rspack_import_0.globalRegistry,
        target,
        unrepresentable: params?.unrepresentable ?? "throw",
        override: params?.override ?? (() => { }),
        io: params?.io ?? "output",
        counter: 0,
        seen: new Map(),
        cycles: params?.cycles ?? "ref",
        reused: params?.reused ?? "inline",
        external: params?.external ?? undefined,
    };
}
function process(schema, ctx, _params = { path: [], schemaPath: [] }) {
    var _a;
    const def = schema._zod.def;
    // check for schema in seens
    const seen = ctx.seen.get(schema);
    if (seen) {
        seen.count++;
        // check if cycle
        const isCycle = _params.schemaPath.includes(schema);
        if (isCycle) {
            seen.cycle = _params.path;
        }
        return seen.schema;
    }
    // initialize
    const result = { schema: {}, count: 1, cycle: undefined, path: _params.path };
    ctx.seen.set(schema, result);
    // custom method overrides default behavior
    const overrideSchema = schema._zod.toJSONSchema?.();
    if (overrideSchema) {
        result.schema = overrideSchema;
    }
    else {
        const params = {
            ..._params,
            schemaPath: [..._params.schemaPath, schema],
            path: _params.path,
        };
        if (schema._zod.processJSONSchema) {
            schema._zod.processJSONSchema(ctx, result.schema, params);
        }
        else {
            const _json = result.schema;
            const processor = ctx.processors[def.type];
            if (!processor) {
                throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
            }
            processor(schema, ctx, _json, params);
        }
        const parent = schema._zod.parent;
        if (parent) {
            // Also set ref if processor didn't (for inheritance)
            if (!result.ref)
                result.ref = parent;
            process(parent, ctx, params);
            ctx.seen.get(parent).isParent = true;
        }
    }
    // metadata
    const meta = ctx.metadataRegistry.get(schema);
    if (meta)
        Object.assign(result.schema, meta);
    if (ctx.io === "input" && isTransforming(schema)) {
        // examples/defaults only apply to output type of pipe
        delete result.schema.examples;
        delete result.schema.default;
    }
    // set prefault as default
    if (ctx.io === "input" && result.schema._prefault)
        (_a = result.schema).default ?? (_a.default = result.schema._prefault);
    delete result.schema._prefault;
    // pulling fresh from ctx.seen in case it was overwritten
    const _result = ctx.seen.get(schema);
    return _result.schema;
}
function extractDefs(ctx, schema
// params: EmitParams
) {
    // iterate over seen map;
    const root = ctx.seen.get(schema);
    if (!root)
        throw new Error("Unprocessed schema. This is a bug in Zod.");
    // Track ids to detect duplicates across different schemas
    const idToSchema = new Map();
    for (const entry of ctx.seen.entries()) {
        const id = ctx.metadataRegistry.get(entry[0])?.id;
        if (id) {
            const existing = idToSchema.get(id);
            if (existing && existing !== entry[0]) {
                throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
            }
            idToSchema.set(id, entry[0]);
        }
    }
    // returns a ref to the schema
    // defId will be empty if the ref points to an external schema (or #)
    const makeURI = (entry) => {
        // comparing the seen objects because sometimes
        // multiple schemas map to the same seen object.
        // e.g. lazy
        // external is configured
        const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
        if (ctx.external) {
            const externalId = ctx.external.registry.get(entry[0])?.id; // ?? "__shared";// `__schema${ctx.counter++}`;
            // check if schema is in the external registry
            const uriGenerator = ctx.external.uri ?? ((id) => id);
            if (externalId) {
                return { ref: uriGenerator(externalId) };
            }
            // otherwise, add to __shared
            const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
            entry[1].defId = id; // set defId so it will be reused if needed
            return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}` };
        }
        if (entry[1] === root) {
            return { ref: "#" };
        }
        // self-contained schema
        const uriPrefix = `#`;
        const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
        const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
        return { defId, ref: defUriPrefix + defId };
    };
    // stored cached version in `def` property
    // remove all properties, set $ref
    const extractToDef = (entry) => {
        // if the schema is already a reference, do not extract it
        if (entry[1].schema.$ref) {
            return;
        }
        const seen = entry[1];
        const { ref, defId } = makeURI(entry);
        seen.def = { ...seen.schema };
        // defId won't be set if the schema is a reference to an external schema
        // or if the schema is the root schema
        if (defId)
            seen.defId = defId;
        // wipe away all properties except $ref
        const schema = seen.schema;
        for (const key in schema) {
            delete schema[key];
        }
        schema.$ref = ref;
    };
    // throw on cycles
    // break cycles
    if (ctx.cycles === "throw") {
        for (const entry of ctx.seen.entries()) {
            const seen = entry[1];
            if (seen.cycle) {
                throw new Error("Cycle detected: " +
                    `#/${seen.cycle?.join("/")}/<root>` +
                    '\n\nSet the `cycles` parameter to `"ref"` to resolve cyclical schemas with defs.');
            }
        }
    }
    // extract schemas into $defs
    for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        // convert root schema to # $ref
        if (schema === entry[0]) {
            extractToDef(entry); // this has special handling for the root schema
            continue;
        }
        // extract schemas that are in the external registry
        if (ctx.external) {
            const ext = ctx.external.registry.get(entry[0])?.id;
            if (schema !== entry[0] && ext) {
                extractToDef(entry);
                continue;
            }
        }
        // extract schemas with `id` meta
        const id = ctx.metadataRegistry.get(entry[0])?.id;
        if (id) {
            extractToDef(entry);
            continue;
        }
        // break cycles
        if (seen.cycle) {
            // any
            extractToDef(entry);
            continue;
        }
        // extract reused schemas
        if (seen.count > 1) {
            if (ctx.reused === "ref") {
                extractToDef(entry);
                // biome-ignore lint:
                continue;
            }
        }
    }
}
function finalize(ctx, schema) {
    const root = ctx.seen.get(schema);
    if (!root)
        throw new Error("Unprocessed schema. This is a bug in Zod.");
    // flatten refs - inherit properties from parent schemas
    const flattenRef = (zodSchema) => {
        const seen = ctx.seen.get(zodSchema);
        // already processed
        if (seen.ref === null)
            return;
        const schema = seen.def ?? seen.schema;
        const _cached = { ...schema };
        const ref = seen.ref;
        seen.ref = null; // prevent infinite recursion
        if (ref) {
            flattenRef(ref);
            const refSeen = ctx.seen.get(ref);
            const refSchema = refSeen.schema;
            // merge referenced schema into current
            if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
                // older drafts can't combine $ref with other properties
                schema.allOf = schema.allOf ?? [];
                schema.allOf.push(refSchema);
            }
            else {
                Object.assign(schema, refSchema);
            }
            // restore child's own properties (child wins)
            Object.assign(schema, _cached);
            const isParentRef = zodSchema._zod.parent === ref;
            // For parent chain, child is a refinement - remove parent-only properties
            if (isParentRef) {
                for (const key in schema) {
                    if (key === "$ref" || key === "allOf")
                        continue;
                    if (!(key in _cached)) {
                        delete schema[key];
                    }
                }
            }
            // When ref was extracted to $defs, remove properties that match the definition
            if (refSchema.$ref) {
                for (const key in schema) {
                    if (key === "$ref" || key === "allOf")
                        continue;
                    if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) {
                        delete schema[key];
                    }
                }
            }
        }
        // If parent was extracted (has $ref), propagate $ref to this schema
        // This handles cases like: readonly().meta({id}).describe()
        // where processor sets ref to innerType but parent should be referenced
        const parent = zodSchema._zod.parent;
        if (parent && parent !== ref) {
            // Ensure parent is processed first so its def has inherited properties
            flattenRef(parent);
            const parentSeen = ctx.seen.get(parent);
            if (parentSeen?.schema.$ref) {
                schema.$ref = parentSeen.schema.$ref;
                // De-duplicate with parent's definition
                if (parentSeen.def) {
                    for (const key in schema) {
                        if (key === "$ref" || key === "allOf")
                            continue;
                        if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) {
                            delete schema[key];
                        }
                    }
                }
            }
        }
        // execute overrides
        ctx.override({
            zodSchema: zodSchema,
            jsonSchema: schema,
            path: seen.path ?? [],
        });
    };
    for (const entry of [...ctx.seen.entries()].reverse()) {
        flattenRef(entry[0]);
    }
    const result = {};
    if (ctx.target === "draft-2020-12") {
        result.$schema = "https://json-schema.org/draft/2020-12/schema";
    }
    else if (ctx.target === "draft-07") {
        result.$schema = "http://json-schema.org/draft-07/schema#";
    }
    else if (ctx.target === "draft-04") {
        result.$schema = "http://json-schema.org/draft-04/schema#";
    }
    else if (ctx.target === "openapi-3.0") {
        // OpenAPI 3.0 schema objects should not include a $schema property
    }
    else {
        // Arbitrary string values are allowed but won't have a $schema property set
    }
    if (ctx.external?.uri) {
        const id = ctx.external.registry.get(schema)?.id;
        if (!id)
            throw new Error("Schema is missing an `id` property");
        result.$id = ctx.external.uri(id);
    }
    Object.assign(result, root.def ?? root.schema);
    // build defs object
    const defs = ctx.external?.defs ?? {};
    for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        if (seen.def && seen.defId) {
            defs[seen.defId] = seen.def;
        }
    }
    // set definitions in result
    if (ctx.external) {
    }
    else {
        if (Object.keys(defs).length > 0) {
            if (ctx.target === "draft-2020-12") {
                result.$defs = defs;
            }
            else {
                result.definitions = defs;
            }
        }
    }
    try {
        // this "finalizes" this schema and ensures all cycles are removed
        // each call to finalize() is functionally independent
        // though the seen map is shared
        const finalized = JSON.parse(JSON.stringify(result));
        Object.defineProperty(finalized, "~standard", {
            value: {
                ...schema["~standard"],
                jsonSchema: {
                    input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
                    output: createStandardJSONSchemaMethod(schema, "output", ctx.processors),
                },
            },
            enumerable: false,
            writable: false,
        });
        return finalized;
    }
    catch (_err) {
        throw new Error("Error converting schema to JSON.");
    }
}
function isTransforming(_schema, _ctx) {
    const ctx = _ctx ?? { seen: new Set() };
    if (ctx.seen.has(_schema))
        return false;
    ctx.seen.add(_schema);
    const def = _schema._zod.def;
    if (def.type === "transform")
        return true;
    if (def.type === "array")
        return isTransforming(def.element, ctx);
    if (def.type === "set")
        return isTransforming(def.valueType, ctx);
    if (def.type === "lazy")
        return isTransforming(def.getter(), ctx);
    if (def.type === "promise" ||
        def.type === "optional" ||
        def.type === "nonoptional" ||
        def.type === "nullable" ||
        def.type === "readonly" ||
        def.type === "default" ||
        def.type === "prefault") {
        return isTransforming(def.innerType, ctx);
    }
    if (def.type === "intersection") {
        return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
    }
    if (def.type === "record" || def.type === "map") {
        return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
    }
    if (def.type === "pipe") {
        return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
    }
    if (def.type === "object") {
        for (const key in def.shape) {
            if (isTransforming(def.shape[key], ctx))
                return true;
        }
        return false;
    }
    if (def.type === "union") {
        for (const option of def.options) {
            if (isTransforming(option, ctx))
                return true;
        }
        return false;
    }
    if (def.type === "tuple") {
        for (const item of def.items) {
            if (isTransforming(item, ctx))
                return true;
        }
        if (def.rest && isTransforming(def.rest, ctx))
            return true;
        return false;
    }
    return false;
}
/**
 * Creates a toJSONSchema method for a schema instance.
 * This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
 */
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
    const ctx = initializeContext({ ...params, processors });
    process(schema, ctx);
    extractDefs(ctx, schema);
    return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
    const { libraryOptions, target } = params ?? {};
    const ctx = initializeContext({ ...(libraryOptions ?? {}), target, io, processors });
    process(schema, ctx);
    extractDefs(ctx, schema);
    return finalize(ctx, schema);
};


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  BIGINT_FORMAT_RANGES: () => (BIGINT_FORMAT_RANGES),
  Class: () => (Class),
  NUMBER_FORMAT_RANGES: () => (NUMBER_FORMAT_RANGES),
  aborted: () => (aborted),
  allowsEval: () => (allowsEval),
  assert: () => (assert),
  assertEqual: () => (assertEqual),
  assertIs: () => (assertIs),
  assertNever: () => (assertNever),
  assertNotEqual: () => (assertNotEqual),
  assignProp: () => (assignProp),
  base64ToUint8Array: () => (base64ToUint8Array),
  base64urlToUint8Array: () => (base64urlToUint8Array),
  cached: () => (cached),
  captureStackTrace: () => (captureStackTrace),
  cleanEnum: () => (cleanEnum),
  cleanRegex: () => (cleanRegex),
  clone: () => (clone),
  cloneDef: () => (cloneDef),
  createTransparentProxy: () => (createTransparentProxy),
  defineLazy: () => (defineLazy),
  esc: () => (esc),
  escapeRegex: () => (escapeRegex),
  extend: () => (extend),
  finalizeIssue: () => (finalizeIssue),
  floatSafeRemainder: () => (floatSafeRemainder),
  getElementAtPath: () => (getElementAtPath),
  getEnumValues: () => (getEnumValues),
  getLengthableOrigin: () => (getLengthableOrigin),
  getParsedType: () => (getParsedType),
  getSizableOrigin: () => (getSizableOrigin),
  hexToUint8Array: () => (hexToUint8Array),
  isObject: () => (isObject),
  isPlainObject: () => (isPlainObject),
  issue: () => (issue),
  joinValues: () => (joinValues),
  jsonStringifyReplacer: () => (jsonStringifyReplacer),
  merge: () => (merge),
  mergeDefs: () => (mergeDefs),
  normalizeParams: () => (normalizeParams),
  nullish: () => (nullish),
  numKeys: () => (numKeys),
  objectClone: () => (objectClone),
  omit: () => (omit),
  optionalKeys: () => (optionalKeys),
  parsedType: () => (parsedType),
  partial: () => (partial),
  pick: () => (pick),
  prefixIssues: () => (prefixIssues),
  primitiveTypes: () => (primitiveTypes),
  promiseAllObject: () => (promiseAllObject),
  propertyKeyTypes: () => (propertyKeyTypes),
  randomString: () => (randomString),
  required: () => (required),
  safeExtend: () => (safeExtend),
  shallowClone: () => (shallowClone),
  slugify: () => (slugify),
  stringifyPrimitive: () => (stringifyPrimitive),
  uint8ArrayToBase64: () => (uint8ArrayToBase64),
  uint8ArrayToBase64url: () => (uint8ArrayToBase64url),
  uint8ArrayToHex: () => (uint8ArrayToHex),
  unwrapMessage: () => (unwrapMessage)
});
// functions
function assertEqual(val) {
    return val;
}
function assertNotEqual(val) {
    return val;
}
function assertIs(_arg) { }
function assertNever(_x) {
    throw new Error("Unexpected value in exhaustive check");
}
function assert(_) { }
function getEnumValues(entries) {
    const numericValues = Object.values(entries).filter((v) => typeof v === "number");
    const values = Object.entries(entries)
        .filter(([k, _]) => numericValues.indexOf(+k) === -1)
        .map(([_, v]) => v);
    return values;
}
function joinValues(array, separator = "|") {
    return array.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
    if (typeof value === "bigint")
        return value.toString();
    return value;
}
function cached(getter) {
    const set = false;
    return {
        get value() {
            if (!set) {
                const value = getter();
                Object.defineProperty(this, "value", { value });
                return value;
            }
            throw new Error("cached value already set");
        },
    };
}
function nullish(input) {
    return input === null || input === undefined;
}
function cleanRegex(source) {
    const start = source.startsWith("^") ? 1 : 0;
    const end = source.endsWith("$") ? source.length - 1 : source.length;
    return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepString = step.toString();
    let stepDecCount = (stepString.split(".")[1] || "").length;
    if (stepDecCount === 0 && /\d?e-\d?/.test(stepString)) {
        const match = stepString.match(/\d?e-(\d?)/);
        if (match?.[1]) {
            stepDecCount = Number.parseInt(match[1]);
        }
    }
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return (valInt % stepInt) / 10 ** decCount;
}
const EVALUATING = Symbol("evaluating");
function defineLazy(object, key, getter) {
    let value = undefined;
    Object.defineProperty(object, key, {
        get() {
            if (value === EVALUATING) {
                // Circular reference detected, return undefined to break the cycle
                return undefined;
            }
            if (value === undefined) {
                value = EVALUATING;
                value = getter();
            }
            return value;
        },
        set(v) {
            Object.defineProperty(object, key, {
                value: v,
                // configurable: true,
            });
            // object[key] = v;
        },
        configurable: true,
    });
}
function objectClone(obj) {
    return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
}
function assignProp(target, prop, value) {
    Object.defineProperty(target, prop, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
    });
}
function mergeDefs(...defs) {
    const mergedDescriptors = {};
    for (const def of defs) {
        const descriptors = Object.getOwnPropertyDescriptors(def);
        Object.assign(mergedDescriptors, descriptors);
    }
    return Object.defineProperties({}, mergedDescriptors);
}
function cloneDef(schema) {
    return mergeDefs(schema._zod.def);
}
function getElementAtPath(obj, path) {
    if (!path)
        return obj;
    return path.reduce((acc, key) => acc?.[key], obj);
}
function promiseAllObject(promisesObj) {
    const keys = Object.keys(promisesObj);
    const promises = keys.map((key) => promisesObj[key]);
    return Promise.all(promises).then((results) => {
        const resolvedObj = {};
        for (let i = 0; i < keys.length; i++) {
            resolvedObj[keys[i]] = results[i];
        }
        return resolvedObj;
    });
}
function randomString(length = 10) {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    let str = "";
    for (let i = 0; i < length; i++) {
        str += chars[Math.floor(Math.random() * chars.length)];
    }
    return str;
}
function esc(str) {
    return JSON.stringify(str);
}
function slugify(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
const captureStackTrace = ("captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => { });
function isObject(data) {
    return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = cached(() => {
    // @ts-ignore
    if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
        return false;
    }
    try {
        const F = Function;
        new F("");
        return true;
    }
    catch (_) {
        return false;
    }
});
function isPlainObject(o) {
    if (isObject(o) === false)
        return false;
    // modified constructor
    const ctor = o.constructor;
    if (ctor === undefined)
        return true;
    if (typeof ctor !== "function")
        return true;
    // modified prototype
    const prot = ctor.prototype;
    if (isObject(prot) === false)
        return false;
    // ctor doesn't have static `isPrototypeOf`
    if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
        return false;
    }
    return true;
}
function shallowClone(o) {
    if (isPlainObject(o))
        return { ...o };
    if (Array.isArray(o))
        return [...o];
    return o;
}
function numKeys(data) {
    let keyCount = 0;
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            keyCount++;
        }
    }
    return keyCount;
}
const getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
        case "undefined":
            return "undefined";
        case "string":
            return "string";
        case "number":
            return Number.isNaN(data) ? "nan" : "number";
        case "boolean":
            return "boolean";
        case "function":
            return "function";
        case "bigint":
            return "bigint";
        case "symbol":
            return "symbol";
        case "object":
            if (Array.isArray(data)) {
                return "array";
            }
            if (data === null) {
                return "null";
            }
            if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
                return "promise";
            }
            if (typeof Map !== "undefined" && data instanceof Map) {
                return "map";
            }
            if (typeof Set !== "undefined" && data instanceof Set) {
                return "set";
            }
            if (typeof Date !== "undefined" && data instanceof Date) {
                return "date";
            }
            // @ts-ignore
            if (typeof File !== "undefined" && data instanceof File) {
                return "file";
            }
            return "object";
        default:
            throw new Error(`Unknown data type: ${t}`);
    }
};
const propertyKeyTypes = new Set(["string", "number", "symbol"]);
const primitiveTypes = new Set(["string", "number", "bigint", "boolean", "symbol", "undefined"]);
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// zod-specific utils
function clone(inst, def, params) {
    const cl = new inst._zod.constr(def ?? inst._zod.def);
    if (!def || params?.parent)
        cl._zod.parent = inst;
    return cl;
}
function normalizeParams(_params) {
    const params = _params;
    if (!params)
        return {};
    if (typeof params === "string")
        return { error: () => params };
    if (params?.message !== undefined) {
        if (params?.error !== undefined)
            throw new Error("Cannot specify both `message` and `error` params");
        params.error = params.message;
    }
    delete params.message;
    if (typeof params.error === "string")
        return { ...params, error: () => params.error };
    return params;
}
function createTransparentProxy(getter) {
    let target;
    return new Proxy({}, {
        get(_, prop, receiver) {
            target ?? (target = getter());
            return Reflect.get(target, prop, receiver);
        },
        set(_, prop, value, receiver) {
            target ?? (target = getter());
            return Reflect.set(target, prop, value, receiver);
        },
        has(_, prop) {
            target ?? (target = getter());
            return Reflect.has(target, prop);
        },
        deleteProperty(_, prop) {
            target ?? (target = getter());
            return Reflect.deleteProperty(target, prop);
        },
        ownKeys(_) {
            target ?? (target = getter());
            return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(_, prop) {
            target ?? (target = getter());
            return Reflect.getOwnPropertyDescriptor(target, prop);
        },
        defineProperty(_, prop, descriptor) {
            target ?? (target = getter());
            return Reflect.defineProperty(target, prop, descriptor);
        },
    });
}
function stringifyPrimitive(value) {
    if (typeof value === "bigint")
        return value.toString() + "n";
    if (typeof value === "string")
        return `"${value}"`;
    return `${value}`;
}
function optionalKeys(shape) {
    return Object.keys(shape).filter((k) => {
        return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
    });
}
const NUMBER_FORMAT_RANGES = {
    safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    int32: [-2147483648, 2147483647],
    uint32: [0, 4294967295],
    float32: [-3.4028234663852886e38, 3.4028234663852886e38],
    float64: [-Number.MAX_VALUE, Number.MAX_VALUE],
};
const BIGINT_FORMAT_RANGES = {
    int64: [/* @__PURE__*/ BigInt("-9223372036854775808"), /* @__PURE__*/ BigInt("9223372036854775807")],
    uint64: [/* @__PURE__*/ BigInt(0), /* @__PURE__*/ BigInt("18446744073709551615")],
};
function pick(schema, mask) {
    const currDef = schema._zod.def;
    const checks = currDef.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
        throw new Error(".pick() cannot be used on object schemas containing refinements");
    }
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const newShape = {};
            for (const key in mask) {
                if (!(key in currDef.shape)) {
                    throw new Error(`Unrecognized key: "${key}"`);
                }
                if (!mask[key])
                    continue;
                newShape[key] = currDef.shape[key];
            }
            assignProp(this, "shape", newShape); // self-caching
            return newShape;
        },
        checks: [],
    });
    return clone(schema, def);
}
function omit(schema, mask) {
    const currDef = schema._zod.def;
    const checks = currDef.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
        throw new Error(".omit() cannot be used on object schemas containing refinements");
    }
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const newShape = { ...schema._zod.def.shape };
            for (const key in mask) {
                if (!(key in currDef.shape)) {
                    throw new Error(`Unrecognized key: "${key}"`);
                }
                if (!mask[key])
                    continue;
                delete newShape[key];
            }
            assignProp(this, "shape", newShape); // self-caching
            return newShape;
        },
        checks: [],
    });
    return clone(schema, def);
}
function extend(schema, shape) {
    if (!isPlainObject(shape)) {
        throw new Error("Invalid input to extend: expected a plain object");
    }
    const checks = schema._zod.def.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
        // Only throw if new shape overlaps with existing shape
        // Use getOwnPropertyDescriptor to check key existence without accessing values
        const existingShape = schema._zod.def.shape;
        for (const key in shape) {
            if (Object.getOwnPropertyDescriptor(existingShape, key) !== undefined) {
                throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
            }
        }
    }
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const _shape = { ...schema._zod.def.shape, ...shape };
            assignProp(this, "shape", _shape); // self-caching
            return _shape;
        },
    });
    return clone(schema, def);
}
function safeExtend(schema, shape) {
    if (!isPlainObject(shape)) {
        throw new Error("Invalid input to safeExtend: expected a plain object");
    }
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const _shape = { ...schema._zod.def.shape, ...shape };
            assignProp(this, "shape", _shape); // self-caching
            return _shape;
        },
    });
    return clone(schema, def);
}
function merge(a, b) {
    const def = mergeDefs(a._zod.def, {
        get shape() {
            const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
            assignProp(this, "shape", _shape); // self-caching
            return _shape;
        },
        get catchall() {
            return b._zod.def.catchall;
        },
        checks: [], // delete existing checks
    });
    return clone(a, def);
}
function partial(Class, schema, mask) {
    const currDef = schema._zod.def;
    const checks = currDef.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
        throw new Error(".partial() cannot be used on object schemas containing refinements");
    }
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const oldShape = schema._zod.def.shape;
            const shape = { ...oldShape };
            if (mask) {
                for (const key in mask) {
                    if (!(key in oldShape)) {
                        throw new Error(`Unrecognized key: "${key}"`);
                    }
                    if (!mask[key])
                        continue;
                    // if (oldShape[key]!._zod.optin === "optional") continue;
                    shape[key] = Class
                        ? new Class({
                            type: "optional",
                            innerType: oldShape[key],
                        })
                        : oldShape[key];
                }
            }
            else {
                for (const key in oldShape) {
                    // if (oldShape[key]!._zod.optin === "optional") continue;
                    shape[key] = Class
                        ? new Class({
                            type: "optional",
                            innerType: oldShape[key],
                        })
                        : oldShape[key];
                }
            }
            assignProp(this, "shape", shape); // self-caching
            return shape;
        },
        checks: [],
    });
    return clone(schema, def);
}
function required(Class, schema, mask) {
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const oldShape = schema._zod.def.shape;
            const shape = { ...oldShape };
            if (mask) {
                for (const key in mask) {
                    if (!(key in shape)) {
                        throw new Error(`Unrecognized key: "${key}"`);
                    }
                    if (!mask[key])
                        continue;
                    // overwrite with non-optional
                    shape[key] = new Class({
                        type: "nonoptional",
                        innerType: oldShape[key],
                    });
                }
            }
            else {
                for (const key in oldShape) {
                    // overwrite with non-optional
                    shape[key] = new Class({
                        type: "nonoptional",
                        innerType: oldShape[key],
                    });
                }
            }
            assignProp(this, "shape", shape); // self-caching
            return shape;
        },
    });
    return clone(schema, def);
}
// invalid_type | too_big | too_small | invalid_format | not_multiple_of | unrecognized_keys | invalid_union | invalid_key | invalid_element | invalid_value | custom
function aborted(x, startIndex = 0) {
    if (x.aborted === true)
        return true;
    for (let i = startIndex; i < x.issues.length; i++) {
        if (x.issues[i]?.continue !== true) {
            return true;
        }
    }
    return false;
}
function prefixIssues(path, issues) {
    return issues.map((iss) => {
        var _a;
        (_a = iss).path ?? (_a.path = []);
        iss.path.unshift(path);
        return iss;
    });
}
function unwrapMessage(message) {
    return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config) {
    const full = { ...iss, path: iss.path ?? [] };
    // for backwards compatibility
    if (!iss.message) {
        const message = unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ??
            unwrapMessage(ctx?.error?.(iss)) ??
            unwrapMessage(config.customError?.(iss)) ??
            unwrapMessage(config.localeError?.(iss)) ??
            "Invalid input";
        full.message = message;
    }
    // delete (full as any).def;
    delete full.inst;
    delete full.continue;
    if (!ctx?.reportInput) {
        delete full.input;
    }
    return full;
}
function getSizableOrigin(input) {
    if (input instanceof Set)
        return "set";
    if (input instanceof Map)
        return "map";
    // @ts-ignore
    if (input instanceof File)
        return "file";
    return "unknown";
}
function getLengthableOrigin(input) {
    if (Array.isArray(input))
        return "array";
    if (typeof input === "string")
        return "string";
    return "unknown";
}
function parsedType(data) {
    const t = typeof data;
    switch (t) {
        case "number": {
            return Number.isNaN(data) ? "nan" : "number";
        }
        case "object": {
            if (data === null) {
                return "null";
            }
            if (Array.isArray(data)) {
                return "array";
            }
            const obj = data;
            if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) {
                return obj.constructor.name;
            }
        }
    }
    return t;
}
function issue(...args) {
    const [iss, input, inst] = args;
    if (typeof iss === "string") {
        return {
            message: iss,
            code: "custom",
            input,
            inst,
        };
    }
    return { ...iss };
}
function cleanEnum(obj) {
    return Object.entries(obj)
        .filter(([k, _]) => {
        // return true if NaN, meaning it's not a number, thus a string key
        return Number.isNaN(Number.parseInt(k, 10));
    })
        .map((el) => el[1]);
}
// Codec utility functions
function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
function uint8ArrayToBase64(bytes) {
    let binaryString = "";
    for (let i = 0; i < bytes.length; i++) {
        binaryString += String.fromCharCode(bytes[i]);
    }
    return btoa(binaryString);
}
function base64urlToUint8Array(base64url) {
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    return base64ToUint8Array(base64 + padding);
}
function uint8ArrayToBase64url(bytes) {
    return uint8ArrayToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function hexToUint8Array(hex) {
    const cleanHex = hex.replace(/^0x/, "");
    if (cleanHex.length % 2 !== 0) {
        throw new Error("Invalid hex string length");
    }
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
    }
    return bytes;
}
function uint8ArrayToHex(bytes) {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
// instanceof
class Class {
    constructor(..._args) { }
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/versions.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  version: () => (version)
});
const version = {
    major: 4,
    minor: 3,
    patch: 5,
};


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/index.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  $brand: () => (/* reexport safe */ _classic_index_js__rspack_import_0.$brand),
  $input: () => (/* reexport safe */ _classic_index_js__rspack_import_0.$input),
  $output: () => (/* reexport safe */ _classic_index_js__rspack_import_0.$output),
  NEVER: () => (/* reexport safe */ _classic_index_js__rspack_import_0.NEVER),
  TimePrecision: () => (/* reexport safe */ _classic_index_js__rspack_import_0.TimePrecision),
  ZodAny: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodAny),
  ZodArray: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodArray),
  ZodBase64: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodBase64),
  ZodBase64URL: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodBase64URL),
  ZodBigInt: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodBigInt),
  ZodBigIntFormat: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodBigIntFormat),
  ZodBoolean: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodBoolean),
  ZodCIDRv4: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodCIDRv4),
  ZodCIDRv6: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodCIDRv6),
  ZodCUID: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodCUID),
  ZodCUID2: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodCUID2),
  ZodCatch: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodCatch),
  ZodCodec: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodCodec),
  ZodCustom: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodCustom),
  ZodCustomStringFormat: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodCustomStringFormat),
  ZodDate: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodDate),
  ZodDefault: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodDefault),
  ZodDiscriminatedUnion: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodDiscriminatedUnion),
  ZodE164: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodE164),
  ZodEmail: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodEmail),
  ZodEmoji: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodEmoji),
  ZodEnum: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodEnum),
  ZodError: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodError),
  ZodExactOptional: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodExactOptional),
  ZodFile: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodFile),
  ZodFirstPartyTypeKind: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodFirstPartyTypeKind),
  ZodFunction: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodFunction),
  ZodGUID: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodGUID),
  ZodIPv4: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodIPv4),
  ZodIPv6: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodIPv6),
  ZodISODate: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodISODate),
  ZodISODateTime: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodISODateTime),
  ZodISODuration: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodISODuration),
  ZodISOTime: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodISOTime),
  ZodIntersection: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodIntersection),
  ZodIssueCode: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodIssueCode),
  ZodJWT: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodJWT),
  ZodKSUID: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodKSUID),
  ZodLazy: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodLazy),
  ZodLiteral: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodLiteral),
  ZodMAC: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodMAC),
  ZodMap: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodMap),
  ZodNaN: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodNaN),
  ZodNanoID: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodNanoID),
  ZodNever: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodNever),
  ZodNonOptional: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodNonOptional),
  ZodNull: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodNull),
  ZodNullable: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodNullable),
  ZodNumber: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodNumber),
  ZodNumberFormat: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodNumberFormat),
  ZodObject: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodObject),
  ZodOptional: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodOptional),
  ZodPipe: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodPipe),
  ZodPrefault: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodPrefault),
  ZodPromise: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodPromise),
  ZodReadonly: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodReadonly),
  ZodRealError: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodRealError),
  ZodRecord: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodRecord),
  ZodSet: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodSet),
  ZodString: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodString),
  ZodStringFormat: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodStringFormat),
  ZodSuccess: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodSuccess),
  ZodSymbol: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodSymbol),
  ZodTemplateLiteral: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodTemplateLiteral),
  ZodTransform: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodTransform),
  ZodTuple: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodTuple),
  ZodType: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodType),
  ZodULID: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodULID),
  ZodURL: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodURL),
  ZodUUID: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodUUID),
  ZodUndefined: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodUndefined),
  ZodUnion: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodUnion),
  ZodUnknown: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodUnknown),
  ZodVoid: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodVoid),
  ZodXID: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodXID),
  ZodXor: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ZodXor),
  _ZodString: () => (/* reexport safe */ _classic_index_js__rspack_import_0._ZodString),
  _default: () => (/* reexport safe */ _classic_index_js__rspack_import_0._default),
  _function: () => (/* reexport safe */ _classic_index_js__rspack_import_0._function),
  any: () => (/* reexport safe */ _classic_index_js__rspack_import_0.any),
  array: () => (/* reexport safe */ _classic_index_js__rspack_import_0.array),
  base64: () => (/* reexport safe */ _classic_index_js__rspack_import_0.base64),
  base64url: () => (/* reexport safe */ _classic_index_js__rspack_import_0.base64url),
  bigint: () => (/* reexport safe */ _classic_index_js__rspack_import_0.bigint),
  boolean: () => (/* reexport safe */ _classic_index_js__rspack_import_0.boolean),
  "catch": () => (/* reexport safe */ _classic_index_js__rspack_import_0["catch"]),
  check: () => (/* reexport safe */ _classic_index_js__rspack_import_0.check),
  cidrv4: () => (/* reexport safe */ _classic_index_js__rspack_import_0.cidrv4),
  cidrv6: () => (/* reexport safe */ _classic_index_js__rspack_import_0.cidrv6),
  clone: () => (/* reexport safe */ _classic_index_js__rspack_import_0.clone),
  codec: () => (/* reexport safe */ _classic_index_js__rspack_import_0.codec),
  coerce: () => (/* reexport safe */ _classic_index_js__rspack_import_0.coerce),
  config: () => (/* reexport safe */ _classic_index_js__rspack_import_0.config),
  core: () => (/* reexport safe */ _classic_index_js__rspack_import_0.core),
  cuid: () => (/* reexport safe */ _classic_index_js__rspack_import_0.cuid),
  cuid2: () => (/* reexport safe */ _classic_index_js__rspack_import_0.cuid2),
  custom: () => (/* reexport safe */ _classic_index_js__rspack_import_0.custom),
  date: () => (/* reexport safe */ _classic_index_js__rspack_import_0.date),
  decode: () => (/* reexport safe */ _classic_index_js__rspack_import_0.decode),
  decodeAsync: () => (/* reexport safe */ _classic_index_js__rspack_import_0.decodeAsync),
  "default": () => (__rspack_default_export),
  describe: () => (/* reexport safe */ _classic_index_js__rspack_import_0.describe),
  discriminatedUnion: () => (/* reexport safe */ _classic_index_js__rspack_import_0.discriminatedUnion),
  e164: () => (/* reexport safe */ _classic_index_js__rspack_import_0.e164),
  email: () => (/* reexport safe */ _classic_index_js__rspack_import_0.email),
  emoji: () => (/* reexport safe */ _classic_index_js__rspack_import_0.emoji),
  encode: () => (/* reexport safe */ _classic_index_js__rspack_import_0.encode),
  encodeAsync: () => (/* reexport safe */ _classic_index_js__rspack_import_0.encodeAsync),
  endsWith: () => (/* reexport safe */ _classic_index_js__rspack_import_0.endsWith),
  "enum": () => (/* reexport safe */ _classic_index_js__rspack_import_0["enum"]),
  exactOptional: () => (/* reexport safe */ _classic_index_js__rspack_import_0.exactOptional),
  file: () => (/* reexport safe */ _classic_index_js__rspack_import_0.file),
  flattenError: () => (/* reexport safe */ _classic_index_js__rspack_import_0.flattenError),
  float32: () => (/* reexport safe */ _classic_index_js__rspack_import_0.float32),
  float64: () => (/* reexport safe */ _classic_index_js__rspack_import_0.float64),
  formatError: () => (/* reexport safe */ _classic_index_js__rspack_import_0.formatError),
  fromJSONSchema: () => (/* reexport safe */ _classic_index_js__rspack_import_0.fromJSONSchema),
  "function": () => (/* reexport safe */ _classic_index_js__rspack_import_0["function"]),
  getErrorMap: () => (/* reexport safe */ _classic_index_js__rspack_import_0.getErrorMap),
  globalRegistry: () => (/* reexport safe */ _classic_index_js__rspack_import_0.globalRegistry),
  gt: () => (/* reexport safe */ _classic_index_js__rspack_import_0.gt),
  gte: () => (/* reexport safe */ _classic_index_js__rspack_import_0.gte),
  guid: () => (/* reexport safe */ _classic_index_js__rspack_import_0.guid),
  hash: () => (/* reexport safe */ _classic_index_js__rspack_import_0.hash),
  hex: () => (/* reexport safe */ _classic_index_js__rspack_import_0.hex),
  hostname: () => (/* reexport safe */ _classic_index_js__rspack_import_0.hostname),
  httpUrl: () => (/* reexport safe */ _classic_index_js__rspack_import_0.httpUrl),
  includes: () => (/* reexport safe */ _classic_index_js__rspack_import_0.includes),
  "instanceof": () => (/* reexport safe */ _classic_index_js__rspack_import_0["instanceof"]),
  int: () => (/* reexport safe */ _classic_index_js__rspack_import_0.int),
  int32: () => (/* reexport safe */ _classic_index_js__rspack_import_0.int32),
  int64: () => (/* reexport safe */ _classic_index_js__rspack_import_0.int64),
  intersection: () => (/* reexport safe */ _classic_index_js__rspack_import_0.intersection),
  ipv4: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ipv4),
  ipv6: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ipv6),
  iso: () => (/* reexport safe */ _classic_index_js__rspack_import_0.iso),
  json: () => (/* reexport safe */ _classic_index_js__rspack_import_0.json),
  jwt: () => (/* reexport safe */ _classic_index_js__rspack_import_0.jwt),
  keyof: () => (/* reexport safe */ _classic_index_js__rspack_import_0.keyof),
  ksuid: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ksuid),
  lazy: () => (/* reexport safe */ _classic_index_js__rspack_import_0.lazy),
  length: () => (/* reexport safe */ _classic_index_js__rspack_import_0.length),
  literal: () => (/* reexport safe */ _classic_index_js__rspack_import_0.literal),
  locales: () => (/* reexport safe */ _classic_index_js__rspack_import_0.locales),
  looseObject: () => (/* reexport safe */ _classic_index_js__rspack_import_0.looseObject),
  looseRecord: () => (/* reexport safe */ _classic_index_js__rspack_import_0.looseRecord),
  lowercase: () => (/* reexport safe */ _classic_index_js__rspack_import_0.lowercase),
  lt: () => (/* reexport safe */ _classic_index_js__rspack_import_0.lt),
  lte: () => (/* reexport safe */ _classic_index_js__rspack_import_0.lte),
  mac: () => (/* reexport safe */ _classic_index_js__rspack_import_0.mac),
  map: () => (/* reexport safe */ _classic_index_js__rspack_import_0.map),
  maxLength: () => (/* reexport safe */ _classic_index_js__rspack_import_0.maxLength),
  maxSize: () => (/* reexport safe */ _classic_index_js__rspack_import_0.maxSize),
  meta: () => (/* reexport safe */ _classic_index_js__rspack_import_0.meta),
  mime: () => (/* reexport safe */ _classic_index_js__rspack_import_0.mime),
  minLength: () => (/* reexport safe */ _classic_index_js__rspack_import_0.minLength),
  minSize: () => (/* reexport safe */ _classic_index_js__rspack_import_0.minSize),
  multipleOf: () => (/* reexport safe */ _classic_index_js__rspack_import_0.multipleOf),
  nan: () => (/* reexport safe */ _classic_index_js__rspack_import_0.nan),
  nanoid: () => (/* reexport safe */ _classic_index_js__rspack_import_0.nanoid),
  nativeEnum: () => (/* reexport safe */ _classic_index_js__rspack_import_0.nativeEnum),
  negative: () => (/* reexport safe */ _classic_index_js__rspack_import_0.negative),
  never: () => (/* reexport safe */ _classic_index_js__rspack_import_0.never),
  nonnegative: () => (/* reexport safe */ _classic_index_js__rspack_import_0.nonnegative),
  nonoptional: () => (/* reexport safe */ _classic_index_js__rspack_import_0.nonoptional),
  nonpositive: () => (/* reexport safe */ _classic_index_js__rspack_import_0.nonpositive),
  normalize: () => (/* reexport safe */ _classic_index_js__rspack_import_0.normalize),
  "null": () => (/* reexport safe */ _classic_index_js__rspack_import_0["null"]),
  nullable: () => (/* reexport safe */ _classic_index_js__rspack_import_0.nullable),
  nullish: () => (/* reexport safe */ _classic_index_js__rspack_import_0.nullish),
  number: () => (/* reexport safe */ _classic_index_js__rspack_import_0.number),
  object: () => (/* reexport safe */ _classic_index_js__rspack_import_0.object),
  optional: () => (/* reexport safe */ _classic_index_js__rspack_import_0.optional),
  overwrite: () => (/* reexport safe */ _classic_index_js__rspack_import_0.overwrite),
  parse: () => (/* reexport safe */ _classic_index_js__rspack_import_0.parse),
  parseAsync: () => (/* reexport safe */ _classic_index_js__rspack_import_0.parseAsync),
  partialRecord: () => (/* reexport safe */ _classic_index_js__rspack_import_0.partialRecord),
  pipe: () => (/* reexport safe */ _classic_index_js__rspack_import_0.pipe),
  positive: () => (/* reexport safe */ _classic_index_js__rspack_import_0.positive),
  prefault: () => (/* reexport safe */ _classic_index_js__rspack_import_0.prefault),
  preprocess: () => (/* reexport safe */ _classic_index_js__rspack_import_0.preprocess),
  prettifyError: () => (/* reexport safe */ _classic_index_js__rspack_import_0.prettifyError),
  promise: () => (/* reexport safe */ _classic_index_js__rspack_import_0.promise),
  property: () => (/* reexport safe */ _classic_index_js__rspack_import_0.property),
  readonly: () => (/* reexport safe */ _classic_index_js__rspack_import_0.readonly),
  record: () => (/* reexport safe */ _classic_index_js__rspack_import_0.record),
  refine: () => (/* reexport safe */ _classic_index_js__rspack_import_0.refine),
  regex: () => (/* reexport safe */ _classic_index_js__rspack_import_0.regex),
  regexes: () => (/* reexport safe */ _classic_index_js__rspack_import_0.regexes),
  registry: () => (/* reexport safe */ _classic_index_js__rspack_import_0.registry),
  safeDecode: () => (/* reexport safe */ _classic_index_js__rspack_import_0.safeDecode),
  safeDecodeAsync: () => (/* reexport safe */ _classic_index_js__rspack_import_0.safeDecodeAsync),
  safeEncode: () => (/* reexport safe */ _classic_index_js__rspack_import_0.safeEncode),
  safeEncodeAsync: () => (/* reexport safe */ _classic_index_js__rspack_import_0.safeEncodeAsync),
  safeParse: () => (/* reexport safe */ _classic_index_js__rspack_import_0.safeParse),
  safeParseAsync: () => (/* reexport safe */ _classic_index_js__rspack_import_0.safeParseAsync),
  set: () => (/* reexport safe */ _classic_index_js__rspack_import_0.set),
  setErrorMap: () => (/* reexport safe */ _classic_index_js__rspack_import_0.setErrorMap),
  size: () => (/* reexport safe */ _classic_index_js__rspack_import_0.size),
  slugify: () => (/* reexport safe */ _classic_index_js__rspack_import_0.slugify),
  startsWith: () => (/* reexport safe */ _classic_index_js__rspack_import_0.startsWith),
  strictObject: () => (/* reexport safe */ _classic_index_js__rspack_import_0.strictObject),
  string: () => (/* reexport safe */ _classic_index_js__rspack_import_0.string),
  stringFormat: () => (/* reexport safe */ _classic_index_js__rspack_import_0.stringFormat),
  stringbool: () => (/* reexport safe */ _classic_index_js__rspack_import_0.stringbool),
  success: () => (/* reexport safe */ _classic_index_js__rspack_import_0.success),
  superRefine: () => (/* reexport safe */ _classic_index_js__rspack_import_0.superRefine),
  symbol: () => (/* reexport safe */ _classic_index_js__rspack_import_0.symbol),
  templateLiteral: () => (/* reexport safe */ _classic_index_js__rspack_import_0.templateLiteral),
  toJSONSchema: () => (/* reexport safe */ _classic_index_js__rspack_import_0.toJSONSchema),
  toLowerCase: () => (/* reexport safe */ _classic_index_js__rspack_import_0.toLowerCase),
  toUpperCase: () => (/* reexport safe */ _classic_index_js__rspack_import_0.toUpperCase),
  transform: () => (/* reexport safe */ _classic_index_js__rspack_import_0.transform),
  treeifyError: () => (/* reexport safe */ _classic_index_js__rspack_import_0.treeifyError),
  trim: () => (/* reexport safe */ _classic_index_js__rspack_import_0.trim),
  tuple: () => (/* reexport safe */ _classic_index_js__rspack_import_0.tuple),
  uint32: () => (/* reexport safe */ _classic_index_js__rspack_import_0.uint32),
  uint64: () => (/* reexport safe */ _classic_index_js__rspack_import_0.uint64),
  ulid: () => (/* reexport safe */ _classic_index_js__rspack_import_0.ulid),
  undefined: () => (/* reexport safe */ _classic_index_js__rspack_import_0.undefined),
  union: () => (/* reexport safe */ _classic_index_js__rspack_import_0.union),
  unknown: () => (/* reexport safe */ _classic_index_js__rspack_import_0.unknown),
  uppercase: () => (/* reexport safe */ _classic_index_js__rspack_import_0.uppercase),
  url: () => (/* reexport safe */ _classic_index_js__rspack_import_0.url),
  util: () => (/* reexport safe */ _classic_index_js__rspack_import_0.util),
  uuid: () => (/* reexport safe */ _classic_index_js__rspack_import_0.uuid),
  uuidv4: () => (/* reexport safe */ _classic_index_js__rspack_import_0.uuidv4),
  uuidv6: () => (/* reexport safe */ _classic_index_js__rspack_import_0.uuidv6),
  uuidv7: () => (/* reexport safe */ _classic_index_js__rspack_import_0.uuidv7),
  "void": () => (/* reexport safe */ _classic_index_js__rspack_import_0["void"]),
  xid: () => (/* reexport safe */ _classic_index_js__rspack_import_0.xid),
  xor: () => (/* reexport safe */ _classic_index_js__rspack_import_0.xor),
  z: () => (/* reexport safe */ _classic_index_js__rspack_import_0.z)
});
/* import */ var _classic_index_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/classic/index.js");


/* export default */ const __rspack_default_export = (_classic_index_js__rspack_import_0["default"]);


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ar.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "حرف", verb: "أن يحوي" },
        file: { unit: "بايت", verb: "أن يحوي" },
        array: { unit: "عنصر", verb: "أن يحوي" },
        set: { unit: "عنصر", verb: "أن يحوي" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "مدخل",
        email: "بريد إلكتروني",
        url: "رابط",
        emoji: "إيموجي",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "تاريخ ووقت بمعيار ISO",
        date: "تاريخ بمعيار ISO",
        time: "وقت بمعيار ISO",
        duration: "مدة بمعيار ISO",
        ipv4: "عنوان IPv4",
        ipv6: "عنوان IPv6",
        cidrv4: "مدى عناوين بصيغة IPv4",
        cidrv6: "مدى عناوين بصيغة IPv6",
        base64: "نَص بترميز base64-encoded",
        base64url: "نَص بترميز base64url-encoded",
        json_string: "نَص على هيئة JSON",
        e164: "رقم هاتف بمعيار E.164",
        jwt: "JWT",
        template_literal: "مدخل",
    };
    const TypeDictionary = {
        nan: "NaN",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `مدخلات غير مقبولة: يفترض إدخال instanceof ${issue.expected}، ولكن تم إدخال ${received}`;
                }
                return `مدخلات غير مقبولة: يفترض إدخال ${expected}، ولكن تم إدخال ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `مدخلات غير مقبولة: يفترض إدخال ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `اختيار غير مقبول: يتوقع انتقاء أحد هذه الخيارات: ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return ` أكبر من اللازم: يفترض أن تكون ${issue.origin ?? "القيمة"} ${adj} ${issue.maximum.toString()} ${sizing.unit ?? "عنصر"}`;
                return `أكبر من اللازم: يفترض أن تكون ${issue.origin ?? "القيمة"} ${adj} ${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `أصغر من اللازم: يفترض لـ ${issue.origin} أن يكون ${adj} ${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `أصغر من اللازم: يفترض لـ ${issue.origin} أن يكون ${adj} ${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `نَص غير مقبول: يجب أن يبدأ بـ "${issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `نَص غير مقبول: يجب أن ينتهي بـ "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `نَص غير مقبول: يجب أن يتضمَّن "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `نَص غير مقبول: يجب أن يطابق النمط ${_issue.pattern}`;
                return `${FormatDictionary[_issue.format] ?? issue.format} غير مقبول`;
            }
            case "not_multiple_of":
                return `رقم غير مقبول: يجب أن يكون من مضاعفات ${issue.divisor}`;
            case "unrecognized_keys":
                return `معرف${issue.keys.length > 1 ? "ات" : ""} غريب${issue.keys.length > 1 ? "ة" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, "، ")}`;
            case "invalid_key":
                return `معرف غير مقبول في ${issue.origin}`;
            case "invalid_union":
                return "مدخل غير مقبول";
            case "invalid_element":
                return `مدخل غير مقبول في ${issue.origin}`;
            default:
                return "مدخل غير مقبول";
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/az.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "simvol", verb: "olmalıdır" },
        file: { unit: "bayt", verb: "olmalıdır" },
        array: { unit: "element", verb: "olmalıdır" },
        set: { unit: "element", verb: "olmalıdır" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "input",
        email: "email address",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO datetime",
        date: "ISO date",
        time: "ISO time",
        duration: "ISO duration",
        ipv4: "IPv4 address",
        ipv6: "IPv6 address",
        cidrv4: "IPv4 range",
        cidrv6: "IPv6 range",
        base64: "base64-encoded string",
        base64url: "base64url-encoded string",
        json_string: "JSON string",
        e164: "E.164 number",
        jwt: "JWT",
        template_literal: "input",
    };
    const TypeDictionary = {
        nan: "NaN",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Yanlış dəyər: gözlənilən instanceof ${issue.expected}, daxil olan ${received}`;
                }
                return `Yanlış dəyər: gözlənilən ${expected}, daxil olan ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Yanlış dəyər: gözlənilən ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Yanlış seçim: aşağıdakılardan biri olmalıdır: ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Çox böyük: gözlənilən ${issue.origin ?? "dəyər"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "element"}`;
                return `Çox böyük: gözlənilən ${issue.origin ?? "dəyər"} ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Çox kiçik: gözlənilən ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                return `Çox kiçik: gözlənilən ${issue.origin} ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Yanlış mətn: "${_issue.prefix}" ilə başlamalıdır`;
                if (_issue.format === "ends_with")
                    return `Yanlış mətn: "${_issue.suffix}" ilə bitməlidir`;
                if (_issue.format === "includes")
                    return `Yanlış mətn: "${_issue.includes}" daxil olmalıdır`;
                if (_issue.format === "regex")
                    return `Yanlış mətn: ${_issue.pattern} şablonuna uyğun olmalıdır`;
                return `Yanlış ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Yanlış ədəd: ${issue.divisor} ilə bölünə bilən olmalıdır`;
            case "unrecognized_keys":
                return `Tanınmayan açar${issue.keys.length > 1 ? "lar" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `${issue.origin} daxilində yanlış açar`;
            case "invalid_union":
                return "Yanlış dəyər";
            case "invalid_element":
                return `${issue.origin} daxilində yanlış dəyər`;
            default:
                return `Yanlış dəyər`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/be.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

function getBelarusianPlural(count, one, few, many) {
    const absCount = Math.abs(count);
    const lastDigit = absCount % 10;
    const lastTwoDigits = absCount % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
        return many;
    }
    if (lastDigit === 1) {
        return one;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
        return few;
    }
    return many;
}
const error = () => {
    const Sizable = {
        string: {
            unit: {
                one: "сімвал",
                few: "сімвалы",
                many: "сімвалаў",
            },
            verb: "мець",
        },
        array: {
            unit: {
                one: "элемент",
                few: "элементы",
                many: "элементаў",
            },
            verb: "мець",
        },
        set: {
            unit: {
                one: "элемент",
                few: "элементы",
                many: "элементаў",
            },
            verb: "мець",
        },
        file: {
            unit: {
                one: "байт",
                few: "байты",
                many: "байтаў",
            },
            verb: "мець",
        },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "увод",
        email: "email адрас",
        url: "URL",
        emoji: "эмодзі",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO дата і час",
        date: "ISO дата",
        time: "ISO час",
        duration: "ISO працягласць",
        ipv4: "IPv4 адрас",
        ipv6: "IPv6 адрас",
        cidrv4: "IPv4 дыяпазон",
        cidrv6: "IPv6 дыяпазон",
        base64: "радок у фармаце base64",
        base64url: "радок у фармаце base64url",
        json_string: "JSON радок",
        e164: "нумар E.164",
        jwt: "JWT",
        template_literal: "увод",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "лік",
        array: "масіў",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Няправільны ўвод: чакаўся instanceof ${issue.expected}, атрымана ${received}`;
                }
                return `Няправільны ўвод: чакаўся ${expected}, атрымана ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Няправільны ўвод: чакалася ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Няправільны варыянт: чакаўся адзін з ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    const maxValue = Number(issue.maximum);
                    const unit = getBelarusianPlural(maxValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
                    return `Занадта вялікі: чакалася, што ${issue.origin ?? "значэнне"} павінна ${sizing.verb} ${adj}${issue.maximum.toString()} ${unit}`;
                }
                return `Занадта вялікі: чакалася, што ${issue.origin ?? "значэнне"} павінна быць ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    const minValue = Number(issue.minimum);
                    const unit = getBelarusianPlural(minValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
                    return `Занадта малы: чакалася, што ${issue.origin} павінна ${sizing.verb} ${adj}${issue.minimum.toString()} ${unit}`;
                }
                return `Занадта малы: чакалася, што ${issue.origin} павінна быць ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Няправільны радок: павінен пачынацца з "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Няправільны радок: павінен заканчвацца на "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Няправільны радок: павінен змяшчаць "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Няправільны радок: павінен адпавядаць шаблону ${_issue.pattern}`;
                return `Няправільны ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Няправільны лік: павінен быць кратным ${issue.divisor}`;
            case "unrecognized_keys":
                return `Нераспазнаны ${issue.keys.length > 1 ? "ключы" : "ключ"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Няправільны ключ у ${issue.origin}`;
            case "invalid_union":
                return "Няправільны ўвод";
            case "invalid_element":
                return `Няправільнае значэнне ў ${issue.origin}`;
            default:
                return `Няправільны ўвод`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/bg.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "символа", verb: "да съдържа" },
        file: { unit: "байта", verb: "да съдържа" },
        array: { unit: "елемента", verb: "да съдържа" },
        set: { unit: "елемента", verb: "да съдържа" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "вход",
        email: "имейл адрес",
        url: "URL",
        emoji: "емоджи",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO време",
        date: "ISO дата",
        time: "ISO време",
        duration: "ISO продължителност",
        ipv4: "IPv4 адрес",
        ipv6: "IPv6 адрес",
        cidrv4: "IPv4 диапазон",
        cidrv6: "IPv6 диапазон",
        base64: "base64-кодиран низ",
        base64url: "base64url-кодиран низ",
        json_string: "JSON низ",
        e164: "E.164 номер",
        jwt: "JWT",
        template_literal: "вход",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "число",
        array: "масив",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Невалиден вход: очакван instanceof ${issue.expected}, получен ${received}`;
                }
                return `Невалиден вход: очакван ${expected}, получен ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Невалиден вход: очакван ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Невалидна опция: очаквано едно от ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Твърде голямо: очаква се ${issue.origin ?? "стойност"} да съдържа ${adj}${issue.maximum.toString()} ${sizing.unit ?? "елемента"}`;
                return `Твърде голямо: очаква се ${issue.origin ?? "стойност"} да бъде ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Твърде малко: очаква се ${issue.origin} да съдържа ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Твърде малко: очаква се ${issue.origin} да бъде ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `Невалиден низ: трябва да започва с "${_issue.prefix}"`;
                }
                if (_issue.format === "ends_with")
                    return `Невалиден низ: трябва да завършва с "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Невалиден низ: трябва да включва "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Невалиден низ: трябва да съвпада с ${_issue.pattern}`;
                let invalid_adj = "Невалиден";
                if (_issue.format === "emoji")
                    invalid_adj = "Невалидно";
                if (_issue.format === "datetime")
                    invalid_adj = "Невалидно";
                if (_issue.format === "date")
                    invalid_adj = "Невалидна";
                if (_issue.format === "time")
                    invalid_adj = "Невалидно";
                if (_issue.format === "duration")
                    invalid_adj = "Невалидна";
                return `${invalid_adj} ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Невалидно число: трябва да бъде кратно на ${issue.divisor}`;
            case "unrecognized_keys":
                return `Неразпознат${issue.keys.length > 1 ? "и" : ""} ключ${issue.keys.length > 1 ? "ове" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Невалиден ключ в ${issue.origin}`;
            case "invalid_union":
                return "Невалиден вход";
            case "invalid_element":
                return `Невалидна стойност в ${issue.origin}`;
            default:
                return `Невалиден вход`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ca.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "caràcters", verb: "contenir" },
        file: { unit: "bytes", verb: "contenir" },
        array: { unit: "elements", verb: "contenir" },
        set: { unit: "elements", verb: "contenir" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "entrada",
        email: "adreça electrònica",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "data i hora ISO",
        date: "data ISO",
        time: "hora ISO",
        duration: "durada ISO",
        ipv4: "adreça IPv4",
        ipv6: "adreça IPv6",
        cidrv4: "rang IPv4",
        cidrv6: "rang IPv6",
        base64: "cadena codificada en base64",
        base64url: "cadena codificada en base64url",
        json_string: "cadena JSON",
        e164: "número E.164",
        jwt: "JWT",
        template_literal: "entrada",
    };
    const TypeDictionary = {
        nan: "NaN",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Tipus invàlid: s'esperava instanceof ${issue.expected}, s'ha rebut ${received}`;
                }
                return `Tipus invàlid: s'esperava ${expected}, s'ha rebut ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Valor invàlid: s'esperava ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Opció invàlida: s'esperava una de ${_core_util_js__rspack_import_0.joinValues(issue.values, " o ")}`;
            case "too_big": {
                const adj = issue.inclusive ? "com a màxim" : "menys de";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Massa gran: s'esperava que ${issue.origin ?? "el valor"} contingués ${adj} ${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
                return `Massa gran: s'esperava que ${issue.origin ?? "el valor"} fos ${adj} ${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? "com a mínim" : "més de";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Massa petit: s'esperava que ${issue.origin} contingués ${adj} ${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Massa petit: s'esperava que ${issue.origin} fos ${adj} ${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `Format invàlid: ha de començar amb "${_issue.prefix}"`;
                }
                if (_issue.format === "ends_with")
                    return `Format invàlid: ha d'acabar amb "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Format invàlid: ha d'incloure "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Format invàlid: ha de coincidir amb el patró ${_issue.pattern}`;
                return `Format invàlid per a ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Número invàlid: ha de ser múltiple de ${issue.divisor}`;
            case "unrecognized_keys":
                return `Clau${issue.keys.length > 1 ? "s" : ""} no reconeguda${issue.keys.length > 1 ? "s" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Clau invàlida a ${issue.origin}`;
            case "invalid_union":
                return "Entrada invàlida"; // Could also be "Tipus d'unió invàlid" but "Entrada invàlida" is more general
            case "invalid_element":
                return `Element invàlid a ${issue.origin}`;
            default:
                return `Entrada invàlida`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/cs.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "znaků", verb: "mít" },
        file: { unit: "bajtů", verb: "mít" },
        array: { unit: "prvků", verb: "mít" },
        set: { unit: "prvků", verb: "mít" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "regulární výraz",
        email: "e-mailová adresa",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "datum a čas ve formátu ISO",
        date: "datum ve formátu ISO",
        time: "čas ve formátu ISO",
        duration: "doba trvání ISO",
        ipv4: "IPv4 adresa",
        ipv6: "IPv6 adresa",
        cidrv4: "rozsah IPv4",
        cidrv6: "rozsah IPv6",
        base64: "řetězec zakódovaný ve formátu base64",
        base64url: "řetězec zakódovaný ve formátu base64url",
        json_string: "řetězec ve formátu JSON",
        e164: "číslo E.164",
        jwt: "JWT",
        template_literal: "vstup",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "číslo",
        string: "řetězec",
        function: "funkce",
        array: "pole",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Neplatný vstup: očekáváno instanceof ${issue.expected}, obdrženo ${received}`;
                }
                return `Neplatný vstup: očekáváno ${expected}, obdrženo ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Neplatný vstup: očekáváno ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Neplatná možnost: očekávána jedna z hodnot ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Hodnota je příliš velká: ${issue.origin ?? "hodnota"} musí mít ${adj}${issue.maximum.toString()} ${sizing.unit ?? "prvků"}`;
                }
                return `Hodnota je příliš velká: ${issue.origin ?? "hodnota"} musí být ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Hodnota je příliš malá: ${issue.origin ?? "hodnota"} musí mít ${adj}${issue.minimum.toString()} ${sizing.unit ?? "prvků"}`;
                }
                return `Hodnota je příliš malá: ${issue.origin ?? "hodnota"} musí být ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Neplatný řetězec: musí začínat na "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Neplatný řetězec: musí končit na "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Neplatný řetězec: musí obsahovat "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Neplatný řetězec: musí odpovídat vzoru ${_issue.pattern}`;
                return `Neplatný formát ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Neplatné číslo: musí být násobkem ${issue.divisor}`;
            case "unrecognized_keys":
                return `Neznámé klíče: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Neplatný klíč v ${issue.origin}`;
            case "invalid_union":
                return "Neplatný vstup";
            case "invalid_element":
                return `Neplatná hodnota v ${issue.origin}`;
            default:
                return `Neplatný vstup`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/da.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "tegn", verb: "havde" },
        file: { unit: "bytes", verb: "havde" },
        array: { unit: "elementer", verb: "indeholdt" },
        set: { unit: "elementer", verb: "indeholdt" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "input",
        email: "e-mailadresse",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO dato- og klokkeslæt",
        date: "ISO-dato",
        time: "ISO-klokkeslæt",
        duration: "ISO-varighed",
        ipv4: "IPv4-område",
        ipv6: "IPv6-område",
        cidrv4: "IPv4-spektrum",
        cidrv6: "IPv6-spektrum",
        base64: "base64-kodet streng",
        base64url: "base64url-kodet streng",
        json_string: "JSON-streng",
        e164: "E.164-nummer",
        jwt: "JWT",
        template_literal: "input",
    };
    const TypeDictionary = {
        nan: "NaN",
        string: "streng",
        number: "tal",
        boolean: "boolean",
        array: "liste",
        object: "objekt",
        set: "sæt",
        file: "fil",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Ugyldigt input: forventede instanceof ${issue.expected}, fik ${received}`;
                }
                return `Ugyldigt input: forventede ${expected}, fik ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Ugyldig værdi: forventede ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Ugyldigt valg: forventede en af følgende ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                const origin = TypeDictionary[issue.origin] ?? issue.origin;
                if (sizing)
                    return `For stor: forventede ${origin ?? "value"} ${sizing.verb} ${adj} ${issue.maximum.toString()} ${sizing.unit ?? "elementer"}`;
                return `For stor: forventede ${origin ?? "value"} havde ${adj} ${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                const origin = TypeDictionary[issue.origin] ?? issue.origin;
                if (sizing) {
                    return `For lille: forventede ${origin} ${sizing.verb} ${adj} ${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `For lille: forventede ${origin} havde ${adj} ${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Ugyldig streng: skal starte med "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Ugyldig streng: skal ende med "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Ugyldig streng: skal indeholde "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Ugyldig streng: skal matche mønsteret ${_issue.pattern}`;
                return `Ugyldig ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Ugyldigt tal: skal være deleligt med ${issue.divisor}`;
            case "unrecognized_keys":
                return `${issue.keys.length > 1 ? "Ukendte nøgler" : "Ukendt nøgle"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Ugyldig nøgle i ${issue.origin}`;
            case "invalid_union":
                return "Ugyldigt input: matcher ingen af de tilladte typer";
            case "invalid_element":
                return `Ugyldig værdi i ${issue.origin}`;
            default:
                return `Ugyldigt input`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/de.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "Zeichen", verb: "zu haben" },
        file: { unit: "Bytes", verb: "zu haben" },
        array: { unit: "Elemente", verb: "zu haben" },
        set: { unit: "Elemente", verb: "zu haben" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "Eingabe",
        email: "E-Mail-Adresse",
        url: "URL",
        emoji: "Emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO-Datum und -Uhrzeit",
        date: "ISO-Datum",
        time: "ISO-Uhrzeit",
        duration: "ISO-Dauer",
        ipv4: "IPv4-Adresse",
        ipv6: "IPv6-Adresse",
        cidrv4: "IPv4-Bereich",
        cidrv6: "IPv6-Bereich",
        base64: "Base64-codierter String",
        base64url: "Base64-URL-codierter String",
        json_string: "JSON-String",
        e164: "E.164-Nummer",
        jwt: "JWT",
        template_literal: "Eingabe",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "Zahl",
        array: "Array",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Ungültige Eingabe: erwartet instanceof ${issue.expected}, erhalten ${received}`;
                }
                return `Ungültige Eingabe: erwartet ${expected}, erhalten ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Ungültige Eingabe: erwartet ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Ungültige Option: erwartet eine von ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Zu groß: erwartet, dass ${issue.origin ?? "Wert"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "Elemente"} hat`;
                return `Zu groß: erwartet, dass ${issue.origin ?? "Wert"} ${adj}${issue.maximum.toString()} ist`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Zu klein: erwartet, dass ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit} hat`;
                }
                return `Zu klein: erwartet, dass ${issue.origin} ${adj}${issue.minimum.toString()} ist`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Ungültiger String: muss mit "${_issue.prefix}" beginnen`;
                if (_issue.format === "ends_with")
                    return `Ungültiger String: muss mit "${_issue.suffix}" enden`;
                if (_issue.format === "includes")
                    return `Ungültiger String: muss "${_issue.includes}" enthalten`;
                if (_issue.format === "regex")
                    return `Ungültiger String: muss dem Muster ${_issue.pattern} entsprechen`;
                return `Ungültig: ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Ungültige Zahl: muss ein Vielfaches von ${issue.divisor} sein`;
            case "unrecognized_keys":
                return `${issue.keys.length > 1 ? "Unbekannte Schlüssel" : "Unbekannter Schlüssel"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Ungültiger Schlüssel in ${issue.origin}`;
            case "invalid_union":
                return "Ungültige Eingabe";
            case "invalid_element":
                return `Ungültiger Wert in ${issue.origin}`;
            default:
                return `Ungültige Eingabe`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/en.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "characters", verb: "to have" },
        file: { unit: "bytes", verb: "to have" },
        array: { unit: "items", verb: "to have" },
        set: { unit: "items", verb: "to have" },
        map: { unit: "entries", verb: "to have" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "input",
        email: "email address",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO datetime",
        date: "ISO date",
        time: "ISO time",
        duration: "ISO duration",
        ipv4: "IPv4 address",
        ipv6: "IPv6 address",
        mac: "MAC address",
        cidrv4: "IPv4 range",
        cidrv6: "IPv6 range",
        base64: "base64-encoded string",
        base64url: "base64url-encoded string",
        json_string: "JSON string",
        e164: "E.164 number",
        jwt: "JWT",
        template_literal: "input",
    };
    // type names: missing keys = do not translate (use raw value via ?? fallback)
    const TypeDictionary = {
        // Compatibility: "nan" -> "NaN" for display
        nan: "NaN",
        // All other type names omitted - they fall back to raw values via ?? operator
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                return `Invalid input: expected ${expected}, received ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Invalid input: expected ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Invalid option: expected one of ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
                return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `Invalid string: must start with "${_issue.prefix}"`;
                }
                if (_issue.format === "ends_with")
                    return `Invalid string: must end with "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Invalid string: must include "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Invalid string: must match pattern ${_issue.pattern}`;
                return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Invalid number: must be a multiple of ${issue.divisor}`;
            case "unrecognized_keys":
                return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Invalid key in ${issue.origin}`;
            case "invalid_union":
                return "Invalid input";
            case "invalid_element":
                return `Invalid value in ${issue.origin}`;
            default:
                return `Invalid input`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/eo.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "karaktrojn", verb: "havi" },
        file: { unit: "bajtojn", verb: "havi" },
        array: { unit: "elementojn", verb: "havi" },
        set: { unit: "elementojn", verb: "havi" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "enigo",
        email: "retadreso",
        url: "URL",
        emoji: "emoĝio",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO-datotempo",
        date: "ISO-dato",
        time: "ISO-tempo",
        duration: "ISO-daŭro",
        ipv4: "IPv4-adreso",
        ipv6: "IPv6-adreso",
        cidrv4: "IPv4-rango",
        cidrv6: "IPv6-rango",
        base64: "64-ume kodita karaktraro",
        base64url: "URL-64-ume kodita karaktraro",
        json_string: "JSON-karaktraro",
        e164: "E.164-nombro",
        jwt: "JWT",
        template_literal: "enigo",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "nombro",
        array: "tabelo",
        null: "senvalora",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Nevalida enigo: atendiĝis instanceof ${issue.expected}, riceviĝis ${received}`;
                }
                return `Nevalida enigo: atendiĝis ${expected}, riceviĝis ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Nevalida enigo: atendiĝis ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Nevalida opcio: atendiĝis unu el ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Tro granda: atendiĝis ke ${issue.origin ?? "valoro"} havu ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementojn"}`;
                return `Tro granda: atendiĝis ke ${issue.origin ?? "valoro"} havu ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Tro malgranda: atendiĝis ke ${issue.origin} havu ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Tro malgranda: atendiĝis ke ${issue.origin} estu ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Nevalida karaktraro: devas komenciĝi per "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Nevalida karaktraro: devas finiĝi per "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Nevalida karaktraro: devas inkluzivi "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Nevalida karaktraro: devas kongrui kun la modelo ${_issue.pattern}`;
                return `Nevalida ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Nevalida nombro: devas esti oblo de ${issue.divisor}`;
            case "unrecognized_keys":
                return `Nekonata${issue.keys.length > 1 ? "j" : ""} ŝlosilo${issue.keys.length > 1 ? "j" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Nevalida ŝlosilo en ${issue.origin}`;
            case "invalid_union":
                return "Nevalida enigo";
            case "invalid_element":
                return `Nevalida valoro en ${issue.origin}`;
            default:
                return `Nevalida enigo`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/es.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "caracteres", verb: "tener" },
        file: { unit: "bytes", verb: "tener" },
        array: { unit: "elementos", verb: "tener" },
        set: { unit: "elementos", verb: "tener" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "entrada",
        email: "dirección de correo electrónico",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "fecha y hora ISO",
        date: "fecha ISO",
        time: "hora ISO",
        duration: "duración ISO",
        ipv4: "dirección IPv4",
        ipv6: "dirección IPv6",
        cidrv4: "rango IPv4",
        cidrv6: "rango IPv6",
        base64: "cadena codificada en base64",
        base64url: "URL codificada en base64",
        json_string: "cadena JSON",
        e164: "número E.164",
        jwt: "JWT",
        template_literal: "entrada",
    };
    const TypeDictionary = {
        nan: "NaN",
        string: "texto",
        number: "número",
        boolean: "booleano",
        array: "arreglo",
        object: "objeto",
        set: "conjunto",
        file: "archivo",
        date: "fecha",
        bigint: "número grande",
        symbol: "símbolo",
        undefined: "indefinido",
        null: "nulo",
        function: "función",
        map: "mapa",
        record: "registro",
        tuple: "tupla",
        enum: "enumeración",
        union: "unión",
        literal: "literal",
        promise: "promesa",
        void: "vacío",
        never: "nunca",
        unknown: "desconocido",
        any: "cualquiera",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Entrada inválida: se esperaba instanceof ${issue.expected}, recibido ${received}`;
                }
                return `Entrada inválida: se esperaba ${expected}, recibido ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Entrada inválida: se esperaba ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Opción inválida: se esperaba una de ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                const origin = TypeDictionary[issue.origin] ?? issue.origin;
                if (sizing)
                    return `Demasiado grande: se esperaba que ${origin ?? "valor"} tuviera ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementos"}`;
                return `Demasiado grande: se esperaba que ${origin ?? "valor"} fuera ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                const origin = TypeDictionary[issue.origin] ?? issue.origin;
                if (sizing) {
                    return `Demasiado pequeño: se esperaba que ${origin} tuviera ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Demasiado pequeño: se esperaba que ${origin} fuera ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Cadena inválida: debe comenzar con "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Cadena inválida: debe terminar en "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Cadena inválida: debe incluir "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Cadena inválida: debe coincidir con el patrón ${_issue.pattern}`;
                return `Inválido ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Número inválido: debe ser múltiplo de ${issue.divisor}`;
            case "unrecognized_keys":
                return `Llave${issue.keys.length > 1 ? "s" : ""} desconocida${issue.keys.length > 1 ? "s" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Llave inválida en ${TypeDictionary[issue.origin] ?? issue.origin}`;
            case "invalid_union":
                return "Entrada inválida";
            case "invalid_element":
                return `Valor inválido en ${TypeDictionary[issue.origin] ?? issue.origin}`;
            default:
                return `Entrada inválida`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/fa.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "کاراکتر", verb: "داشته باشد" },
        file: { unit: "بایت", verb: "داشته باشد" },
        array: { unit: "آیتم", verb: "داشته باشد" },
        set: { unit: "آیتم", verb: "داشته باشد" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "ورودی",
        email: "آدرس ایمیل",
        url: "URL",
        emoji: "ایموجی",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "تاریخ و زمان ایزو",
        date: "تاریخ ایزو",
        time: "زمان ایزو",
        duration: "مدت زمان ایزو",
        ipv4: "IPv4 آدرس",
        ipv6: "IPv6 آدرس",
        cidrv4: "IPv4 دامنه",
        cidrv6: "IPv6 دامنه",
        base64: "base64-encoded رشته",
        base64url: "base64url-encoded رشته",
        json_string: "JSON رشته",
        e164: "E.164 عدد",
        jwt: "JWT",
        template_literal: "ورودی",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "عدد",
        array: "آرایه",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `ورودی نامعتبر: می‌بایست instanceof ${issue.expected} می‌بود، ${received} دریافت شد`;
                }
                return `ورودی نامعتبر: می‌بایست ${expected} می‌بود، ${received} دریافت شد`;
            }
            case "invalid_value":
                if (issue.values.length === 1) {
                    return `ورودی نامعتبر: می‌بایست ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])} می‌بود`;
                }
                return `گزینه نامعتبر: می‌بایست یکی از ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")} می‌بود`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `خیلی بزرگ: ${issue.origin ?? "مقدار"} باید ${adj}${issue.maximum.toString()} ${sizing.unit ?? "عنصر"} باشد`;
                }
                return `خیلی بزرگ: ${issue.origin ?? "مقدار"} باید ${adj}${issue.maximum.toString()} باشد`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `خیلی کوچک: ${issue.origin} باید ${adj}${issue.minimum.toString()} ${sizing.unit} باشد`;
                }
                return `خیلی کوچک: ${issue.origin} باید ${adj}${issue.minimum.toString()} باشد`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `رشته نامعتبر: باید با "${_issue.prefix}" شروع شود`;
                }
                if (_issue.format === "ends_with") {
                    return `رشته نامعتبر: باید با "${_issue.suffix}" تمام شود`;
                }
                if (_issue.format === "includes") {
                    return `رشته نامعتبر: باید شامل "${_issue.includes}" باشد`;
                }
                if (_issue.format === "regex") {
                    return `رشته نامعتبر: باید با الگوی ${_issue.pattern} مطابقت داشته باشد`;
                }
                return `${FormatDictionary[_issue.format] ?? issue.format} نامعتبر`;
            }
            case "not_multiple_of":
                return `عدد نامعتبر: باید مضرب ${issue.divisor} باشد`;
            case "unrecognized_keys":
                return `کلید${issue.keys.length > 1 ? "های" : ""} ناشناس: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `کلید ناشناس در ${issue.origin}`;
            case "invalid_union":
                return `ورودی نامعتبر`;
            case "invalid_element":
                return `مقدار نامعتبر در ${issue.origin}`;
            default:
                return `ورودی نامعتبر`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/fi.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "merkkiä", subject: "merkkijonon" },
        file: { unit: "tavua", subject: "tiedoston" },
        array: { unit: "alkiota", subject: "listan" },
        set: { unit: "alkiota", subject: "joukon" },
        number: { unit: "", subject: "luvun" },
        bigint: { unit: "", subject: "suuren kokonaisluvun" },
        int: { unit: "", subject: "kokonaisluvun" },
        date: { unit: "", subject: "päivämäärän" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "säännöllinen lauseke",
        email: "sähköpostiosoite",
        url: "URL-osoite",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO-aikaleima",
        date: "ISO-päivämäärä",
        time: "ISO-aika",
        duration: "ISO-kesto",
        ipv4: "IPv4-osoite",
        ipv6: "IPv6-osoite",
        cidrv4: "IPv4-alue",
        cidrv6: "IPv6-alue",
        base64: "base64-koodattu merkkijono",
        base64url: "base64url-koodattu merkkijono",
        json_string: "JSON-merkkijono",
        e164: "E.164-luku",
        jwt: "JWT",
        template_literal: "templaattimerkkijono",
    };
    const TypeDictionary = {
        nan: "NaN",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Virheellinen tyyppi: odotettiin instanceof ${issue.expected}, oli ${received}`;
                }
                return `Virheellinen tyyppi: odotettiin ${expected}, oli ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Virheellinen syöte: täytyy olla ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Virheellinen valinta: täytyy olla yksi seuraavista: ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Liian suuri: ${sizing.subject} täytyy olla ${adj}${issue.maximum.toString()} ${sizing.unit}`.trim();
                }
                return `Liian suuri: arvon täytyy olla ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Liian pieni: ${sizing.subject} täytyy olla ${adj}${issue.minimum.toString()} ${sizing.unit}`.trim();
                }
                return `Liian pieni: arvon täytyy olla ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Virheellinen syöte: täytyy alkaa "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Virheellinen syöte: täytyy loppua "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Virheellinen syöte: täytyy sisältää "${_issue.includes}"`;
                if (_issue.format === "regex") {
                    return `Virheellinen syöte: täytyy vastata säännöllistä lauseketta ${_issue.pattern}`;
                }
                return `Virheellinen ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Virheellinen luku: täytyy olla luvun ${issue.divisor} monikerta`;
            case "unrecognized_keys":
                return `${issue.keys.length > 1 ? "Tuntemattomat avaimet" : "Tuntematon avain"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return "Virheellinen avain tietueessa";
            case "invalid_union":
                return "Virheellinen unioni";
            case "invalid_element":
                return "Virheellinen arvo joukossa";
            default:
                return `Virheellinen syöte`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/fr-CA.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "caractères", verb: "avoir" },
        file: { unit: "octets", verb: "avoir" },
        array: { unit: "éléments", verb: "avoir" },
        set: { unit: "éléments", verb: "avoir" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "entrée",
        email: "adresse courriel",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "date-heure ISO",
        date: "date ISO",
        time: "heure ISO",
        duration: "durée ISO",
        ipv4: "adresse IPv4",
        ipv6: "adresse IPv6",
        cidrv4: "plage IPv4",
        cidrv6: "plage IPv6",
        base64: "chaîne encodée en base64",
        base64url: "chaîne encodée en base64url",
        json_string: "chaîne JSON",
        e164: "numéro E.164",
        jwt: "JWT",
        template_literal: "entrée",
    };
    const TypeDictionary = {
        nan: "NaN",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Entrée invalide : attendu instanceof ${issue.expected}, reçu ${received}`;
                }
                return `Entrée invalide : attendu ${expected}, reçu ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Entrée invalide : attendu ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Option invalide : attendu l'une des valeurs suivantes ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "≤" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Trop grand : attendu que ${issue.origin ?? "la valeur"} ait ${adj}${issue.maximum.toString()} ${sizing.unit}`;
                return `Trop grand : attendu que ${issue.origin ?? "la valeur"} soit ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? "≥" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Trop petit : attendu que ${issue.origin} ait ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Trop petit : attendu que ${issue.origin} soit ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `Chaîne invalide : doit commencer par "${_issue.prefix}"`;
                }
                if (_issue.format === "ends_with")
                    return `Chaîne invalide : doit se terminer par "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Chaîne invalide : doit inclure "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Chaîne invalide : doit correspondre au motif ${_issue.pattern}`;
                return `${FormatDictionary[_issue.format] ?? issue.format} invalide`;
            }
            case "not_multiple_of":
                return `Nombre invalide : doit être un multiple de ${issue.divisor}`;
            case "unrecognized_keys":
                return `Clé${issue.keys.length > 1 ? "s" : ""} non reconnue${issue.keys.length > 1 ? "s" : ""} : ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Clé invalide dans ${issue.origin}`;
            case "invalid_union":
                return "Entrée invalide";
            case "invalid_element":
                return `Valeur invalide dans ${issue.origin}`;
            default:
                return `Entrée invalide`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/fr.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "caractères", verb: "avoir" },
        file: { unit: "octets", verb: "avoir" },
        array: { unit: "éléments", verb: "avoir" },
        set: { unit: "éléments", verb: "avoir" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "entrée",
        email: "adresse e-mail",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "date et heure ISO",
        date: "date ISO",
        time: "heure ISO",
        duration: "durée ISO",
        ipv4: "adresse IPv4",
        ipv6: "adresse IPv6",
        cidrv4: "plage IPv4",
        cidrv6: "plage IPv6",
        base64: "chaîne encodée en base64",
        base64url: "chaîne encodée en base64url",
        json_string: "chaîne JSON",
        e164: "numéro E.164",
        jwt: "JWT",
        template_literal: "entrée",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "nombre",
        array: "tableau",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Entrée invalide : instanceof ${issue.expected} attendu, ${received} reçu`;
                }
                return `Entrée invalide : ${expected} attendu, ${received} reçu`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Entrée invalide : ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])} attendu`;
                return `Option invalide : une valeur parmi ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")} attendue`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Trop grand : ${issue.origin ?? "valeur"} doit ${sizing.verb} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "élément(s)"}`;
                return `Trop grand : ${issue.origin ?? "valeur"} doit être ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Trop petit : ${issue.origin} doit ${sizing.verb} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Trop petit : ${issue.origin} doit être ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Chaîne invalide : doit commencer par "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Chaîne invalide : doit se terminer par "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Chaîne invalide : doit inclure "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Chaîne invalide : doit correspondre au modèle ${_issue.pattern}`;
                return `${FormatDictionary[_issue.format] ?? issue.format} invalide`;
            }
            case "not_multiple_of":
                return `Nombre invalide : doit être un multiple de ${issue.divisor}`;
            case "unrecognized_keys":
                return `Clé${issue.keys.length > 1 ? "s" : ""} non reconnue${issue.keys.length > 1 ? "s" : ""} : ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Clé invalide dans ${issue.origin}`;
            case "invalid_union":
                return "Entrée invalide";
            case "invalid_element":
                return `Valeur invalide dans ${issue.origin}`;
            default:
                return `Entrée invalide`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/he.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    // Hebrew labels + grammatical gender
    const TypeNames = {
        string: { label: "מחרוזת", gender: "f" },
        number: { label: "מספר", gender: "m" },
        boolean: { label: "ערך בוליאני", gender: "m" },
        bigint: { label: "BigInt", gender: "m" },
        date: { label: "תאריך", gender: "m" },
        array: { label: "מערך", gender: "m" },
        object: { label: "אובייקט", gender: "m" },
        null: { label: "ערך ריק (null)", gender: "m" },
        undefined: { label: "ערך לא מוגדר (undefined)", gender: "m" },
        symbol: { label: "סימבול (Symbol)", gender: "m" },
        function: { label: "פונקציה", gender: "f" },
        map: { label: "מפה (Map)", gender: "f" },
        set: { label: "קבוצה (Set)", gender: "f" },
        file: { label: "קובץ", gender: "m" },
        promise: { label: "Promise", gender: "m" },
        NaN: { label: "NaN", gender: "m" },
        unknown: { label: "ערך לא ידוע", gender: "m" },
        value: { label: "ערך", gender: "m" },
    };
    // Sizing units for size-related messages + localized origin labels
    const Sizable = {
        string: { unit: "תווים", shortLabel: "קצר", longLabel: "ארוך" },
        file: { unit: "בייטים", shortLabel: "קטן", longLabel: "גדול" },
        array: { unit: "פריטים", shortLabel: "קטן", longLabel: "גדול" },
        set: { unit: "פריטים", shortLabel: "קטן", longLabel: "גדול" },
        number: { unit: "", shortLabel: "קטן", longLabel: "גדול" }, // no unit
    };
    // Helpers — labels, articles, and verbs
    const typeEntry = (t) => (t ? TypeNames[t] : undefined);
    const typeLabel = (t) => {
        const e = typeEntry(t);
        if (e)
            return e.label;
        // fallback: show raw string if unknown
        return t ?? TypeNames.unknown.label;
    };
    const withDefinite = (t) => `ה${typeLabel(t)}`;
    const verbFor = (t) => {
        const e = typeEntry(t);
        const gender = e?.gender ?? "m";
        return gender === "f" ? "צריכה להיות" : "צריך להיות";
    };
    const getSizing = (origin) => {
        if (!origin)
            return null;
        return Sizable[origin] ?? null;
    };
    const FormatDictionary = {
        regex: { label: "קלט", gender: "m" },
        email: { label: "כתובת אימייל", gender: "f" },
        url: { label: "כתובת רשת", gender: "f" },
        emoji: { label: "אימוג'י", gender: "m" },
        uuid: { label: "UUID", gender: "m" },
        nanoid: { label: "nanoid", gender: "m" },
        guid: { label: "GUID", gender: "m" },
        cuid: { label: "cuid", gender: "m" },
        cuid2: { label: "cuid2", gender: "m" },
        ulid: { label: "ULID", gender: "m" },
        xid: { label: "XID", gender: "m" },
        ksuid: { label: "KSUID", gender: "m" },
        datetime: { label: "תאריך וזמן ISO", gender: "m" },
        date: { label: "תאריך ISO", gender: "m" },
        time: { label: "זמן ISO", gender: "m" },
        duration: { label: "משך זמן ISO", gender: "m" },
        ipv4: { label: "כתובת IPv4", gender: "f" },
        ipv6: { label: "כתובת IPv6", gender: "f" },
        cidrv4: { label: "טווח IPv4", gender: "m" },
        cidrv6: { label: "טווח IPv6", gender: "m" },
        base64: { label: "מחרוזת בבסיס 64", gender: "f" },
        base64url: { label: "מחרוזת בבסיס 64 לכתובות רשת", gender: "f" },
        json_string: { label: "מחרוזת JSON", gender: "f" },
        e164: { label: "מספר E.164", gender: "m" },
        jwt: { label: "JWT", gender: "m" },
        ends_with: { label: "קלט", gender: "m" },
        includes: { label: "קלט", gender: "m" },
        lowercase: { label: "קלט", gender: "m" },
        starts_with: { label: "קלט", gender: "m" },
        uppercase: { label: "קלט", gender: "m" },
    };
    const TypeDictionary = {
        nan: "NaN",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                // Expected type: show without definite article for clearer Hebrew
                const expectedKey = issue.expected;
                const expected = TypeDictionary[expectedKey ?? ""] ?? typeLabel(expectedKey);
                // Received: show localized label if known, otherwise constructor/raw
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? TypeNames[receivedType]?.label ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `קלט לא תקין: צריך להיות instanceof ${issue.expected}, התקבל ${received}`;
                }
                return `קלט לא תקין: צריך להיות ${expected}, התקבל ${received}`;
            }
            case "invalid_value": {
                if (issue.values.length === 1) {
                    return `ערך לא תקין: הערך חייב להיות ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                }
                // Join values with proper Hebrew formatting
                const stringified = issue.values.map((v) => _core_util_js__rspack_import_0.stringifyPrimitive(v));
                if (issue.values.length === 2) {
                    return `ערך לא תקין: האפשרויות המתאימות הן ${stringified[0]} או ${stringified[1]}`;
                }
                // For 3+ values: "a", "b" או "c"
                const lastValue = stringified[stringified.length - 1];
                const restValues = stringified.slice(0, -1).join(", ");
                return `ערך לא תקין: האפשרויות המתאימות הן ${restValues} או ${lastValue}`;
            }
            case "too_big": {
                const sizing = getSizing(issue.origin);
                const subject = withDefinite(issue.origin ?? "value");
                if (issue.origin === "string") {
                    // Special handling for strings - more natural Hebrew
                    return `${sizing?.longLabel ?? "ארוך"} מדי: ${subject} צריכה להכיל ${issue.maximum.toString()} ${sizing?.unit ?? ""} ${issue.inclusive ? "או פחות" : "לכל היותר"}`.trim();
                }
                if (issue.origin === "number") {
                    // Natural Hebrew for numbers
                    const comparison = issue.inclusive ? `קטן או שווה ל-${issue.maximum}` : `קטן מ-${issue.maximum}`;
                    return `גדול מדי: ${subject} צריך להיות ${comparison}`;
                }
                if (issue.origin === "array" || issue.origin === "set") {
                    // Natural Hebrew for arrays and sets
                    const verb = issue.origin === "set" ? "צריכה" : "צריך";
                    const comparison = issue.inclusive
                        ? `${issue.maximum} ${sizing?.unit ?? ""} או פחות`
                        : `פחות מ-${issue.maximum} ${sizing?.unit ?? ""}`;
                    return `גדול מדי: ${subject} ${verb} להכיל ${comparison}`.trim();
                }
                const adj = issue.inclusive ? "<=" : "<";
                const be = verbFor(issue.origin ?? "value");
                if (sizing?.unit) {
                    return `${sizing.longLabel} מדי: ${subject} ${be} ${adj}${issue.maximum.toString()} ${sizing.unit}`;
                }
                return `${sizing?.longLabel ?? "גדול"} מדי: ${subject} ${be} ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const sizing = getSizing(issue.origin);
                const subject = withDefinite(issue.origin ?? "value");
                if (issue.origin === "string") {
                    // Special handling for strings - more natural Hebrew
                    return `${sizing?.shortLabel ?? "קצר"} מדי: ${subject} צריכה להכיל ${issue.minimum.toString()} ${sizing?.unit ?? ""} ${issue.inclusive ? "או יותר" : "לפחות"}`.trim();
                }
                if (issue.origin === "number") {
                    // Natural Hebrew for numbers
                    const comparison = issue.inclusive ? `גדול או שווה ל-${issue.minimum}` : `גדול מ-${issue.minimum}`;
                    return `קטן מדי: ${subject} צריך להיות ${comparison}`;
                }
                if (issue.origin === "array" || issue.origin === "set") {
                    // Natural Hebrew for arrays and sets
                    const verb = issue.origin === "set" ? "צריכה" : "צריך";
                    // Special case for singular (minimum === 1)
                    if (issue.minimum === 1 && issue.inclusive) {
                        const singularPhrase = issue.origin === "set" ? "לפחות פריט אחד" : "לפחות פריט אחד";
                        return `קטן מדי: ${subject} ${verb} להכיל ${singularPhrase}`;
                    }
                    const comparison = issue.inclusive
                        ? `${issue.minimum} ${sizing?.unit ?? ""} או יותר`
                        : `יותר מ-${issue.minimum} ${sizing?.unit ?? ""}`;
                    return `קטן מדי: ${subject} ${verb} להכיל ${comparison}`.trim();
                }
                const adj = issue.inclusive ? ">=" : ">";
                const be = verbFor(issue.origin ?? "value");
                if (sizing?.unit) {
                    return `${sizing.shortLabel} מדי: ${subject} ${be} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `${sizing?.shortLabel ?? "קטן"} מדי: ${subject} ${be} ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                // These apply to strings — use feminine grammar + ה׳ הידיעה
                if (_issue.format === "starts_with")
                    return `המחרוזת חייבת להתחיל ב "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `המחרוזת חייבת להסתיים ב "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `המחרוזת חייבת לכלול "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `המחרוזת חייבת להתאים לתבנית ${_issue.pattern}`;
                // Handle gender agreement for formats
                const nounEntry = FormatDictionary[_issue.format];
                const noun = nounEntry?.label ?? _issue.format;
                const gender = nounEntry?.gender ?? "m";
                const adjective = gender === "f" ? "תקינה" : "תקין";
                return `${noun} לא ${adjective}`;
            }
            case "not_multiple_of":
                return `מספר לא תקין: חייב להיות מכפלה של ${issue.divisor}`;
            case "unrecognized_keys":
                return `מפתח${issue.keys.length > 1 ? "ות" : ""} לא מזוה${issue.keys.length > 1 ? "ים" : "ה"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key": {
                return `שדה לא תקין באובייקט`;
            }
            case "invalid_union":
                return "קלט לא תקין";
            case "invalid_element": {
                const place = withDefinite(issue.origin ?? "array");
                return `ערך לא תקין ב${place}`;
            }
            default:
                return `קלט לא תקין`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/hu.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "karakter", verb: "legyen" },
        file: { unit: "byte", verb: "legyen" },
        array: { unit: "elem", verb: "legyen" },
        set: { unit: "elem", verb: "legyen" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "bemenet",
        email: "email cím",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO időbélyeg",
        date: "ISO dátum",
        time: "ISO idő",
        duration: "ISO időintervallum",
        ipv4: "IPv4 cím",
        ipv6: "IPv6 cím",
        cidrv4: "IPv4 tartomány",
        cidrv6: "IPv6 tartomány",
        base64: "base64-kódolt string",
        base64url: "base64url-kódolt string",
        json_string: "JSON string",
        e164: "E.164 szám",
        jwt: "JWT",
        template_literal: "bemenet",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "szám",
        array: "tömb",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Érvénytelen bemenet: a várt érték instanceof ${issue.expected}, a kapott érték ${received}`;
                }
                return `Érvénytelen bemenet: a várt érték ${expected}, a kapott érték ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Érvénytelen bemenet: a várt érték ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Érvénytelen opció: valamelyik érték várt ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Túl nagy: ${issue.origin ?? "érték"} mérete túl nagy ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elem"}`;
                return `Túl nagy: a bemeneti érték ${issue.origin ?? "érték"} túl nagy: ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Túl kicsi: a bemeneti érték ${issue.origin} mérete túl kicsi ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Túl kicsi: a bemeneti érték ${issue.origin} túl kicsi ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Érvénytelen string: "${_issue.prefix}" értékkel kell kezdődnie`;
                if (_issue.format === "ends_with")
                    return `Érvénytelen string: "${_issue.suffix}" értékkel kell végződnie`;
                if (_issue.format === "includes")
                    return `Érvénytelen string: "${_issue.includes}" értéket kell tartalmaznia`;
                if (_issue.format === "regex")
                    return `Érvénytelen string: ${_issue.pattern} mintának kell megfelelnie`;
                return `Érvénytelen ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Érvénytelen szám: ${issue.divisor} többszörösének kell lennie`;
            case "unrecognized_keys":
                return `Ismeretlen kulcs${issue.keys.length > 1 ? "s" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Érvénytelen kulcs ${issue.origin}`;
            case "invalid_union":
                return "Érvénytelen bemenet";
            case "invalid_element":
                return `Érvénytelen érték: ${issue.origin}`;
            default:
                return `Érvénytelen bemenet`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/hy.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

function getArmenianPlural(count, one, many) {
    return Math.abs(count) === 1 ? one : many;
}
function withDefiniteArticle(word) {
    if (!word)
        return "";
    const vowels = ["ա", "ե", "ը", "ի", "ո", "ու", "օ"];
    const lastChar = word[word.length - 1];
    return word + (vowels.includes(lastChar) ? "ն" : "ը");
}
const error = () => {
    const Sizable = {
        string: {
            unit: {
                one: "նշան",
                many: "նշաններ",
            },
            verb: "ունենալ",
        },
        file: {
            unit: {
                one: "բայթ",
                many: "բայթեր",
            },
            verb: "ունենալ",
        },
        array: {
            unit: {
                one: "տարր",
                many: "տարրեր",
            },
            verb: "ունենալ",
        },
        set: {
            unit: {
                one: "տարր",
                many: "տարրեր",
            },
            verb: "ունենալ",
        },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "մուտք",
        email: "էլ. հասցե",
        url: "URL",
        emoji: "էմոջի",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO ամսաթիվ և ժամ",
        date: "ISO ամսաթիվ",
        time: "ISO ժամ",
        duration: "ISO տևողություն",
        ipv4: "IPv4 հասցե",
        ipv6: "IPv6 հասցե",
        cidrv4: "IPv4 միջակայք",
        cidrv6: "IPv6 միջակայք",
        base64: "base64 ձևաչափով տող",
        base64url: "base64url ձևաչափով տող",
        json_string: "JSON տող",
        e164: "E.164 համար",
        jwt: "JWT",
        template_literal: "մուտք",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "թիվ",
        array: "զանգված",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Սխալ մուտքագրում․ սպասվում էր instanceof ${issue.expected}, ստացվել է ${received}`;
                }
                return `Սխալ մուտքագրում․ սպասվում էր ${expected}, ստացվել է ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Սխալ մուտքագրում․ սպասվում էր ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[1])}`;
                return `Սխալ տարբերակ․ սպասվում էր հետևյալներից մեկը՝ ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    const maxValue = Number(issue.maximum);
                    const unit = getArmenianPlural(maxValue, sizing.unit.one, sizing.unit.many);
                    return `Չափազանց մեծ արժեք․ սպասվում է, որ ${withDefiniteArticle(issue.origin ?? "արժեք")} կունենա ${adj}${issue.maximum.toString()} ${unit}`;
                }
                return `Չափազանց մեծ արժեք․ սպասվում է, որ ${withDefiniteArticle(issue.origin ?? "արժեք")} լինի ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    const minValue = Number(issue.minimum);
                    const unit = getArmenianPlural(minValue, sizing.unit.one, sizing.unit.many);
                    return `Չափազանց փոքր արժեք․ սպասվում է, որ ${withDefiniteArticle(issue.origin)} կունենա ${adj}${issue.minimum.toString()} ${unit}`;
                }
                return `Չափազանց փոքր արժեք․ սպասվում է, որ ${withDefiniteArticle(issue.origin)} լինի ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Սխալ տող․ պետք է սկսվի "${_issue.prefix}"-ով`;
                if (_issue.format === "ends_with")
                    return `Սխալ տող․ պետք է ավարտվի "${_issue.suffix}"-ով`;
                if (_issue.format === "includes")
                    return `Սխալ տող․ պետք է պարունակի "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Սխալ տող․ պետք է համապատասխանի ${_issue.pattern} ձևաչափին`;
                return `Սխալ ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Սխալ թիվ․ պետք է բազմապատիկ լինի ${issue.divisor}-ի`;
            case "unrecognized_keys":
                return `Չճանաչված բանալի${issue.keys.length > 1 ? "ներ" : ""}. ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Սխալ բանալի ${withDefiniteArticle(issue.origin)}-ում`;
            case "invalid_union":
                return "Սխալ մուտքագրում";
            case "invalid_element":
                return `Սխալ արժեք ${withDefiniteArticle(issue.origin)}-ում`;
            default:
                return `Սխալ մուտքագրում`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/id.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "karakter", verb: "memiliki" },
        file: { unit: "byte", verb: "memiliki" },
        array: { unit: "item", verb: "memiliki" },
        set: { unit: "item", verb: "memiliki" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "input",
        email: "alamat email",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "tanggal dan waktu format ISO",
        date: "tanggal format ISO",
        time: "jam format ISO",
        duration: "durasi format ISO",
        ipv4: "alamat IPv4",
        ipv6: "alamat IPv6",
        cidrv4: "rentang alamat IPv4",
        cidrv6: "rentang alamat IPv6",
        base64: "string dengan enkode base64",
        base64url: "string dengan enkode base64url",
        json_string: "string JSON",
        e164: "angka E.164",
        jwt: "JWT",
        template_literal: "input",
    };
    const TypeDictionary = {
        nan: "NaN",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Input tidak valid: diharapkan instanceof ${issue.expected}, diterima ${received}`;
                }
                return `Input tidak valid: diharapkan ${expected}, diterima ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Input tidak valid: diharapkan ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Pilihan tidak valid: diharapkan salah satu dari ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Terlalu besar: diharapkan ${issue.origin ?? "value"} memiliki ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elemen"}`;
                return `Terlalu besar: diharapkan ${issue.origin ?? "value"} menjadi ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Terlalu kecil: diharapkan ${issue.origin} memiliki ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Terlalu kecil: diharapkan ${issue.origin} menjadi ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `String tidak valid: harus dimulai dengan "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `String tidak valid: harus berakhir dengan "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `String tidak valid: harus menyertakan "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `String tidak valid: harus sesuai pola ${_issue.pattern}`;
                return `${FormatDictionary[_issue.format] ?? issue.format} tidak valid`;
            }
            case "not_multiple_of":
                return `Angka tidak valid: harus kelipatan dari ${issue.divisor}`;
            case "unrecognized_keys":
                return `Kunci tidak dikenali ${issue.keys.length > 1 ? "s" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Kunci tidak valid di ${issue.origin}`;
            case "invalid_union":
                return "Input tidak valid";
            case "invalid_element":
                return `Nilai tidak valid di ${issue.origin}`;
            default:
                return `Input tidak valid`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/index.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  ar: () => (/* reexport safe */ _ar_js__rspack_import_0["default"]),
  az: () => (/* reexport safe */ _az_js__rspack_import_1["default"]),
  be: () => (/* reexport safe */ _be_js__rspack_import_2["default"]),
  bg: () => (/* reexport safe */ _bg_js__rspack_import_3["default"]),
  ca: () => (/* reexport safe */ _ca_js__rspack_import_4["default"]),
  cs: () => (/* reexport safe */ _cs_js__rspack_import_5["default"]),
  da: () => (/* reexport safe */ _da_js__rspack_import_6["default"]),
  de: () => (/* reexport safe */ _de_js__rspack_import_7["default"]),
  en: () => (/* reexport safe */ _en_js__rspack_import_8["default"]),
  eo: () => (/* reexport safe */ _eo_js__rspack_import_9["default"]),
  es: () => (/* reexport safe */ _es_js__rspack_import_10["default"]),
  fa: () => (/* reexport safe */ _fa_js__rspack_import_11["default"]),
  fi: () => (/* reexport safe */ _fi_js__rspack_import_12["default"]),
  fr: () => (/* reexport safe */ _fr_js__rspack_import_13["default"]),
  frCA: () => (/* reexport safe */ _fr_CA_js__rspack_import_14["default"]),
  he: () => (/* reexport safe */ _he_js__rspack_import_15["default"]),
  hu: () => (/* reexport safe */ _hu_js__rspack_import_16["default"]),
  hy: () => (/* reexport safe */ _hy_js__rspack_import_17["default"]),
  id: () => (/* reexport safe */ _id_js__rspack_import_18["default"]),
  is: () => (/* reexport safe */ _is_js__rspack_import_19["default"]),
  it: () => (/* reexport safe */ _it_js__rspack_import_20["default"]),
  ja: () => (/* reexport safe */ _ja_js__rspack_import_21["default"]),
  ka: () => (/* reexport safe */ _ka_js__rspack_import_22["default"]),
  kh: () => (/* reexport safe */ _kh_js__rspack_import_23["default"]),
  km: () => (/* reexport safe */ _km_js__rspack_import_24["default"]),
  ko: () => (/* reexport safe */ _ko_js__rspack_import_25["default"]),
  lt: () => (/* reexport safe */ _lt_js__rspack_import_26["default"]),
  mk: () => (/* reexport safe */ _mk_js__rspack_import_27["default"]),
  ms: () => (/* reexport safe */ _ms_js__rspack_import_28["default"]),
  nl: () => (/* reexport safe */ _nl_js__rspack_import_29["default"]),
  no: () => (/* reexport safe */ _no_js__rspack_import_30["default"]),
  ota: () => (/* reexport safe */ _ota_js__rspack_import_31["default"]),
  pl: () => (/* reexport safe */ _pl_js__rspack_import_33["default"]),
  ps: () => (/* reexport safe */ _ps_js__rspack_import_32["default"]),
  pt: () => (/* reexport safe */ _pt_js__rspack_import_34["default"]),
  ru: () => (/* reexport safe */ _ru_js__rspack_import_35["default"]),
  sl: () => (/* reexport safe */ _sl_js__rspack_import_36["default"]),
  sv: () => (/* reexport safe */ _sv_js__rspack_import_37["default"]),
  ta: () => (/* reexport safe */ _ta_js__rspack_import_38["default"]),
  th: () => (/* reexport safe */ _th_js__rspack_import_39["default"]),
  tr: () => (/* reexport safe */ _tr_js__rspack_import_40["default"]),
  ua: () => (/* reexport safe */ _ua_js__rspack_import_41["default"]),
  uk: () => (/* reexport safe */ _uk_js__rspack_import_42["default"]),
  ur: () => (/* reexport safe */ _ur_js__rspack_import_43["default"]),
  uz: () => (/* reexport safe */ _uz_js__rspack_import_44["default"]),
  vi: () => (/* reexport safe */ _vi_js__rspack_import_45["default"]),
  yo: () => (/* reexport safe */ _yo_js__rspack_import_48["default"]),
  zhCN: () => (/* reexport safe */ _zh_CN_js__rspack_import_46["default"]),
  zhTW: () => (/* reexport safe */ _zh_TW_js__rspack_import_47["default"])
});
/* import */ var _ar_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ar.js");
/* import */ var _az_js__rspack_import_1 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/az.js");
/* import */ var _be_js__rspack_import_2 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/be.js");
/* import */ var _bg_js__rspack_import_3 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/bg.js");
/* import */ var _ca_js__rspack_import_4 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ca.js");
/* import */ var _cs_js__rspack_import_5 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/cs.js");
/* import */ var _da_js__rspack_import_6 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/da.js");
/* import */ var _de_js__rspack_import_7 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/de.js");
/* import */ var _en_js__rspack_import_8 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/en.js");
/* import */ var _eo_js__rspack_import_9 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/eo.js");
/* import */ var _es_js__rspack_import_10 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/es.js");
/* import */ var _fa_js__rspack_import_11 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/fa.js");
/* import */ var _fi_js__rspack_import_12 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/fi.js");
/* import */ var _fr_js__rspack_import_13 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/fr.js");
/* import */ var _fr_CA_js__rspack_import_14 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/fr-CA.js");
/* import */ var _he_js__rspack_import_15 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/he.js");
/* import */ var _hu_js__rspack_import_16 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/hu.js");
/* import */ var _hy_js__rspack_import_17 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/hy.js");
/* import */ var _id_js__rspack_import_18 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/id.js");
/* import */ var _is_js__rspack_import_19 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/is.js");
/* import */ var _it_js__rspack_import_20 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/it.js");
/* import */ var _ja_js__rspack_import_21 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ja.js");
/* import */ var _ka_js__rspack_import_22 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ka.js");
/* import */ var _kh_js__rspack_import_23 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/kh.js");
/* import */ var _km_js__rspack_import_24 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/km.js");
/* import */ var _ko_js__rspack_import_25 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ko.js");
/* import */ var _lt_js__rspack_import_26 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/lt.js");
/* import */ var _mk_js__rspack_import_27 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/mk.js");
/* import */ var _ms_js__rspack_import_28 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ms.js");
/* import */ var _nl_js__rspack_import_29 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/nl.js");
/* import */ var _no_js__rspack_import_30 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/no.js");
/* import */ var _ota_js__rspack_import_31 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ota.js");
/* import */ var _ps_js__rspack_import_32 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ps.js");
/* import */ var _pl_js__rspack_import_33 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/pl.js");
/* import */ var _pt_js__rspack_import_34 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/pt.js");
/* import */ var _ru_js__rspack_import_35 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ru.js");
/* import */ var _sl_js__rspack_import_36 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/sl.js");
/* import */ var _sv_js__rspack_import_37 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/sv.js");
/* import */ var _ta_js__rspack_import_38 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ta.js");
/* import */ var _th_js__rspack_import_39 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/th.js");
/* import */ var _tr_js__rspack_import_40 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/tr.js");
/* import */ var _ua_js__rspack_import_41 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ua.js");
/* import */ var _uk_js__rspack_import_42 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/uk.js");
/* import */ var _ur_js__rspack_import_43 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ur.js");
/* import */ var _uz_js__rspack_import_44 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/uz.js");
/* import */ var _vi_js__rspack_import_45 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/vi.js");
/* import */ var _zh_CN_js__rspack_import_46 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/zh-CN.js");
/* import */ var _zh_TW_js__rspack_import_47 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/zh-TW.js");
/* import */ var _yo_js__rspack_import_48 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/yo.js");



















































},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/is.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "stafi", verb: "að hafa" },
        file: { unit: "bæti", verb: "að hafa" },
        array: { unit: "hluti", verb: "að hafa" },
        set: { unit: "hluti", verb: "að hafa" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "gildi",
        email: "netfang",
        url: "vefslóð",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO dagsetning og tími",
        date: "ISO dagsetning",
        time: "ISO tími",
        duration: "ISO tímalengd",
        ipv4: "IPv4 address",
        ipv6: "IPv6 address",
        cidrv4: "IPv4 range",
        cidrv6: "IPv6 range",
        base64: "base64-encoded strengur",
        base64url: "base64url-encoded strengur",
        json_string: "JSON strengur",
        e164: "E.164 tölugildi",
        jwt: "JWT",
        template_literal: "gildi",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "númer",
        array: "fylki",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Rangt gildi: Þú slóst inn ${received} þar sem á að vera instanceof ${issue.expected}`;
                }
                return `Rangt gildi: Þú slóst inn ${received} þar sem á að vera ${expected}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Rangt gildi: gert ráð fyrir ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Ógilt val: má vera eitt af eftirfarandi ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Of stórt: gert er ráð fyrir að ${issue.origin ?? "gildi"} hafi ${adj}${issue.maximum.toString()} ${sizing.unit ?? "hluti"}`;
                return `Of stórt: gert er ráð fyrir að ${issue.origin ?? "gildi"} sé ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Of lítið: gert er ráð fyrir að ${issue.origin} hafi ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Of lítið: gert er ráð fyrir að ${issue.origin} sé ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `Ógildur strengur: verður að byrja á "${_issue.prefix}"`;
                }
                if (_issue.format === "ends_with")
                    return `Ógildur strengur: verður að enda á "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Ógildur strengur: verður að innihalda "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Ógildur strengur: verður að fylgja mynstri ${_issue.pattern}`;
                return `Rangt ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Röng tala: verður að vera margfeldi af ${issue.divisor}`;
            case "unrecognized_keys":
                return `Óþekkt ${issue.keys.length > 1 ? "ir lyklar" : "ur lykill"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Rangur lykill í ${issue.origin}`;
            case "invalid_union":
                return "Rangt gildi";
            case "invalid_element":
                return `Rangt gildi í ${issue.origin}`;
            default:
                return `Rangt gildi`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/it.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "caratteri", verb: "avere" },
        file: { unit: "byte", verb: "avere" },
        array: { unit: "elementi", verb: "avere" },
        set: { unit: "elementi", verb: "avere" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "input",
        email: "indirizzo email",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "data e ora ISO",
        date: "data ISO",
        time: "ora ISO",
        duration: "durata ISO",
        ipv4: "indirizzo IPv4",
        ipv6: "indirizzo IPv6",
        cidrv4: "intervallo IPv4",
        cidrv6: "intervallo IPv6",
        base64: "stringa codificata in base64",
        base64url: "URL codificata in base64",
        json_string: "stringa JSON",
        e164: "numero E.164",
        jwt: "JWT",
        template_literal: "input",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "numero",
        array: "vettore",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Input non valido: atteso instanceof ${issue.expected}, ricevuto ${received}`;
                }
                return `Input non valido: atteso ${expected}, ricevuto ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Input non valido: atteso ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Opzione non valida: atteso uno tra ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Troppo grande: ${issue.origin ?? "valore"} deve avere ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementi"}`;
                return `Troppo grande: ${issue.origin ?? "valore"} deve essere ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Troppo piccolo: ${issue.origin} deve avere ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Troppo piccolo: ${issue.origin} deve essere ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Stringa non valida: deve iniziare con "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Stringa non valida: deve terminare con "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Stringa non valida: deve includere "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Stringa non valida: deve corrispondere al pattern ${_issue.pattern}`;
                return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Numero non valido: deve essere un multiplo di ${issue.divisor}`;
            case "unrecognized_keys":
                return `Chiav${issue.keys.length > 1 ? "i" : "e"} non riconosciut${issue.keys.length > 1 ? "e" : "a"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Chiave non valida in ${issue.origin}`;
            case "invalid_union":
                return "Input non valido";
            case "invalid_element":
                return `Valore non valido in ${issue.origin}`;
            default:
                return `Input non valido`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ja.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "文字", verb: "である" },
        file: { unit: "バイト", verb: "である" },
        array: { unit: "要素", verb: "である" },
        set: { unit: "要素", verb: "である" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "入力値",
        email: "メールアドレス",
        url: "URL",
        emoji: "絵文字",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO日時",
        date: "ISO日付",
        time: "ISO時刻",
        duration: "ISO期間",
        ipv4: "IPv4アドレス",
        ipv6: "IPv6アドレス",
        cidrv4: "IPv4範囲",
        cidrv6: "IPv6範囲",
        base64: "base64エンコード文字列",
        base64url: "base64urlエンコード文字列",
        json_string: "JSON文字列",
        e164: "E.164番号",
        jwt: "JWT",
        template_literal: "入力値",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "数値",
        array: "配列",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `無効な入力: instanceof ${issue.expected}が期待されましたが、${received}が入力されました`;
                }
                return `無効な入力: ${expected}が期待されましたが、${received}が入力されました`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `無効な入力: ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}が期待されました`;
                return `無効な選択: ${_core_util_js__rspack_import_0.joinValues(issue.values, "、")}のいずれかである必要があります`;
            case "too_big": {
                const adj = issue.inclusive ? "以下である" : "より小さい";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `大きすぎる値: ${issue.origin ?? "値"}は${issue.maximum.toString()}${sizing.unit ?? "要素"}${adj}必要があります`;
                return `大きすぎる値: ${issue.origin ?? "値"}は${issue.maximum.toString()}${adj}必要があります`;
            }
            case "too_small": {
                const adj = issue.inclusive ? "以上である" : "より大きい";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `小さすぎる値: ${issue.origin}は${issue.minimum.toString()}${sizing.unit}${adj}必要があります`;
                return `小さすぎる値: ${issue.origin}は${issue.minimum.toString()}${adj}必要があります`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `無効な文字列: "${_issue.prefix}"で始まる必要があります`;
                if (_issue.format === "ends_with")
                    return `無効な文字列: "${_issue.suffix}"で終わる必要があります`;
                if (_issue.format === "includes")
                    return `無効な文字列: "${_issue.includes}"を含む必要があります`;
                if (_issue.format === "regex")
                    return `無効な文字列: パターン${_issue.pattern}に一致する必要があります`;
                return `無効な${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `無効な数値: ${issue.divisor}の倍数である必要があります`;
            case "unrecognized_keys":
                return `認識されていないキー${issue.keys.length > 1 ? "群" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, "、")}`;
            case "invalid_key":
                return `${issue.origin}内の無効なキー`;
            case "invalid_union":
                return "無効な入力";
            case "invalid_element":
                return `${issue.origin}内の無効な値`;
            default:
                return `無効な入力`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ka.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "სიმბოლო", verb: "უნდა შეიცავდეს" },
        file: { unit: "ბაიტი", verb: "უნდა შეიცავდეს" },
        array: { unit: "ელემენტი", verb: "უნდა შეიცავდეს" },
        set: { unit: "ელემენტი", verb: "უნდა შეიცავდეს" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "შეყვანა",
        email: "ელ-ფოსტის მისამართი",
        url: "URL",
        emoji: "ემოჯი",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "თარიღი-დრო",
        date: "თარიღი",
        time: "დრო",
        duration: "ხანგრძლივობა",
        ipv4: "IPv4 მისამართი",
        ipv6: "IPv6 მისამართი",
        cidrv4: "IPv4 დიაპაზონი",
        cidrv6: "IPv6 დიაპაზონი",
        base64: "base64-კოდირებული სტრინგი",
        base64url: "base64url-კოდირებული სტრინგი",
        json_string: "JSON სტრინგი",
        e164: "E.164 ნომერი",
        jwt: "JWT",
        template_literal: "შეყვანა",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "რიცხვი",
        string: "სტრინგი",
        boolean: "ბულეანი",
        function: "ფუნქცია",
        array: "მასივი",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `არასწორი შეყვანა: მოსალოდნელი instanceof ${issue.expected}, მიღებული ${received}`;
                }
                return `არასწორი შეყვანა: მოსალოდნელი ${expected}, მიღებული ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `არასწორი შეყვანა: მოსალოდნელი ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `არასწორი ვარიანტი: მოსალოდნელია ერთ-ერთი ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}-დან`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `ზედმეტად დიდი: მოსალოდნელი ${issue.origin ?? "მნიშვნელობა"} ${sizing.verb} ${adj}${issue.maximum.toString()} ${sizing.unit}`;
                return `ზედმეტად დიდი: მოსალოდნელი ${issue.origin ?? "მნიშვნელობა"} იყოს ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `ზედმეტად პატარა: მოსალოდნელი ${issue.origin} ${sizing.verb} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `ზედმეტად პატარა: მოსალოდნელი ${issue.origin} იყოს ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `არასწორი სტრინგი: უნდა იწყებოდეს "${_issue.prefix}"-ით`;
                }
                if (_issue.format === "ends_with")
                    return `არასწორი სტრინგი: უნდა მთავრდებოდეს "${_issue.suffix}"-ით`;
                if (_issue.format === "includes")
                    return `არასწორი სტრინგი: უნდა შეიცავდეს "${_issue.includes}"-ს`;
                if (_issue.format === "regex")
                    return `არასწორი სტრინგი: უნდა შეესაბამებოდეს შაბლონს ${_issue.pattern}`;
                return `არასწორი ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `არასწორი რიცხვი: უნდა იყოს ${issue.divisor}-ის ჯერადი`;
            case "unrecognized_keys":
                return `უცნობი გასაღებ${issue.keys.length > 1 ? "ები" : "ი"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `არასწორი გასაღები ${issue.origin}-ში`;
            case "invalid_union":
                return "არასწორი შეყვანა";
            case "invalid_element":
                return `არასწორი მნიშვნელობა ${issue.origin}-ში`;
            default:
                return `არასწორი შეყვანა`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/kh.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _km_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/km.js");

/** @deprecated Use `km` instead. */
/* export default */ function __rspack_default_export() {
    return (0,_km_js__rspack_import_0["default"])();
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/km.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "តួអក្សរ", verb: "គួរមាន" },
        file: { unit: "បៃ", verb: "គួរមាន" },
        array: { unit: "ធាតុ", verb: "គួរមាន" },
        set: { unit: "ធាតុ", verb: "គួរមាន" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "ទិន្នន័យបញ្ចូល",
        email: "អាសយដ្ឋានអ៊ីមែល",
        url: "URL",
        emoji: "សញ្ញាអារម្មណ៍",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "កាលបរិច្ឆេទ និងម៉ោង ISO",
        date: "កាលបរិច្ឆេទ ISO",
        time: "ម៉ោង ISO",
        duration: "រយៈពេល ISO",
        ipv4: "អាសយដ្ឋាន IPv4",
        ipv6: "អាសយដ្ឋាន IPv6",
        cidrv4: "ដែនអាសយដ្ឋាន IPv4",
        cidrv6: "ដែនអាសយដ្ឋាន IPv6",
        base64: "ខ្សែអក្សរអ៊ិកូដ base64",
        base64url: "ខ្សែអក្សរអ៊ិកូដ base64url",
        json_string: "ខ្សែអក្សរ JSON",
        e164: "លេខ E.164",
        jwt: "JWT",
        template_literal: "ទិន្នន័យបញ្ចូល",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "លេខ",
        array: "អារេ (Array)",
        null: "គ្មានតម្លៃ (null)",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ៖ ត្រូវការ instanceof ${issue.expected} ប៉ុន្តែទទួលបាន ${received}`;
                }
                return `ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ៖ ត្រូវការ ${expected} ប៉ុន្តែទទួលបាន ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `ទិន្នន័យបញ្ចូលមិនត្រឹមត្រូវ៖ ត្រូវការ ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `ជម្រើសមិនត្រឹមត្រូវ៖ ត្រូវជាមួយក្នុងចំណោម ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `ធំពេក៖ ត្រូវការ ${issue.origin ?? "តម្លៃ"} ${adj} ${issue.maximum.toString()} ${sizing.unit ?? "ធាតុ"}`;
                return `ធំពេក៖ ត្រូវការ ${issue.origin ?? "តម្លៃ"} ${adj} ${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `តូចពេក៖ ត្រូវការ ${issue.origin} ${adj} ${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `តូចពេក៖ ត្រូវការ ${issue.origin} ${adj} ${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `ខ្សែអក្សរមិនត្រឹមត្រូវ៖ ត្រូវចាប់ផ្តើមដោយ "${_issue.prefix}"`;
                }
                if (_issue.format === "ends_with")
                    return `ខ្សែអក្សរមិនត្រឹមត្រូវ៖ ត្រូវបញ្ចប់ដោយ "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `ខ្សែអក្សរមិនត្រឹមត្រូវ៖ ត្រូវមាន "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `ខ្សែអក្សរមិនត្រឹមត្រូវ៖ ត្រូវតែផ្គូផ្គងនឹងទម្រង់ដែលបានកំណត់ ${_issue.pattern}`;
                return `មិនត្រឹមត្រូវ៖ ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `លេខមិនត្រឹមត្រូវ៖ ត្រូវតែជាពហុគុណនៃ ${issue.divisor}`;
            case "unrecognized_keys":
                return `រកឃើញសោមិនស្គាល់៖ ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `សោមិនត្រឹមត្រូវនៅក្នុង ${issue.origin}`;
            case "invalid_union":
                return `ទិន្នន័យមិនត្រឹមត្រូវ`;
            case "invalid_element":
                return `ទិន្នន័យមិនត្រឹមត្រូវនៅក្នុង ${issue.origin}`;
            default:
                return `ទិន្នន័យមិនត្រឹមត្រូវ`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ko.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "문자", verb: "to have" },
        file: { unit: "바이트", verb: "to have" },
        array: { unit: "개", verb: "to have" },
        set: { unit: "개", verb: "to have" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "입력",
        email: "이메일 주소",
        url: "URL",
        emoji: "이모지",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO 날짜시간",
        date: "ISO 날짜",
        time: "ISO 시간",
        duration: "ISO 기간",
        ipv4: "IPv4 주소",
        ipv6: "IPv6 주소",
        cidrv4: "IPv4 범위",
        cidrv6: "IPv6 범위",
        base64: "base64 인코딩 문자열",
        base64url: "base64url 인코딩 문자열",
        json_string: "JSON 문자열",
        e164: "E.164 번호",
        jwt: "JWT",
        template_literal: "입력",
    };
    const TypeDictionary = {
        nan: "NaN",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `잘못된 입력: 예상 타입은 instanceof ${issue.expected}, 받은 타입은 ${received}입니다`;
                }
                return `잘못된 입력: 예상 타입은 ${expected}, 받은 타입은 ${received}입니다`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `잘못된 입력: 값은 ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])} 이어야 합니다`;
                return `잘못된 옵션: ${_core_util_js__rspack_import_0.joinValues(issue.values, "또는 ")} 중 하나여야 합니다`;
            case "too_big": {
                const adj = issue.inclusive ? "이하" : "미만";
                const suffix = adj === "미만" ? "이어야 합니다" : "여야 합니다";
                const sizing = getSizing(issue.origin);
                const unit = sizing?.unit ?? "요소";
                if (sizing)
                    return `${issue.origin ?? "값"}이 너무 큽니다: ${issue.maximum.toString()}${unit} ${adj}${suffix}`;
                return `${issue.origin ?? "값"}이 너무 큽니다: ${issue.maximum.toString()} ${adj}${suffix}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? "이상" : "초과";
                const suffix = adj === "이상" ? "이어야 합니다" : "여야 합니다";
                const sizing = getSizing(issue.origin);
                const unit = sizing?.unit ?? "요소";
                if (sizing) {
                    return `${issue.origin ?? "값"}이 너무 작습니다: ${issue.minimum.toString()}${unit} ${adj}${suffix}`;
                }
                return `${issue.origin ?? "값"}이 너무 작습니다: ${issue.minimum.toString()} ${adj}${suffix}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `잘못된 문자열: "${_issue.prefix}"(으)로 시작해야 합니다`;
                }
                if (_issue.format === "ends_with")
                    return `잘못된 문자열: "${_issue.suffix}"(으)로 끝나야 합니다`;
                if (_issue.format === "includes")
                    return `잘못된 문자열: "${_issue.includes}"을(를) 포함해야 합니다`;
                if (_issue.format === "regex")
                    return `잘못된 문자열: 정규식 ${_issue.pattern} 패턴과 일치해야 합니다`;
                return `잘못된 ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `잘못된 숫자: ${issue.divisor}의 배수여야 합니다`;
            case "unrecognized_keys":
                return `인식할 수 없는 키: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `잘못된 키: ${issue.origin}`;
            case "invalid_union":
                return `잘못된 입력`;
            case "invalid_element":
                return `잘못된 값: ${issue.origin}`;
            default:
                return `잘못된 입력`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/lt.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const capitalizeFirstCharacter = (text) => {
    return text.charAt(0).toUpperCase() + text.slice(1);
};
function getUnitTypeFromNumber(number) {
    const abs = Math.abs(number);
    const last = abs % 10;
    const last2 = abs % 100;
    if ((last2 >= 11 && last2 <= 19) || last === 0)
        return "many";
    if (last === 1)
        return "one";
    return "few";
}
const error = () => {
    const Sizable = {
        string: {
            unit: {
                one: "simbolis",
                few: "simboliai",
                many: "simbolių",
            },
            verb: {
                smaller: {
                    inclusive: "turi būti ne ilgesnė kaip",
                    notInclusive: "turi būti trumpesnė kaip",
                },
                bigger: {
                    inclusive: "turi būti ne trumpesnė kaip",
                    notInclusive: "turi būti ilgesnė kaip",
                },
            },
        },
        file: {
            unit: {
                one: "baitas",
                few: "baitai",
                many: "baitų",
            },
            verb: {
                smaller: {
                    inclusive: "turi būti ne didesnis kaip",
                    notInclusive: "turi būti mažesnis kaip",
                },
                bigger: {
                    inclusive: "turi būti ne mažesnis kaip",
                    notInclusive: "turi būti didesnis kaip",
                },
            },
        },
        array: {
            unit: {
                one: "elementą",
                few: "elementus",
                many: "elementų",
            },
            verb: {
                smaller: {
                    inclusive: "turi turėti ne daugiau kaip",
                    notInclusive: "turi turėti mažiau kaip",
                },
                bigger: {
                    inclusive: "turi turėti ne mažiau kaip",
                    notInclusive: "turi turėti daugiau kaip",
                },
            },
        },
        set: {
            unit: {
                one: "elementą",
                few: "elementus",
                many: "elementų",
            },
            verb: {
                smaller: {
                    inclusive: "turi turėti ne daugiau kaip",
                    notInclusive: "turi turėti mažiau kaip",
                },
                bigger: {
                    inclusive: "turi turėti ne mažiau kaip",
                    notInclusive: "turi turėti daugiau kaip",
                },
            },
        },
    };
    function getSizing(origin, unitType, inclusive, targetShouldBe) {
        const result = Sizable[origin] ?? null;
        if (result === null)
            return result;
        return {
            unit: result.unit[unitType],
            verb: result.verb[targetShouldBe][inclusive ? "inclusive" : "notInclusive"],
        };
    }
    const FormatDictionary = {
        regex: "įvestis",
        email: "el. pašto adresas",
        url: "URL",
        emoji: "jaustukas",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO data ir laikas",
        date: "ISO data",
        time: "ISO laikas",
        duration: "ISO trukmė",
        ipv4: "IPv4 adresas",
        ipv6: "IPv6 adresas",
        cidrv4: "IPv4 tinklo prefiksas (CIDR)",
        cidrv6: "IPv6 tinklo prefiksas (CIDR)",
        base64: "base64 užkoduota eilutė",
        base64url: "base64url užkoduota eilutė",
        json_string: "JSON eilutė",
        e164: "E.164 numeris",
        jwt: "JWT",
        template_literal: "įvestis",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "skaičius",
        bigint: "sveikasis skaičius",
        string: "eilutė",
        boolean: "loginė reikšmė",
        undefined: "neapibrėžta reikšmė",
        function: "funkcija",
        symbol: "simbolis",
        array: "masyvas",
        object: "objektas",
        null: "nulinė reikšmė",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Gautas tipas ${received}, o tikėtasi - instanceof ${issue.expected}`;
                }
                return `Gautas tipas ${received}, o tikėtasi - ${expected}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Privalo būti ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Privalo būti vienas iš ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")} pasirinkimų`;
            case "too_big": {
                const origin = TypeDictionary[issue.origin] ?? issue.origin;
                const sizing = getSizing(issue.origin, getUnitTypeFromNumber(Number(issue.maximum)), issue.inclusive ?? false, "smaller");
                if (sizing?.verb)
                    return `${capitalizeFirstCharacter(origin ?? issue.origin ?? "reikšmė")} ${sizing.verb} ${issue.maximum.toString()} ${sizing.unit ?? "elementų"}`;
                const adj = issue.inclusive ? "ne didesnis kaip" : "mažesnis kaip";
                return `${capitalizeFirstCharacter(origin ?? issue.origin ?? "reikšmė")} turi būti ${adj} ${issue.maximum.toString()} ${sizing?.unit}`;
            }
            case "too_small": {
                const origin = TypeDictionary[issue.origin] ?? issue.origin;
                const sizing = getSizing(issue.origin, getUnitTypeFromNumber(Number(issue.minimum)), issue.inclusive ?? false, "bigger");
                if (sizing?.verb)
                    return `${capitalizeFirstCharacter(origin ?? issue.origin ?? "reikšmė")} ${sizing.verb} ${issue.minimum.toString()} ${sizing.unit ?? "elementų"}`;
                const adj = issue.inclusive ? "ne mažesnis kaip" : "didesnis kaip";
                return `${capitalizeFirstCharacter(origin ?? issue.origin ?? "reikšmė")} turi būti ${adj} ${issue.minimum.toString()} ${sizing?.unit}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `Eilutė privalo prasidėti "${_issue.prefix}"`;
                }
                if (_issue.format === "ends_with")
                    return `Eilutė privalo pasibaigti "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Eilutė privalo įtraukti "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Eilutė privalo atitikti ${_issue.pattern}`;
                return `Neteisingas ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Skaičius privalo būti ${issue.divisor} kartotinis.`;
            case "unrecognized_keys":
                return `Neatpažint${issue.keys.length > 1 ? "i" : "as"} rakt${issue.keys.length > 1 ? "ai" : "as"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return "Rastas klaidingas raktas";
            case "invalid_union":
                return "Klaidinga įvestis";
            case "invalid_element": {
                const origin = TypeDictionary[issue.origin] ?? issue.origin;
                return `${capitalizeFirstCharacter(origin ?? issue.origin ?? "reikšmė")} turi klaidingą įvestį`;
            }
            default:
                return "Klaidinga įvestis";
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/mk.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "знаци", verb: "да имаат" },
        file: { unit: "бајти", verb: "да имаат" },
        array: { unit: "ставки", verb: "да имаат" },
        set: { unit: "ставки", verb: "да имаат" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "внес",
        email: "адреса на е-пошта",
        url: "URL",
        emoji: "емоџи",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO датум и време",
        date: "ISO датум",
        time: "ISO време",
        duration: "ISO времетраење",
        ipv4: "IPv4 адреса",
        ipv6: "IPv6 адреса",
        cidrv4: "IPv4 опсег",
        cidrv6: "IPv6 опсег",
        base64: "base64-енкодирана низа",
        base64url: "base64url-енкодирана низа",
        json_string: "JSON низа",
        e164: "E.164 број",
        jwt: "JWT",
        template_literal: "внес",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "број",
        array: "низа",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Грешен внес: се очекува instanceof ${issue.expected}, примено ${received}`;
                }
                return `Грешен внес: се очекува ${expected}, примено ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Invalid input: expected ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Грешана опција: се очекува една ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Премногу голем: се очекува ${issue.origin ?? "вредноста"} да има ${adj}${issue.maximum.toString()} ${sizing.unit ?? "елементи"}`;
                return `Премногу голем: се очекува ${issue.origin ?? "вредноста"} да биде ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Премногу мал: се очекува ${issue.origin} да има ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Премногу мал: се очекува ${issue.origin} да биде ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `Неважечка низа: мора да започнува со "${_issue.prefix}"`;
                }
                if (_issue.format === "ends_with")
                    return `Неважечка низа: мора да завршува со "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Неважечка низа: мора да вклучува "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Неважечка низа: мора да одгоара на патернот ${_issue.pattern}`;
                return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Грешен број: мора да биде делив со ${issue.divisor}`;
            case "unrecognized_keys":
                return `${issue.keys.length > 1 ? "Непрепознаени клучеви" : "Непрепознаен клуч"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Грешен клуч во ${issue.origin}`;
            case "invalid_union":
                return "Грешен внес";
            case "invalid_element":
                return `Грешна вредност во ${issue.origin}`;
            default:
                return `Грешен внес`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ms.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "aksara", verb: "mempunyai" },
        file: { unit: "bait", verb: "mempunyai" },
        array: { unit: "elemen", verb: "mempunyai" },
        set: { unit: "elemen", verb: "mempunyai" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "input",
        email: "alamat e-mel",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "tarikh masa ISO",
        date: "tarikh ISO",
        time: "masa ISO",
        duration: "tempoh ISO",
        ipv4: "alamat IPv4",
        ipv6: "alamat IPv6",
        cidrv4: "julat IPv4",
        cidrv6: "julat IPv6",
        base64: "string dikodkan base64",
        base64url: "string dikodkan base64url",
        json_string: "string JSON",
        e164: "nombor E.164",
        jwt: "JWT",
        template_literal: "input",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "nombor",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Input tidak sah: dijangka instanceof ${issue.expected}, diterima ${received}`;
                }
                return `Input tidak sah: dijangka ${expected}, diterima ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Input tidak sah: dijangka ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Pilihan tidak sah: dijangka salah satu daripada ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Terlalu besar: dijangka ${issue.origin ?? "nilai"} ${sizing.verb} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elemen"}`;
                return `Terlalu besar: dijangka ${issue.origin ?? "nilai"} adalah ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Terlalu kecil: dijangka ${issue.origin} ${sizing.verb} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Terlalu kecil: dijangka ${issue.origin} adalah ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `String tidak sah: mesti bermula dengan "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `String tidak sah: mesti berakhir dengan "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `String tidak sah: mesti mengandungi "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `String tidak sah: mesti sepadan dengan corak ${_issue.pattern}`;
                return `${FormatDictionary[_issue.format] ?? issue.format} tidak sah`;
            }
            case "not_multiple_of":
                return `Nombor tidak sah: perlu gandaan ${issue.divisor}`;
            case "unrecognized_keys":
                return `Kunci tidak dikenali: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Kunci tidak sah dalam ${issue.origin}`;
            case "invalid_union":
                return "Input tidak sah";
            case "invalid_element":
                return `Nilai tidak sah dalam ${issue.origin}`;
            default:
                return `Input tidak sah`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/nl.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "tekens", verb: "heeft" },
        file: { unit: "bytes", verb: "heeft" },
        array: { unit: "elementen", verb: "heeft" },
        set: { unit: "elementen", verb: "heeft" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "invoer",
        email: "emailadres",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO datum en tijd",
        date: "ISO datum",
        time: "ISO tijd",
        duration: "ISO duur",
        ipv4: "IPv4-adres",
        ipv6: "IPv6-adres",
        cidrv4: "IPv4-bereik",
        cidrv6: "IPv6-bereik",
        base64: "base64-gecodeerde tekst",
        base64url: "base64 URL-gecodeerde tekst",
        json_string: "JSON string",
        e164: "E.164-nummer",
        jwt: "JWT",
        template_literal: "invoer",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "getal",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Ongeldige invoer: verwacht instanceof ${issue.expected}, ontving ${received}`;
                }
                return `Ongeldige invoer: verwacht ${expected}, ontving ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Ongeldige invoer: verwacht ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Ongeldige optie: verwacht één van ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                const longName = issue.origin === "date" ? "laat" : issue.origin === "string" ? "lang" : "groot";
                if (sizing)
                    return `Te ${longName}: verwacht dat ${issue.origin ?? "waarde"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementen"} ${sizing.verb}`;
                return `Te ${longName}: verwacht dat ${issue.origin ?? "waarde"} ${adj}${issue.maximum.toString()} is`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                const shortName = issue.origin === "date" ? "vroeg" : issue.origin === "string" ? "kort" : "klein";
                if (sizing) {
                    return `Te ${shortName}: verwacht dat ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit} ${sizing.verb}`;
                }
                return `Te ${shortName}: verwacht dat ${issue.origin} ${adj}${issue.minimum.toString()} is`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `Ongeldige tekst: moet met "${_issue.prefix}" beginnen`;
                }
                if (_issue.format === "ends_with")
                    return `Ongeldige tekst: moet op "${_issue.suffix}" eindigen`;
                if (_issue.format === "includes")
                    return `Ongeldige tekst: moet "${_issue.includes}" bevatten`;
                if (_issue.format === "regex")
                    return `Ongeldige tekst: moet overeenkomen met patroon ${_issue.pattern}`;
                return `Ongeldig: ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Ongeldig getal: moet een veelvoud van ${issue.divisor} zijn`;
            case "unrecognized_keys":
                return `Onbekende key${issue.keys.length > 1 ? "s" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Ongeldige key in ${issue.origin}`;
            case "invalid_union":
                return "Ongeldige invoer";
            case "invalid_element":
                return `Ongeldige waarde in ${issue.origin}`;
            default:
                return `Ongeldige invoer`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/no.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "tegn", verb: "å ha" },
        file: { unit: "bytes", verb: "å ha" },
        array: { unit: "elementer", verb: "å inneholde" },
        set: { unit: "elementer", verb: "å inneholde" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "input",
        email: "e-postadresse",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO dato- og klokkeslett",
        date: "ISO-dato",
        time: "ISO-klokkeslett",
        duration: "ISO-varighet",
        ipv4: "IPv4-område",
        ipv6: "IPv6-område",
        cidrv4: "IPv4-spekter",
        cidrv6: "IPv6-spekter",
        base64: "base64-enkodet streng",
        base64url: "base64url-enkodet streng",
        json_string: "JSON-streng",
        e164: "E.164-nummer",
        jwt: "JWT",
        template_literal: "input",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "tall",
        array: "liste",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Ugyldig input: forventet instanceof ${issue.expected}, fikk ${received}`;
                }
                return `Ugyldig input: forventet ${expected}, fikk ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Ugyldig verdi: forventet ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Ugyldig valg: forventet en av ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `For stor(t): forventet ${issue.origin ?? "value"} til å ha ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementer"}`;
                return `For stor(t): forventet ${issue.origin ?? "value"} til å ha ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `For lite(n): forventet ${issue.origin} til å ha ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `For lite(n): forventet ${issue.origin} til å ha ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Ugyldig streng: må starte med "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Ugyldig streng: må ende med "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Ugyldig streng: må inneholde "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Ugyldig streng: må matche mønsteret ${_issue.pattern}`;
                return `Ugyldig ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Ugyldig tall: må være et multiplum av ${issue.divisor}`;
            case "unrecognized_keys":
                return `${issue.keys.length > 1 ? "Ukjente nøkler" : "Ukjent nøkkel"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Ugyldig nøkkel i ${issue.origin}`;
            case "invalid_union":
                return "Ugyldig input";
            case "invalid_element":
                return `Ugyldig verdi i ${issue.origin}`;
            default:
                return `Ugyldig input`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ota.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "harf", verb: "olmalıdır" },
        file: { unit: "bayt", verb: "olmalıdır" },
        array: { unit: "unsur", verb: "olmalıdır" },
        set: { unit: "unsur", verb: "olmalıdır" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "giren",
        email: "epostagâh",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO hengâmı",
        date: "ISO tarihi",
        time: "ISO zamanı",
        duration: "ISO müddeti",
        ipv4: "IPv4 nişânı",
        ipv6: "IPv6 nişânı",
        cidrv4: "IPv4 menzili",
        cidrv6: "IPv6 menzili",
        base64: "base64-şifreli metin",
        base64url: "base64url-şifreli metin",
        json_string: "JSON metin",
        e164: "E.164 sayısı",
        jwt: "JWT",
        template_literal: "giren",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "numara",
        array: "saf",
        null: "gayb",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Fâsit giren: umulan instanceof ${issue.expected}, alınan ${received}`;
                }
                return `Fâsit giren: umulan ${expected}, alınan ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Fâsit giren: umulan ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Fâsit tercih: mûteberler ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Fazla büyük: ${issue.origin ?? "value"}, ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"} sahip olmalıydı.`;
                return `Fazla büyük: ${issue.origin ?? "value"}, ${adj}${issue.maximum.toString()} olmalıydı.`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Fazla küçük: ${issue.origin}, ${adj}${issue.minimum.toString()} ${sizing.unit} sahip olmalıydı.`;
                }
                return `Fazla küçük: ${issue.origin}, ${adj}${issue.minimum.toString()} olmalıydı.`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Fâsit metin: "${_issue.prefix}" ile başlamalı.`;
                if (_issue.format === "ends_with")
                    return `Fâsit metin: "${_issue.suffix}" ile bitmeli.`;
                if (_issue.format === "includes")
                    return `Fâsit metin: "${_issue.includes}" ihtivâ etmeli.`;
                if (_issue.format === "regex")
                    return `Fâsit metin: ${_issue.pattern} nakşına uymalı.`;
                return `Fâsit ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Fâsit sayı: ${issue.divisor} katı olmalıydı.`;
            case "unrecognized_keys":
                return `Tanınmayan anahtar ${issue.keys.length > 1 ? "s" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `${issue.origin} için tanınmayan anahtar var.`;
            case "invalid_union":
                return "Giren tanınamadı.";
            case "invalid_element":
                return `${issue.origin} için tanınmayan kıymet var.`;
            default:
                return `Kıymet tanınamadı.`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/pl.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "znaków", verb: "mieć" },
        file: { unit: "bajtów", verb: "mieć" },
        array: { unit: "elementów", verb: "mieć" },
        set: { unit: "elementów", verb: "mieć" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "wyrażenie",
        email: "adres email",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "data i godzina w formacie ISO",
        date: "data w formacie ISO",
        time: "godzina w formacie ISO",
        duration: "czas trwania ISO",
        ipv4: "adres IPv4",
        ipv6: "adres IPv6",
        cidrv4: "zakres IPv4",
        cidrv6: "zakres IPv6",
        base64: "ciąg znaków zakodowany w formacie base64",
        base64url: "ciąg znaków zakodowany w formacie base64url",
        json_string: "ciąg znaków w formacie JSON",
        e164: "liczba E.164",
        jwt: "JWT",
        template_literal: "wejście",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "liczba",
        array: "tablica",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Nieprawidłowe dane wejściowe: oczekiwano instanceof ${issue.expected}, otrzymano ${received}`;
                }
                return `Nieprawidłowe dane wejściowe: oczekiwano ${expected}, otrzymano ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Nieprawidłowe dane wejściowe: oczekiwano ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Nieprawidłowa opcja: oczekiwano jednej z wartości ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Za duża wartość: oczekiwano, że ${issue.origin ?? "wartość"} będzie mieć ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementów"}`;
                }
                return `Zbyt duż(y/a/e): oczekiwano, że ${issue.origin ?? "wartość"} będzie wynosić ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Za mała wartość: oczekiwano, że ${issue.origin ?? "wartość"} będzie mieć ${adj}${issue.minimum.toString()} ${sizing.unit ?? "elementów"}`;
                }
                return `Zbyt mał(y/a/e): oczekiwano, że ${issue.origin ?? "wartość"} będzie wynosić ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Nieprawidłowy ciąg znaków: musi zaczynać się od "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Nieprawidłowy ciąg znaków: musi kończyć się na "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Nieprawidłowy ciąg znaków: musi zawierać "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Nieprawidłowy ciąg znaków: musi odpowiadać wzorcowi ${_issue.pattern}`;
                return `Nieprawidłow(y/a/e) ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Nieprawidłowa liczba: musi być wielokrotnością ${issue.divisor}`;
            case "unrecognized_keys":
                return `Nierozpoznane klucze${issue.keys.length > 1 ? "s" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Nieprawidłowy klucz w ${issue.origin}`;
            case "invalid_union":
                return "Nieprawidłowe dane wejściowe";
            case "invalid_element":
                return `Nieprawidłowa wartość w ${issue.origin}`;
            default:
                return `Nieprawidłowe dane wejściowe`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ps.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "توکي", verb: "ولري" },
        file: { unit: "بایټس", verb: "ولري" },
        array: { unit: "توکي", verb: "ولري" },
        set: { unit: "توکي", verb: "ولري" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "ورودي",
        email: "بریښنالیک",
        url: "یو آر ال",
        emoji: "ایموجي",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "نیټه او وخت",
        date: "نېټه",
        time: "وخت",
        duration: "موده",
        ipv4: "د IPv4 پته",
        ipv6: "د IPv6 پته",
        cidrv4: "د IPv4 ساحه",
        cidrv6: "د IPv6 ساحه",
        base64: "base64-encoded متن",
        base64url: "base64url-encoded متن",
        json_string: "JSON متن",
        e164: "د E.164 شمېره",
        jwt: "JWT",
        template_literal: "ورودي",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "عدد",
        array: "ارې",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `ناسم ورودي: باید instanceof ${issue.expected} وای, مګر ${received} ترلاسه شو`;
                }
                return `ناسم ورودي: باید ${expected} وای, مګر ${received} ترلاسه شو`;
            }
            case "invalid_value":
                if (issue.values.length === 1) {
                    return `ناسم ورودي: باید ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])} وای`;
                }
                return `ناسم انتخاب: باید یو له ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")} څخه وای`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `ډیر لوی: ${issue.origin ?? "ارزښت"} باید ${adj}${issue.maximum.toString()} ${sizing.unit ?? "عنصرونه"} ولري`;
                }
                return `ډیر لوی: ${issue.origin ?? "ارزښت"} باید ${adj}${issue.maximum.toString()} وي`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `ډیر کوچنی: ${issue.origin} باید ${adj}${issue.minimum.toString()} ${sizing.unit} ولري`;
                }
                return `ډیر کوچنی: ${issue.origin} باید ${adj}${issue.minimum.toString()} وي`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `ناسم متن: باید د "${_issue.prefix}" سره پیل شي`;
                }
                if (_issue.format === "ends_with") {
                    return `ناسم متن: باید د "${_issue.suffix}" سره پای ته ورسيږي`;
                }
                if (_issue.format === "includes") {
                    return `ناسم متن: باید "${_issue.includes}" ولري`;
                }
                if (_issue.format === "regex") {
                    return `ناسم متن: باید د ${_issue.pattern} سره مطابقت ولري`;
                }
                return `${FormatDictionary[_issue.format] ?? issue.format} ناسم دی`;
            }
            case "not_multiple_of":
                return `ناسم عدد: باید د ${issue.divisor} مضرب وي`;
            case "unrecognized_keys":
                return `ناسم ${issue.keys.length > 1 ? "کلیډونه" : "کلیډ"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `ناسم کلیډ په ${issue.origin} کې`;
            case "invalid_union":
                return `ناسمه ورودي`;
            case "invalid_element":
                return `ناسم عنصر په ${issue.origin} کې`;
            default:
                return `ناسمه ورودي`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/pt.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "caracteres", verb: "ter" },
        file: { unit: "bytes", verb: "ter" },
        array: { unit: "itens", verb: "ter" },
        set: { unit: "itens", verb: "ter" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "padrão",
        email: "endereço de e-mail",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "data e hora ISO",
        date: "data ISO",
        time: "hora ISO",
        duration: "duração ISO",
        ipv4: "endereço IPv4",
        ipv6: "endereço IPv6",
        cidrv4: "faixa de IPv4",
        cidrv6: "faixa de IPv6",
        base64: "texto codificado em base64",
        base64url: "URL codificada em base64",
        json_string: "texto JSON",
        e164: "número E.164",
        jwt: "JWT",
        template_literal: "entrada",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "número",
        null: "nulo",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Tipo inválido: esperado instanceof ${issue.expected}, recebido ${received}`;
                }
                return `Tipo inválido: esperado ${expected}, recebido ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Entrada inválida: esperado ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Opção inválida: esperada uma das ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Muito grande: esperado que ${issue.origin ?? "valor"} tivesse ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementos"}`;
                return `Muito grande: esperado que ${issue.origin ?? "valor"} fosse ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Muito pequeno: esperado que ${issue.origin} tivesse ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Muito pequeno: esperado que ${issue.origin} fosse ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Texto inválido: deve começar com "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Texto inválido: deve terminar com "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Texto inválido: deve incluir "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Texto inválido: deve corresponder ao padrão ${_issue.pattern}`;
                return `${FormatDictionary[_issue.format] ?? issue.format} inválido`;
            }
            case "not_multiple_of":
                return `Número inválido: deve ser múltiplo de ${issue.divisor}`;
            case "unrecognized_keys":
                return `Chave${issue.keys.length > 1 ? "s" : ""} desconhecida${issue.keys.length > 1 ? "s" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Chave inválida em ${issue.origin}`;
            case "invalid_union":
                return "Entrada inválida";
            case "invalid_element":
                return `Valor inválido em ${issue.origin}`;
            default:
                return `Campo inválido`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ru.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

function getRussianPlural(count, one, few, many) {
    const absCount = Math.abs(count);
    const lastDigit = absCount % 10;
    const lastTwoDigits = absCount % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
        return many;
    }
    if (lastDigit === 1) {
        return one;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
        return few;
    }
    return many;
}
const error = () => {
    const Sizable = {
        string: {
            unit: {
                one: "символ",
                few: "символа",
                many: "символов",
            },
            verb: "иметь",
        },
        file: {
            unit: {
                one: "байт",
                few: "байта",
                many: "байт",
            },
            verb: "иметь",
        },
        array: {
            unit: {
                one: "элемент",
                few: "элемента",
                many: "элементов",
            },
            verb: "иметь",
        },
        set: {
            unit: {
                one: "элемент",
                few: "элемента",
                many: "элементов",
            },
            verb: "иметь",
        },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "ввод",
        email: "email адрес",
        url: "URL",
        emoji: "эмодзи",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO дата и время",
        date: "ISO дата",
        time: "ISO время",
        duration: "ISO длительность",
        ipv4: "IPv4 адрес",
        ipv6: "IPv6 адрес",
        cidrv4: "IPv4 диапазон",
        cidrv6: "IPv6 диапазон",
        base64: "строка в формате base64",
        base64url: "строка в формате base64url",
        json_string: "JSON строка",
        e164: "номер E.164",
        jwt: "JWT",
        template_literal: "ввод",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "число",
        array: "массив",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Неверный ввод: ожидалось instanceof ${issue.expected}, получено ${received}`;
                }
                return `Неверный ввод: ожидалось ${expected}, получено ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Неверный ввод: ожидалось ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Неверный вариант: ожидалось одно из ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    const maxValue = Number(issue.maximum);
                    const unit = getRussianPlural(maxValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
                    return `Слишком большое значение: ожидалось, что ${issue.origin ?? "значение"} будет иметь ${adj}${issue.maximum.toString()} ${unit}`;
                }
                return `Слишком большое значение: ожидалось, что ${issue.origin ?? "значение"} будет ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    const minValue = Number(issue.minimum);
                    const unit = getRussianPlural(minValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
                    return `Слишком маленькое значение: ожидалось, что ${issue.origin} будет иметь ${adj}${issue.minimum.toString()} ${unit}`;
                }
                return `Слишком маленькое значение: ожидалось, что ${issue.origin} будет ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Неверная строка: должна начинаться с "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Неверная строка: должна заканчиваться на "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Неверная строка: должна содержать "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Неверная строка: должна соответствовать шаблону ${_issue.pattern}`;
                return `Неверный ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Неверное число: должно быть кратным ${issue.divisor}`;
            case "unrecognized_keys":
                return `Нераспознанн${issue.keys.length > 1 ? "ые" : "ый"} ключ${issue.keys.length > 1 ? "и" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Неверный ключ в ${issue.origin}`;
            case "invalid_union":
                return "Неверные входные данные";
            case "invalid_element":
                return `Неверное значение в ${issue.origin}`;
            default:
                return `Неверные входные данные`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/sl.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "znakov", verb: "imeti" },
        file: { unit: "bajtov", verb: "imeti" },
        array: { unit: "elementov", verb: "imeti" },
        set: { unit: "elementov", verb: "imeti" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "vnos",
        email: "e-poštni naslov",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO datum in čas",
        date: "ISO datum",
        time: "ISO čas",
        duration: "ISO trajanje",
        ipv4: "IPv4 naslov",
        ipv6: "IPv6 naslov",
        cidrv4: "obseg IPv4",
        cidrv6: "obseg IPv6",
        base64: "base64 kodiran niz",
        base64url: "base64url kodiran niz",
        json_string: "JSON niz",
        e164: "E.164 številka",
        jwt: "JWT",
        template_literal: "vnos",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "število",
        array: "tabela",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Neveljaven vnos: pričakovano instanceof ${issue.expected}, prejeto ${received}`;
                }
                return `Neveljaven vnos: pričakovano ${expected}, prejeto ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Neveljaven vnos: pričakovano ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Neveljavna možnost: pričakovano eno izmed ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Preveliko: pričakovano, da bo ${issue.origin ?? "vrednost"} imelo ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementov"}`;
                return `Preveliko: pričakovano, da bo ${issue.origin ?? "vrednost"} ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Premajhno: pričakovano, da bo ${issue.origin} imelo ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Premajhno: pričakovano, da bo ${issue.origin} ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `Neveljaven niz: mora se začeti z "${_issue.prefix}"`;
                }
                if (_issue.format === "ends_with")
                    return `Neveljaven niz: mora se končati z "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Neveljaven niz: mora vsebovati "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Neveljaven niz: mora ustrezati vzorcu ${_issue.pattern}`;
                return `Neveljaven ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Neveljavno število: mora biti večkratnik ${issue.divisor}`;
            case "unrecognized_keys":
                return `Neprepoznan${issue.keys.length > 1 ? "i ključi" : " ključ"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Neveljaven ključ v ${issue.origin}`;
            case "invalid_union":
                return "Neveljaven vnos";
            case "invalid_element":
                return `Neveljavna vrednost v ${issue.origin}`;
            default:
                return "Neveljaven vnos";
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/sv.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "tecken", verb: "att ha" },
        file: { unit: "bytes", verb: "att ha" },
        array: { unit: "objekt", verb: "att innehålla" },
        set: { unit: "objekt", verb: "att innehålla" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "reguljärt uttryck",
        email: "e-postadress",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO-datum och tid",
        date: "ISO-datum",
        time: "ISO-tid",
        duration: "ISO-varaktighet",
        ipv4: "IPv4-intervall",
        ipv6: "IPv6-intervall",
        cidrv4: "IPv4-spektrum",
        cidrv6: "IPv6-spektrum",
        base64: "base64-kodad sträng",
        base64url: "base64url-kodad sträng",
        json_string: "JSON-sträng",
        e164: "E.164-nummer",
        jwt: "JWT",
        template_literal: "mall-literal",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "antal",
        array: "lista",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Ogiltig inmatning: förväntat instanceof ${issue.expected}, fick ${received}`;
                }
                return `Ogiltig inmatning: förväntat ${expected}, fick ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Ogiltig inmatning: förväntat ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Ogiltigt val: förväntade en av ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `För stor(t): förväntade ${issue.origin ?? "värdet"} att ha ${adj}${issue.maximum.toString()} ${sizing.unit ?? "element"}`;
                }
                return `För stor(t): förväntat ${issue.origin ?? "värdet"} att ha ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `För lite(t): förväntade ${issue.origin ?? "värdet"} att ha ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `För lite(t): förväntade ${issue.origin ?? "värdet"} att ha ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `Ogiltig sträng: måste börja med "${_issue.prefix}"`;
                }
                if (_issue.format === "ends_with")
                    return `Ogiltig sträng: måste sluta med "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Ogiltig sträng: måste innehålla "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Ogiltig sträng: måste matcha mönstret "${_issue.pattern}"`;
                return `Ogiltig(t) ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Ogiltigt tal: måste vara en multipel av ${issue.divisor}`;
            case "unrecognized_keys":
                return `${issue.keys.length > 1 ? "Okända nycklar" : "Okänd nyckel"}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Ogiltig nyckel i ${issue.origin ?? "värdet"}`;
            case "invalid_union":
                return "Ogiltig input";
            case "invalid_element":
                return `Ogiltigt värde i ${issue.origin ?? "värdet"}`;
            default:
                return `Ogiltig input`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ta.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "எழுத்துக்கள்", verb: "கொண்டிருக்க வேண்டும்" },
        file: { unit: "பைட்டுகள்", verb: "கொண்டிருக்க வேண்டும்" },
        array: { unit: "உறுப்புகள்", verb: "கொண்டிருக்க வேண்டும்" },
        set: { unit: "உறுப்புகள்", verb: "கொண்டிருக்க வேண்டும்" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "உள்ளீடு",
        email: "மின்னஞ்சல் முகவரி",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO தேதி நேரம்",
        date: "ISO தேதி",
        time: "ISO நேரம்",
        duration: "ISO கால அளவு",
        ipv4: "IPv4 முகவரி",
        ipv6: "IPv6 முகவரி",
        cidrv4: "IPv4 வரம்பு",
        cidrv6: "IPv6 வரம்பு",
        base64: "base64-encoded சரம்",
        base64url: "base64url-encoded சரம்",
        json_string: "JSON சரம்",
        e164: "E.164 எண்",
        jwt: "JWT",
        template_literal: "input",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "எண்",
        array: "அணி",
        null: "வெறுமை",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `தவறான உள்ளீடு: எதிர்பார்க்கப்பட்டது instanceof ${issue.expected}, பெறப்பட்டது ${received}`;
                }
                return `தவறான உள்ளீடு: எதிர்பார்க்கப்பட்டது ${expected}, பெறப்பட்டது ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `தவறான உள்ளீடு: எதிர்பார்க்கப்பட்டது ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `தவறான விருப்பம்: எதிர்பார்க்கப்பட்டது ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")} இல் ஒன்று`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `மிக பெரியது: எதிர்பார்க்கப்பட்டது ${issue.origin ?? "மதிப்பு"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "உறுப்புகள்"} ஆக இருக்க வேண்டும்`;
                }
                return `மிக பெரியது: எதிர்பார்க்கப்பட்டது ${issue.origin ?? "மதிப்பு"} ${adj}${issue.maximum.toString()} ஆக இருக்க வேண்டும்`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `மிகச் சிறியது: எதிர்பார்க்கப்பட்டது ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit} ஆக இருக்க வேண்டும்`; //
                }
                return `மிகச் சிறியது: எதிர்பார்க்கப்பட்டது ${issue.origin} ${adj}${issue.minimum.toString()} ஆக இருக்க வேண்டும்`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `தவறான சரம்: "${_issue.prefix}" இல் தொடங்க வேண்டும்`;
                if (_issue.format === "ends_with")
                    return `தவறான சரம்: "${_issue.suffix}" இல் முடிவடைய வேண்டும்`;
                if (_issue.format === "includes")
                    return `தவறான சரம்: "${_issue.includes}" ஐ உள்ளடக்க வேண்டும்`;
                if (_issue.format === "regex")
                    return `தவறான சரம்: ${_issue.pattern} முறைபாட்டுடன் பொருந்த வேண்டும்`;
                return `தவறான ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `தவறான எண்: ${issue.divisor} இன் பலமாக இருக்க வேண்டும்`;
            case "unrecognized_keys":
                return `அடையாளம் தெரியாத விசை${issue.keys.length > 1 ? "கள்" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `${issue.origin} இல் தவறான விசை`;
            case "invalid_union":
                return "தவறான உள்ளீடு";
            case "invalid_element":
                return `${issue.origin} இல் தவறான மதிப்பு`;
            default:
                return `தவறான உள்ளீடு`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/th.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "ตัวอักษร", verb: "ควรมี" },
        file: { unit: "ไบต์", verb: "ควรมี" },
        array: { unit: "รายการ", verb: "ควรมี" },
        set: { unit: "รายการ", verb: "ควรมี" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "ข้อมูลที่ป้อน",
        email: "ที่อยู่อีเมล",
        url: "URL",
        emoji: "อิโมจิ",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "วันที่เวลาแบบ ISO",
        date: "วันที่แบบ ISO",
        time: "เวลาแบบ ISO",
        duration: "ช่วงเวลาแบบ ISO",
        ipv4: "ที่อยู่ IPv4",
        ipv6: "ที่อยู่ IPv6",
        cidrv4: "ช่วง IP แบบ IPv4",
        cidrv6: "ช่วง IP แบบ IPv6",
        base64: "ข้อความแบบ Base64",
        base64url: "ข้อความแบบ Base64 สำหรับ URL",
        json_string: "ข้อความแบบ JSON",
        e164: "เบอร์โทรศัพท์ระหว่างประเทศ (E.164)",
        jwt: "โทเคน JWT",
        template_literal: "ข้อมูลที่ป้อน",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "ตัวเลข",
        array: "อาร์เรย์ (Array)",
        null: "ไม่มีค่า (null)",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `ประเภทข้อมูลไม่ถูกต้อง: ควรเป็น instanceof ${issue.expected} แต่ได้รับ ${received}`;
                }
                return `ประเภทข้อมูลไม่ถูกต้อง: ควรเป็น ${expected} แต่ได้รับ ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `ค่าไม่ถูกต้อง: ควรเป็น ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `ตัวเลือกไม่ถูกต้อง: ควรเป็นหนึ่งใน ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "ไม่เกิน" : "น้อยกว่า";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `เกินกำหนด: ${issue.origin ?? "ค่า"} ควรมี${adj} ${issue.maximum.toString()} ${sizing.unit ?? "รายการ"}`;
                return `เกินกำหนด: ${issue.origin ?? "ค่า"} ควรมี${adj} ${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? "อย่างน้อย" : "มากกว่า";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `น้อยกว่ากำหนด: ${issue.origin} ควรมี${adj} ${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `น้อยกว่ากำหนด: ${issue.origin} ควรมี${adj} ${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `รูปแบบไม่ถูกต้อง: ข้อความต้องขึ้นต้นด้วย "${_issue.prefix}"`;
                }
                if (_issue.format === "ends_with")
                    return `รูปแบบไม่ถูกต้อง: ข้อความต้องลงท้ายด้วย "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `รูปแบบไม่ถูกต้อง: ข้อความต้องมี "${_issue.includes}" อยู่ในข้อความ`;
                if (_issue.format === "regex")
                    return `รูปแบบไม่ถูกต้อง: ต้องตรงกับรูปแบบที่กำหนด ${_issue.pattern}`;
                return `รูปแบบไม่ถูกต้อง: ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `ตัวเลขไม่ถูกต้อง: ต้องเป็นจำนวนที่หารด้วย ${issue.divisor} ได้ลงตัว`;
            case "unrecognized_keys":
                return `พบคีย์ที่ไม่รู้จัก: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `คีย์ไม่ถูกต้องใน ${issue.origin}`;
            case "invalid_union":
                return "ข้อมูลไม่ถูกต้อง: ไม่ตรงกับรูปแบบยูเนียนที่กำหนดไว้";
            case "invalid_element":
                return `ข้อมูลไม่ถูกต้องใน ${issue.origin}`;
            default:
                return `ข้อมูลไม่ถูกต้อง`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/tr.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "karakter", verb: "olmalı" },
        file: { unit: "bayt", verb: "olmalı" },
        array: { unit: "öğe", verb: "olmalı" },
        set: { unit: "öğe", verb: "olmalı" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "girdi",
        email: "e-posta adresi",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO tarih ve saat",
        date: "ISO tarih",
        time: "ISO saat",
        duration: "ISO süre",
        ipv4: "IPv4 adresi",
        ipv6: "IPv6 adresi",
        cidrv4: "IPv4 aralığı",
        cidrv6: "IPv6 aralığı",
        base64: "base64 ile şifrelenmiş metin",
        base64url: "base64url ile şifrelenmiş metin",
        json_string: "JSON dizesi",
        e164: "E.164 sayısı",
        jwt: "JWT",
        template_literal: "Şablon dizesi",
    };
    const TypeDictionary = {
        nan: "NaN",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Geçersiz değer: beklenen instanceof ${issue.expected}, alınan ${received}`;
                }
                return `Geçersiz değer: beklenen ${expected}, alınan ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Geçersiz değer: beklenen ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Geçersiz seçenek: aşağıdakilerden biri olmalı: ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Çok büyük: beklenen ${issue.origin ?? "değer"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "öğe"}`;
                return `Çok büyük: beklenen ${issue.origin ?? "değer"} ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Çok küçük: beklenen ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                return `Çok küçük: beklenen ${issue.origin} ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Geçersiz metin: "${_issue.prefix}" ile başlamalı`;
                if (_issue.format === "ends_with")
                    return `Geçersiz metin: "${_issue.suffix}" ile bitmeli`;
                if (_issue.format === "includes")
                    return `Geçersiz metin: "${_issue.includes}" içermeli`;
                if (_issue.format === "regex")
                    return `Geçersiz metin: ${_issue.pattern} desenine uymalı`;
                return `Geçersiz ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Geçersiz sayı: ${issue.divisor} ile tam bölünebilmeli`;
            case "unrecognized_keys":
                return `Tanınmayan anahtar${issue.keys.length > 1 ? "lar" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `${issue.origin} içinde geçersiz anahtar`;
            case "invalid_union":
                return "Geçersiz değer";
            case "invalid_element":
                return `${issue.origin} içinde geçersiz değer`;
            default:
                return `Geçersiz değer`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ua.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _uk_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/uk.js");

/** @deprecated Use `uk` instead. */
/* export default */ function __rspack_default_export() {
    return (0,_uk_js__rspack_import_0["default"])();
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/uk.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "символів", verb: "матиме" },
        file: { unit: "байтів", verb: "матиме" },
        array: { unit: "елементів", verb: "матиме" },
        set: { unit: "елементів", verb: "матиме" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "вхідні дані",
        email: "адреса електронної пошти",
        url: "URL",
        emoji: "емодзі",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "дата та час ISO",
        date: "дата ISO",
        time: "час ISO",
        duration: "тривалість ISO",
        ipv4: "адреса IPv4",
        ipv6: "адреса IPv6",
        cidrv4: "діапазон IPv4",
        cidrv6: "діапазон IPv6",
        base64: "рядок у кодуванні base64",
        base64url: "рядок у кодуванні base64url",
        json_string: "рядок JSON",
        e164: "номер E.164",
        jwt: "JWT",
        template_literal: "вхідні дані",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "число",
        array: "масив",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Неправильні вхідні дані: очікується instanceof ${issue.expected}, отримано ${received}`;
                }
                return `Неправильні вхідні дані: очікується ${expected}, отримано ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Неправильні вхідні дані: очікується ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Неправильна опція: очікується одне з ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Занадто велике: очікується, що ${issue.origin ?? "значення"} ${sizing.verb} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "елементів"}`;
                return `Занадто велике: очікується, що ${issue.origin ?? "значення"} буде ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Занадто мале: очікується, що ${issue.origin} ${sizing.verb} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Занадто мале: очікується, що ${issue.origin} буде ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Неправильний рядок: повинен починатися з "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Неправильний рядок: повинен закінчуватися на "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Неправильний рядок: повинен містити "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Неправильний рядок: повинен відповідати шаблону ${_issue.pattern}`;
                return `Неправильний ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Неправильне число: повинно бути кратним ${issue.divisor}`;
            case "unrecognized_keys":
                return `Нерозпізнаний ключ${issue.keys.length > 1 ? "і" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Неправильний ключ у ${issue.origin}`;
            case "invalid_union":
                return "Неправильні вхідні дані";
            case "invalid_element":
                return `Неправильне значення у ${issue.origin}`;
            default:
                return `Неправильні вхідні дані`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/ur.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "حروف", verb: "ہونا" },
        file: { unit: "بائٹس", verb: "ہونا" },
        array: { unit: "آئٹمز", verb: "ہونا" },
        set: { unit: "آئٹمز", verb: "ہونا" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "ان پٹ",
        email: "ای میل ایڈریس",
        url: "یو آر ایل",
        emoji: "ایموجی",
        uuid: "یو یو آئی ڈی",
        uuidv4: "یو یو آئی ڈی وی 4",
        uuidv6: "یو یو آئی ڈی وی 6",
        nanoid: "نینو آئی ڈی",
        guid: "جی یو آئی ڈی",
        cuid: "سی یو آئی ڈی",
        cuid2: "سی یو آئی ڈی 2",
        ulid: "یو ایل آئی ڈی",
        xid: "ایکس آئی ڈی",
        ksuid: "کے ایس یو آئی ڈی",
        datetime: "آئی ایس او ڈیٹ ٹائم",
        date: "آئی ایس او تاریخ",
        time: "آئی ایس او وقت",
        duration: "آئی ایس او مدت",
        ipv4: "آئی پی وی 4 ایڈریس",
        ipv6: "آئی پی وی 6 ایڈریس",
        cidrv4: "آئی پی وی 4 رینج",
        cidrv6: "آئی پی وی 6 رینج",
        base64: "بیس 64 ان کوڈڈ سٹرنگ",
        base64url: "بیس 64 یو آر ایل ان کوڈڈ سٹرنگ",
        json_string: "جے ایس او این سٹرنگ",
        e164: "ای 164 نمبر",
        jwt: "جے ڈبلیو ٹی",
        template_literal: "ان پٹ",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "نمبر",
        array: "آرے",
        null: "نل",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `غلط ان پٹ: instanceof ${issue.expected} متوقع تھا، ${received} موصول ہوا`;
                }
                return `غلط ان پٹ: ${expected} متوقع تھا، ${received} موصول ہوا`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `غلط ان پٹ: ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])} متوقع تھا`;
                return `غلط آپشن: ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")} میں سے ایک متوقع تھا`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `بہت بڑا: ${issue.origin ?? "ویلیو"} کے ${adj}${issue.maximum.toString()} ${sizing.unit ?? "عناصر"} ہونے متوقع تھے`;
                return `بہت بڑا: ${issue.origin ?? "ویلیو"} کا ${adj}${issue.maximum.toString()} ہونا متوقع تھا`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `بہت چھوٹا: ${issue.origin} کے ${adj}${issue.minimum.toString()} ${sizing.unit} ہونے متوقع تھے`;
                }
                return `بہت چھوٹا: ${issue.origin} کا ${adj}${issue.minimum.toString()} ہونا متوقع تھا`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `غلط سٹرنگ: "${_issue.prefix}" سے شروع ہونا چاہیے`;
                }
                if (_issue.format === "ends_with")
                    return `غلط سٹرنگ: "${_issue.suffix}" پر ختم ہونا چاہیے`;
                if (_issue.format === "includes")
                    return `غلط سٹرنگ: "${_issue.includes}" شامل ہونا چاہیے`;
                if (_issue.format === "regex")
                    return `غلط سٹرنگ: پیٹرن ${_issue.pattern} سے میچ ہونا چاہیے`;
                return `غلط ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `غلط نمبر: ${issue.divisor} کا مضاعف ہونا چاہیے`;
            case "unrecognized_keys":
                return `غیر تسلیم شدہ کی${issue.keys.length > 1 ? "ز" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, "، ")}`;
            case "invalid_key":
                return `${issue.origin} میں غلط کی`;
            case "invalid_union":
                return "غلط ان پٹ";
            case "invalid_element":
                return `${issue.origin} میں غلط ویلیو`;
            default:
                return `غلط ان پٹ`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/uz.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "belgi", verb: "bo‘lishi kerak" },
        file: { unit: "bayt", verb: "bo‘lishi kerak" },
        array: { unit: "element", verb: "bo‘lishi kerak" },
        set: { unit: "element", verb: "bo‘lishi kerak" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "kirish",
        email: "elektron pochta manzili",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO sana va vaqti",
        date: "ISO sana",
        time: "ISO vaqt",
        duration: "ISO davomiylik",
        ipv4: "IPv4 manzil",
        ipv6: "IPv6 manzil",
        mac: "MAC manzil",
        cidrv4: "IPv4 diapazon",
        cidrv6: "IPv6 diapazon",
        base64: "base64 kodlangan satr",
        base64url: "base64url kodlangan satr",
        json_string: "JSON satr",
        e164: "E.164 raqam",
        jwt: "JWT",
        template_literal: "kirish",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "raqam",
        array: "massiv",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Noto‘g‘ri kirish: kutilgan instanceof ${issue.expected}, qabul qilingan ${received}`;
                }
                return `Noto‘g‘ri kirish: kutilgan ${expected}, qabul qilingan ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Noto‘g‘ri kirish: kutilgan ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Noto‘g‘ri variant: quyidagilardan biri kutilgan ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Juda katta: kutilgan ${issue.origin ?? "qiymat"} ${adj}${issue.maximum.toString()} ${sizing.unit} ${sizing.verb}`;
                return `Juda katta: kutilgan ${issue.origin ?? "qiymat"} ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Juda kichik: kutilgan ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit} ${sizing.verb}`;
                }
                return `Juda kichik: kutilgan ${issue.origin} ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Noto‘g‘ri satr: "${_issue.prefix}" bilan boshlanishi kerak`;
                if (_issue.format === "ends_with")
                    return `Noto‘g‘ri satr: "${_issue.suffix}" bilan tugashi kerak`;
                if (_issue.format === "includes")
                    return `Noto‘g‘ri satr: "${_issue.includes}" ni o‘z ichiga olishi kerak`;
                if (_issue.format === "regex")
                    return `Noto‘g‘ri satr: ${_issue.pattern} shabloniga mos kelishi kerak`;
                return `Noto‘g‘ri ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Noto‘g‘ri raqam: ${issue.divisor} ning karralisi bo‘lishi kerak`;
            case "unrecognized_keys":
                return `Noma’lum kalit${issue.keys.length > 1 ? "lar" : ""}: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `${issue.origin} dagi kalit noto‘g‘ri`;
            case "invalid_union":
                return "Noto‘g‘ri kirish";
            case "invalid_element":
                return `${issue.origin} da noto‘g‘ri qiymat`;
            default:
                return `Noto‘g‘ri kirish`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/vi.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "ký tự", verb: "có" },
        file: { unit: "byte", verb: "có" },
        array: { unit: "phần tử", verb: "có" },
        set: { unit: "phần tử", verb: "có" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "đầu vào",
        email: "địa chỉ email",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ngày giờ ISO",
        date: "ngày ISO",
        time: "giờ ISO",
        duration: "khoảng thời gian ISO",
        ipv4: "địa chỉ IPv4",
        ipv6: "địa chỉ IPv6",
        cidrv4: "dải IPv4",
        cidrv6: "dải IPv6",
        base64: "chuỗi mã hóa base64",
        base64url: "chuỗi mã hóa base64url",
        json_string: "chuỗi JSON",
        e164: "số E.164",
        jwt: "JWT",
        template_literal: "đầu vào",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "số",
        array: "mảng",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Đầu vào không hợp lệ: mong đợi instanceof ${issue.expected}, nhận được ${received}`;
                }
                return `Đầu vào không hợp lệ: mong đợi ${expected}, nhận được ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Đầu vào không hợp lệ: mong đợi ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Tùy chọn không hợp lệ: mong đợi một trong các giá trị ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Quá lớn: mong đợi ${issue.origin ?? "giá trị"} ${sizing.verb} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "phần tử"}`;
                return `Quá lớn: mong đợi ${issue.origin ?? "giá trị"} ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `Quá nhỏ: mong đợi ${issue.origin} ${sizing.verb} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `Quá nhỏ: mong đợi ${issue.origin} ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Chuỗi không hợp lệ: phải bắt đầu bằng "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Chuỗi không hợp lệ: phải kết thúc bằng "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Chuỗi không hợp lệ: phải bao gồm "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Chuỗi không hợp lệ: phải khớp với mẫu ${_issue.pattern}`;
                return `${FormatDictionary[_issue.format] ?? issue.format} không hợp lệ`;
            }
            case "not_multiple_of":
                return `Số không hợp lệ: phải là bội số của ${issue.divisor}`;
            case "unrecognized_keys":
                return `Khóa không được nhận dạng: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Khóa không hợp lệ trong ${issue.origin}`;
            case "invalid_union":
                return "Đầu vào không hợp lệ";
            case "invalid_element":
                return `Giá trị không hợp lệ trong ${issue.origin}`;
            default:
                return `Đầu vào không hợp lệ`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/yo.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "àmi", verb: "ní" },
        file: { unit: "bytes", verb: "ní" },
        array: { unit: "nkan", verb: "ní" },
        set: { unit: "nkan", verb: "ní" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "ẹ̀rọ ìbáwọlé",
        email: "àdírẹ́sì ìmẹ́lì",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "àkókò ISO",
        date: "ọjọ́ ISO",
        time: "àkókò ISO",
        duration: "àkókò tó pé ISO",
        ipv4: "àdírẹ́sì IPv4",
        ipv6: "àdírẹ́sì IPv6",
        cidrv4: "àgbègbè IPv4",
        cidrv6: "àgbègbè IPv6",
        base64: "ọ̀rọ̀ tí a kọ́ ní base64",
        base64url: "ọ̀rọ̀ base64url",
        json_string: "ọ̀rọ̀ JSON",
        e164: "nọ́mbà E.164",
        jwt: "JWT",
        template_literal: "ẹ̀rọ ìbáwọlé",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "nọ́mbà",
        array: "akopọ",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `Ìbáwọlé aṣìṣe: a ní láti fi instanceof ${issue.expected}, àmọ̀ a rí ${received}`;
                }
                return `Ìbáwọlé aṣìṣe: a ní láti fi ${expected}, àmọ̀ a rí ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `Ìbáwọlé aṣìṣe: a ní láti fi ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `Àṣàyàn aṣìṣe: yan ọ̀kan lára ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Tó pọ̀ jù: a ní láti jẹ́ pé ${issue.origin ?? "iye"} ${sizing.verb} ${adj}${issue.maximum} ${sizing.unit}`;
                return `Tó pọ̀ jù: a ní láti jẹ́ ${adj}${issue.maximum}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `Kéré ju: a ní láti jẹ́ pé ${issue.origin} ${sizing.verb} ${adj}${issue.minimum} ${sizing.unit}`;
                return `Kéré ju: a ní láti jẹ́ ${adj}${issue.minimum}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `Ọ̀rọ̀ aṣìṣe: gbọ́dọ̀ bẹ̀rẹ̀ pẹ̀lú "${_issue.prefix}"`;
                if (_issue.format === "ends_with")
                    return `Ọ̀rọ̀ aṣìṣe: gbọ́dọ̀ parí pẹ̀lú "${_issue.suffix}"`;
                if (_issue.format === "includes")
                    return `Ọ̀rọ̀ aṣìṣe: gbọ́dọ̀ ní "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `Ọ̀rọ̀ aṣìṣe: gbọ́dọ̀ bá àpẹẹrẹ mu ${_issue.pattern}`;
                return `Aṣìṣe: ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `Nọ́mbà aṣìṣe: gbọ́dọ̀ jẹ́ èyà pípín ti ${issue.divisor}`;
            case "unrecognized_keys":
                return `Bọtìnì àìmọ̀: ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `Bọtìnì aṣìṣe nínú ${issue.origin}`;
            case "invalid_union":
                return "Ìbáwọlé aṣìṣe";
            case "invalid_element":
                return `Iye aṣìṣe nínú ${issue.origin}`;
            default:
                return "Ìbáwọlé aṣìṣe";
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/zh-CN.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "字符", verb: "包含" },
        file: { unit: "字节", verb: "包含" },
        array: { unit: "项", verb: "包含" },
        set: { unit: "项", verb: "包含" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "输入",
        email: "电子邮件",
        url: "URL",
        emoji: "表情符号",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO日期时间",
        date: "ISO日期",
        time: "ISO时间",
        duration: "ISO时长",
        ipv4: "IPv4地址",
        ipv6: "IPv6地址",
        cidrv4: "IPv4网段",
        cidrv6: "IPv6网段",
        base64: "base64编码字符串",
        base64url: "base64url编码字符串",
        json_string: "JSON字符串",
        e164: "E.164号码",
        jwt: "JWT",
        template_literal: "输入",
    };
    const TypeDictionary = {
        nan: "NaN",
        number: "数字",
        array: "数组",
        null: "空值(null)",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `无效输入：期望 instanceof ${issue.expected}，实际接收 ${received}`;
                }
                return `无效输入：期望 ${expected}，实际接收 ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `无效输入：期望 ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `无效选项：期望以下之一 ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `数值过大：期望 ${issue.origin ?? "值"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "个元素"}`;
                return `数值过大：期望 ${issue.origin ?? "值"} ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `数值过小：期望 ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `数值过小：期望 ${issue.origin} ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with")
                    return `无效字符串：必须以 "${_issue.prefix}" 开头`;
                if (_issue.format === "ends_with")
                    return `无效字符串：必须以 "${_issue.suffix}" 结尾`;
                if (_issue.format === "includes")
                    return `无效字符串：必须包含 "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `无效字符串：必须满足正则表达式 ${_issue.pattern}`;
                return `无效${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `无效数字：必须是 ${issue.divisor} 的倍数`;
            case "unrecognized_keys":
                return `出现未知的键(key): ${_core_util_js__rspack_import_0.joinValues(issue.keys, ", ")}`;
            case "invalid_key":
                return `${issue.origin} 中的键(key)无效`;
            case "invalid_union":
                return "无效输入";
            case "invalid_element":
                return `${issue.origin} 中包含无效值(value)`;
            default:
                return `无效输入`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},
"./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/locales/zh-TW.js"(__unused_rspack___webpack_module__, __webpack_exports__, __webpack_require__) {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* export default binding */ __rspack_default_export)
});
/* import */ var _core_util_js__rspack_import_0 = __webpack_require__("./node_modules/.pnpm/zod@4.3.5/node_modules/zod/v4/core/util.js");

const error = () => {
    const Sizable = {
        string: { unit: "字元", verb: "擁有" },
        file: { unit: "位元組", verb: "擁有" },
        array: { unit: "項目", verb: "擁有" },
        set: { unit: "項目", verb: "擁有" },
    };
    function getSizing(origin) {
        return Sizable[origin] ?? null;
    }
    const FormatDictionary = {
        regex: "輸入",
        email: "郵件地址",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO 日期時間",
        date: "ISO 日期",
        time: "ISO 時間",
        duration: "ISO 期間",
        ipv4: "IPv4 位址",
        ipv6: "IPv6 位址",
        cidrv4: "IPv4 範圍",
        cidrv6: "IPv6 範圍",
        base64: "base64 編碼字串",
        base64url: "base64url 編碼字串",
        json_string: "JSON 字串",
        e164: "E.164 數值",
        jwt: "JWT",
        template_literal: "輸入",
    };
    const TypeDictionary = {
        nan: "NaN",
    };
    return (issue) => {
        switch (issue.code) {
            case "invalid_type": {
                const expected = TypeDictionary[issue.expected] ?? issue.expected;
                const receivedType = _core_util_js__rspack_import_0.parsedType(issue.input);
                const received = TypeDictionary[receivedType] ?? receivedType;
                if (/^[A-Z]/.test(issue.expected)) {
                    return `無效的輸入值：預期為 instanceof ${issue.expected}，但收到 ${received}`;
                }
                return `無效的輸入值：預期為 ${expected}，但收到 ${received}`;
            }
            case "invalid_value":
                if (issue.values.length === 1)
                    return `無效的輸入值：預期為 ${_core_util_js__rspack_import_0.stringifyPrimitive(issue.values[0])}`;
                return `無效的選項：預期為以下其中之一 ${_core_util_js__rspack_import_0.joinValues(issue.values, "|")}`;
            case "too_big": {
                const adj = issue.inclusive ? "<=" : "<";
                const sizing = getSizing(issue.origin);
                if (sizing)
                    return `數值過大：預期 ${issue.origin ?? "值"} 應為 ${adj}${issue.maximum.toString()} ${sizing.unit ?? "個元素"}`;
                return `數值過大：預期 ${issue.origin ?? "值"} 應為 ${adj}${issue.maximum.toString()}`;
            }
            case "too_small": {
                const adj = issue.inclusive ? ">=" : ">";
                const sizing = getSizing(issue.origin);
                if (sizing) {
                    return `數值過小：預期 ${issue.origin} 應為 ${adj}${issue.minimum.toString()} ${sizing.unit}`;
                }
                return `數值過小：預期 ${issue.origin} 應為 ${adj}${issue.minimum.toString()}`;
            }
            case "invalid_format": {
                const _issue = issue;
                if (_issue.format === "starts_with") {
                    return `無效的字串：必須以 "${_issue.prefix}" 開頭`;
                }
                if (_issue.format === "ends_with")
                    return `無效的字串：必須以 "${_issue.suffix}" 結尾`;
                if (_issue.format === "includes")
                    return `無效的字串：必須包含 "${_issue.includes}"`;
                if (_issue.format === "regex")
                    return `無效的字串：必須符合格式 ${_issue.pattern}`;
                return `無效的 ${FormatDictionary[_issue.format] ?? issue.format}`;
            }
            case "not_multiple_of":
                return `無效的數字：必須為 ${issue.divisor} 的倍數`;
            case "unrecognized_keys":
                return `無法識別的鍵值${issue.keys.length > 1 ? "們" : ""}：${_core_util_js__rspack_import_0.joinValues(issue.keys, "、")}`;
            case "invalid_key":
                return `${issue.origin} 中有無效的鍵值`;
            case "invalid_union":
                return "無效的輸入值";
            case "invalid_element":
                return `${issue.origin} 中有無效的值`;
            default:
                return `無效的輸入值`;
        }
    };
};
/* export default */ function __rspack_default_export() {
    return {
        localeError: error(),
    };
}


},

});
// The module cache
var __webpack_module_cache__ = {};

// The require function
function __webpack_require__(moduleId) {

// Check if module is in cache
var cachedModule = __webpack_module_cache__[moduleId];
if (cachedModule !== undefined) {
return cachedModule.exports;
}
// Create a new module (and put it into the cache)
var module = (__webpack_module_cache__[moduleId] = {
exports: {}
});
// Execute the module function
__webpack_modules__[moduleId](module, module.exports, __webpack_require__);

// Return the exports of the module
return module.exports;

}

// webpack/runtime/compat_get_default_export
(() => {
// getDefaultExport function for compatibility with non-ESM modules
__webpack_require__.n = (module) => {
	var getter = module && module.__esModule ?
		() => (module['default']) :
		() => (module);
	__webpack_require__.d(getter, { a: getter });
	return getter;
};

})();
// webpack/runtime/define_property_getters
(() => {
__webpack_require__.d = (exports, definition) => {
	for(var key in definition) {
        if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
            Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
        }
    }
};
})();
// webpack/runtime/has_own_property
(() => {
__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
})();
// webpack/runtime/make_namespace_object
(() => {
// define __esModule on exports
__webpack_require__.r = (exports) => {
	if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
	}
	Object.defineProperty(exports, '__esModule', { value: true });
};
})();
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  isDev: () => (isDev),
  mainWindow: () => (mainWindow)
});
/* import */ var node_path__rspack_import_0 = __webpack_require__("node:path");
/* import */ var node_path__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(node_path__rspack_import_0);
/* import */ var electron__rspack_import_1 = __webpack_require__("electron");
/* import */ var electron__rspack_import_1_default = /*#__PURE__*/__webpack_require__.n(electron__rspack_import_1);
/* import */ var _acp_Client__rspack_import_2 = __webpack_require__("./src/main/acp/Client.ts");
/* import */ var node_child_process__rspack_import_3 = __webpack_require__("node:child_process");
/* import */ var node_child_process__rspack_import_3_default = /*#__PURE__*/__webpack_require__.n(node_child_process__rspack_import_3);
/* import */ var node_util__rspack_import_4 = __webpack_require__("node:util");
/* import */ var node_util__rspack_import_4_default = /*#__PURE__*/__webpack_require__.n(node_util__rspack_import_4);
/* import */ var node_fs_promises__rspack_import_5 = __webpack_require__("node:fs/promises");
/* import */ var node_fs_promises__rspack_import_5_default = /*#__PURE__*/__webpack_require__.n(node_fs_promises__rspack_import_5);
/* import */ var node_fs__rspack_import_6 = __webpack_require__("node:fs");
/* import */ var node_fs__rspack_import_6_default = /*#__PURE__*/__webpack_require__.n(node_fs__rspack_import_6);
/* import */ var _db_store__rspack_import_7 = __webpack_require__("./src/main/db/store.ts");








const execAsync = (0,node_util__rspack_import_4.promisify)(node_child_process__rspack_import_3.exec);
let mainWindow = null;
let acpClient = null;
let activeConnectionKey = null;
const isDev = !electron__rspack_import_1.app.isPackaged;
const loadUrl = isDev ? `http://localhost:${"8088"}` : `file://${node_path__rspack_import_0_default().resolve(__dirname, "../render/index.html")}`;
const getAgentsDir = ()=>node_path__rspack_import_0_default().join(electron__rspack_import_1.app.getPath("userData"), "agents");
const getLocalAgentBin = (command)=>{
    const agentsDir = getAgentsDir();
    const binPath = node_path__rspack_import_0_default().join(agentsDir, "node_modules", ".bin", command);
    return (0,node_fs__rspack_import_6.existsSync)(binPath) ? binPath : null;
};
const getPackageJsonPath = (packageName)=>{
    const parts = packageName.split("/").filter(Boolean);
    return node_path__rspack_import_0_default().join(getAgentsDir(), "node_modules", ...parts, "package.json");
};
const readInstalledPackageVersion = async (packageName)=>{
    try {
        const pkgJsonPath = getPackageJsonPath(packageName);
        const data = await node_fs_promises__rspack_import_5_default().readFile(pkgJsonPath, "utf-8");
        const parsed = JSON.parse(data);
        return typeof parsed.version === "string" ? parsed.version : null;
    } catch  {
        return null;
    }
};
const extractPackageName = (specifier)=>{
    const trimmed = specifier.trim();
    if (!trimmed) return trimmed;
    if (trimmed.startsWith("@")) {
        const secondAt = trimmed.indexOf("@", 1);
        return secondAt === -1 ? trimmed : trimmed.slice(0, secondAt);
    }
    const lastAt = trimmed.lastIndexOf("@");
    return lastAt > 0 ? trimmed.slice(0, lastAt) : trimmed;
};
const toLatestSpecifier = (specifier)=>{
    const pkgName = extractPackageName(specifier);
    return pkgName ? `${pkgName}@latest` : specifier;
};
const initIpc = ()=>{
    electron__rspack_import_1.ipcMain.on("ping", ()=>{
        electron__rspack_import_1.dialog.showMessageBox(mainWindow, {
            message: "hello"
        });
    });
    electron__rspack_import_1.ipcMain.handle("dialog:openFolder", async ()=>{
        const { canceled, filePaths } = await electron__rspack_import_1.dialog.showOpenDialog(mainWindow, {
            properties: [
                "openDirectory"
            ]
        });
        if (canceled || filePaths.length === 0) {
            return null;
        }
        return filePaths[0];
    });
    // DB IPC Handlers
    electron__rspack_import_1.ipcMain.handle("db:get-last-workspace", ()=>{
        return (0,_db_store__rspack_import_7.getSetting)("last_workspace");
    });
    electron__rspack_import_1.ipcMain.handle("db:set-last-workspace", (_, workspace)=>{
        (0,_db_store__rspack_import_7.setSetting)("last_workspace", workspace);
    });
    electron__rspack_import_1.ipcMain.handle("db:get-active-task", ()=>{
        return (0,_db_store__rspack_import_7.getSetting)("active_task_id");
    });
    electron__rspack_import_1.ipcMain.handle("db:set-active-task", (_, taskId)=>{
        if (taskId) {
            (0,_db_store__rspack_import_7.setSetting)("active_task_id", taskId);
        } else {
            (0,_db_store__rspack_import_7.setSetting)("active_task_id", "");
        }
    });
    electron__rspack_import_1.ipcMain.handle("db:list-tasks", ()=>{
        return (0,_db_store__rspack_import_7.listTasks)();
    });
    electron__rspack_import_1.ipcMain.handle("db:get-task", (_, taskId)=>{
        return (0,_db_store__rspack_import_7.getTask)(taskId);
    });
    electron__rspack_import_1.ipcMain.handle("db:create-task", (_, task)=>{
        (0,_db_store__rspack_import_7.createTask)(task);
        return {
            success: true
        };
    });
    electron__rspack_import_1.ipcMain.handle("db:update-task", (_, taskId, updates)=>{
        (0,_db_store__rspack_import_7.updateTask)(taskId, updates);
        return {
            success: true
        };
    });
    electron__rspack_import_1.ipcMain.handle("db:delete-task", (_, taskId)=>{
        (0,_db_store__rspack_import_7.deleteTask)(taskId);
        return {
            success: true
        };
    });
    // ACP IPC Handlers
    electron__rspack_import_1.ipcMain.handle("agent:connect", async (_, command, cwd, env, options)=>{
        if (!acpClient) {
            acpClient = new _acp_Client__rspack_import_2.ACPClient((msg)=>{
                // Forward agent messages to renderer
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("agent:message", msg);
                }
            });
        }
        // Command splitting (naive)
        const parts = command.split(" ");
        let cmd = parts[0];
        const args = parts.slice(1);
        // Check if it's a local agent
        const localBin = getLocalAgentBin(cmd);
        if (localBin) {
            console.log(`[Main] Using local agent binary: ${localBin}`);
            // Ensure execution permission for local binary
            try {
                await node_fs_promises__rspack_import_5_default().chmod(localBin, 493);
            } catch (e) {
                console.error(`[Main] Failed to chmod local bin: ${e}`);
            }
            // Special handling for node scripts (like qwen which is a symlink to cli.js)
            // If we just execute the JS file directly, it might fail if shebang is not respected or env is weird
            // So we prefix with 'node' if it looks like a JS file or we know it's a node script
            if (localBin.endsWith(".js") || cmd === "qwen") {
                // Quote the path because Client.ts uses { shell: true } which requires manual quoting for paths with spaces
                args.unshift(`"${localBin}"`);
                // Try to resolve absolute path to node
                try {
                    const { stdout } = await execAsync("which node");
                    cmd = stdout.trim();
                    console.log(`[Main] Resolved system node path: ${cmd}`);
                } catch (e) {
                    // Fallback to bundled node if system node not found
                    const bundledNode = node_path__rspack_import_0_default().resolve(__dirname, "../../resources/node_bin/node");
                    if ((0,node_fs__rspack_import_6.existsSync)(bundledNode)) {
                        cmd = bundledNode;
                        console.log(`[Main] Using bundled node path: ${cmd}`);
                    } else {
                        console.warn("[Main] Failed to resolve node path and no bundled node found, falling back to 'node'");
                        cmd = "node";
                    }
                }
            } else {
                cmd = localBin;
            }
        }
        const connectionKey = JSON.stringify({
            cmd,
            args,
            cwd: cwd || process.cwd(),
            env: env || null
        });
        try {
            if ((options === null || options === void 0 ? void 0 : options.reuseIfSame) && acpClient.isConnected() && activeConnectionKey === connectionKey) {
                return {
                    success: true,
                    reused: true,
                    sessionId: null
                };
            }
            const result = await acpClient.connect(cmd, args, cwd, env, {
                createSession: (options === null || options === void 0 ? void 0 : options.createSession) ?? true
            });
            activeConnectionKey = connectionKey;
            return {
                success: true,
                reused: false,
                sessionId: (result === null || result === void 0 ? void 0 : result.sessionId) ?? null
            };
        } catch (e) {
            console.error("Connect error:", e);
            return {
                success: false,
                error: e.message
            };
        }
    });
    electron__rspack_import_1.ipcMain.handle("agent:check-command", async (_, command)=>{
        // 1. Check local agent
        if (getLocalAgentBin(command)) {
            return {
                installed: true,
                source: "local"
            };
        }
        // 2. Check system
        try {
            await execAsync(`which ${command}`);
            return {
                installed: true,
                source: "system"
            };
        } catch  {
            // 3. Special check for Node environment availability
            if (command === "node") {
                // Check bundled node
                const bundledNode = node_path__rspack_import_0_default().resolve(__dirname, "../../resources/node_bin/node");
                if ((0,node_fs__rspack_import_6.existsSync)(bundledNode)) {
                    return {
                        installed: true,
                        source: "bundled"
                    };
                }
            }
            return {
                installed: false
            };
        }
    });
    electron__rspack_import_1.ipcMain.handle("agent:get-package-version", async (_, packageName)=>{
        const pkgName = extractPackageName(packageName);
        if (!pkgName) {
            return {
                success: false,
                error: "Invalid package name"
            };
        }
        try {
            const version = await readInstalledPackageVersion(pkgName);
            if (version) {
                return {
                    success: true,
                    version
                };
            }
            return {
                success: false,
                error: "Package not installed"
            };
        } catch (e) {
            return {
                success: false,
                error: e.message
            };
        }
    });
    electron__rspack_import_1.ipcMain.handle("agent:install", async (_, packageName)=>{
        const agentsDir = getAgentsDir();
        try {
            // Ensure dir exists
            if (!(0,node_fs__rspack_import_6.existsSync)(agentsDir)) {
                await node_fs_promises__rspack_import_5_default().mkdir(agentsDir, {
                    recursive: true
                });
                // Init package.json if needed
                await node_fs_promises__rspack_import_5_default().writeFile(node_path__rspack_import_0_default().join(agentsDir, "package.json"), "{}", "utf-8");
            }
            const pkgName = extractPackageName(packageName);
            const latestSpecifier = toLatestSpecifier(packageName);
            // Remove previously installed version so npm cannot reuse the old lock entry
            if (pkgName) {
                try {
                    await execAsync(`npm uninstall ${pkgName}`, {
                        cwd: agentsDir
                    });
                } catch (uninstallErr) {
                    console.warn(`[Main] npm uninstall ${pkgName} failed (likely not installed): ${uninstallErr}`);
                }
            }
            // Install
            console.log(`[Main] Installing ${latestSpecifier} to ${agentsDir}...`);
            // We rely on system npm for now, but in future could use bundled npm
            // Quote paths to handle spaces
            await execAsync(`npm install ${latestSpecifier} --force --prefer-online --registry https://registry.npmmirror.com`, {
                cwd: agentsDir
            });
            return {
                success: true
            };
        } catch (e) {
            console.error("Install error:", e);
            return {
                success: false,
                error: e.message
            };
        }
    });
    electron__rspack_import_1.ipcMain.handle("agent:uninstall", async (_, packageName)=>{
        const pkgName = extractPackageName(packageName);
        if (!pkgName) {
            return {
                success: false,
                error: "Invalid package name"
            };
        }
        const agentsDir = getAgentsDir();
        if (!(0,node_fs__rspack_import_6.existsSync)(agentsDir)) {
            return {
                success: true
            };
        }
        const existingVersion = await readInstalledPackageVersion(pkgName);
        if (!existingVersion) {
            return {
                success: true
            };
        }
        try {
            console.log(`[Main] Uninstalling ${pkgName} from ${agentsDir}...`);
            await execAsync(`npm uninstall ${pkgName}`, {
                cwd: agentsDir
            });
            return {
                success: true
            };
        } catch (e) {
            console.error("Uninstall error:", e);
            return {
                success: false,
                error: e.message
            };
        }
    });
    electron__rspack_import_1.ipcMain.handle("agent:auth-terminal", async (_, command, cwd)=>{
        // Resolve full path if it's a local agent command (e.g. "qwen")
        let targetCmd = command;
        let localBin = getLocalAgentBin(command);
        if (localBin) {
            // If it's a JS/Node script, prefix with node
            if (localBin.endsWith(".js") || command === "qwen") {
                let nodePath = "node";
                // Try to find absolute node path
                try {
                    const { stdout } = await execAsync("which node");
                    nodePath = stdout.trim();
                } catch  {
                    const bundledNode = node_path__rspack_import_0_default().resolve(__dirname, "../../resources/node_bin/node");
                    if ((0,node_fs__rspack_import_6.existsSync)(bundledNode)) {
                        nodePath = bundledNode;
                    }
                }
                targetCmd = `"${nodePath}" "${localBin}"`;
            } else {
                targetCmd = `"${localBin}"`;
            }
        }
        console.log(`[Main] Launching auth terminal for: ${targetCmd} in ${cwd || "default cwd"}`);
        try {
            if (process.platform === "darwin") {
                // macOS: Open Terminal
                // If cwd is provided, cd to it first
                const cdPrefix = cwd ? `cd ${JSON.stringify(cwd)} && ` : "";
                const script = `${cdPrefix}${targetCmd}`.trim();
                const escapedScript = script.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
                await execAsync(`osascript -e 'tell application "Terminal" to do script "${escapedScript}"'`);
                await execAsync(`osascript -e 'tell application "Terminal" to activate'`);
            } else if (process.platform === "win32") {
                // Windows: Start cmd
                const options = cwd ? {
                    cwd
                } : {};
                await execAsync(`start cmd /k "${targetCmd}"`, options);
            } else {
                // Linux: Try x-terminal-emulator or gnome-terminal
                const cdCmd = cwd ? `cd "${cwd}" && ` : "";
                await execAsync(`x-terminal-emulator -e "bash -c '${cdCmd}${targetCmd}; exec bash'" || gnome-terminal -- bash -c "${cdCmd}${targetCmd}; exec bash"`);
            }
            return {
                success: true
            };
        } catch (e) {
            console.error("Auth terminal error:", e);
            return {
                success: false,
                error: e.message
            };
        }
    });
    electron__rspack_import_1.ipcMain.handle("agent:permission-response", (_, id, response)=>{
        if (acpClient) {
            acpClient.resolvePermission(id, response);
        }
    });
    electron__rspack_import_1.ipcMain.handle("agent:send", async (_, message)=>{
        if (acpClient) {
            await acpClient.sendMessage(message);
        } else {
            throw new Error("Agent not connected");
        }
    });
    electron__rspack_import_1.ipcMain.handle("agent:get-capabilities", async ()=>{
        if (!acpClient) {
            return null;
        }
        return acpClient.getCapabilities();
    });
    electron__rspack_import_1.ipcMain.handle("agent:new-session", async (_, cwd)=>{
        if (!acpClient) {
            throw new Error("Agent not connected");
        }
        const sessionId = await acpClient.createSession(cwd);
        return {
            success: true,
            sessionId
        };
    });
    electron__rspack_import_1.ipcMain.handle("agent:load-session", async (_, sessionId, cwd)=>{
        if (!acpClient) {
            throw new Error("Agent not connected");
        }
        await acpClient.loadSession(sessionId, cwd);
        return {
            success: true
        };
    });
    electron__rspack_import_1.ipcMain.handle("agent:resume-session", async (_, sessionId, cwd)=>{
        if (!acpClient) {
            throw new Error("Agent not connected");
        }
        await acpClient.resumeSession(sessionId, cwd);
        return {
            success: true
        };
    });
    electron__rspack_import_1.ipcMain.handle("agent:set-active-session", async (_, sessionId)=>{
        if (!acpClient) {
            throw new Error("Agent not connected");
        }
        acpClient.setActiveSession(sessionId);
        return {
            success: true
        };
    });
    electron__rspack_import_1.ipcMain.handle("agent:set-model", async (_, modelId)=>{
        try {
            if (!acpClient) {
                throw new Error("Agent not connected");
            }
            return await acpClient.setModel(modelId);
        } catch (e) {
            console.error("Set model error:", e);
            return {
                success: false,
                error: e.message
            };
        }
    });
    electron__rspack_import_1.ipcMain.handle("agent:disconnect", async ()=>{
        if (acpClient) {
            await acpClient.disconnect();
            acpClient = null;
            activeConnectionKey = null;
        }
        return {
            success: true
        };
    });
};
const onCreateMainWindow = ()=>{
    mainWindow = new electron__rspack_import_1.BrowserWindow({
        width: 1200,
        minWidth: 1000,
        height: 900,
        minHeight: 700,
        icon: (0,node_path__rspack_import_0.resolve)(__dirname, "../../../../assets/icons/256x256.png"),
        webPreferences: {
            devTools: isDev,
            nodeIntegration: false,
            contextIsolation: true,
            preload: node_path__rspack_import_0_default().resolve(__dirname, "./preload.js")
        }
    });
    mainWindow.loadURL(loadUrl);
};
electron__rspack_import_1.app.on("ready", async ()=>{
    (0,_db_store__rspack_import_7.initDB)();
    initIpc();
    onCreateMainWindow();
});
electron__rspack_import_1.app.on("window-all-closed", ()=>{
    if (process.platform !== "darwin") {
        electron__rspack_import_1.app.quit();
    }
});
electron__rspack_import_1.app.on("activate", ()=>{
    if (electron__rspack_import_1.BrowserWindow.getAllWindows().length === 0) {
        onCreateMainWindow();
    }
});

})();

module.exports = __webpack_exports__;
})()
;
//# sourceMappingURL=index.js.map