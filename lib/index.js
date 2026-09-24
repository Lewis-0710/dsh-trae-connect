import { A as FALLBACK_TRAE_MODELS_AI, C as TraeCredentialStore, D as traeStateDir, E as traePluginDataDir, F as traeInputModalities, M as fallbackModelsFor, N as formatTraeModelDisplayName, O as traeStorageCandidates, P as mergeTraeModelSources, S as TRAE_CONNECT_VERSION, T as parseTraeDocument, _ as clearHostHeartbeat, a as variantForRegion, b as traeHostHeartbeatPath, c as TRAE_AI_STATUS_PATH, d as TRAE_STATUS_PATH, f as TraeUpstreamClient, g as signDeviceProof, h as buildTraeDeviceInfo, i as variantFor, j as TraeCatalog, k as FALLBACK_TRAE_MODELS, l as TRAE_LOGIN_PATH, m as TraeLoginClient, n as CN_VARIANT, o as TRAE_AI_LOGIN_PATH, p as classifyUpstreamError, r as TRAE_VARIANTS, s as TRAE_AI_PROBE_PATH, t as AI_VARIANT, u as TRAE_PROBE_PATH, v as isHeartbeatProcessAlive, w as parseTraeAuth, x as writeHostHeartbeat, y as readHostHeartbeat } from "./variants-CUeM88dq.js";
import z from "@deepseek-ai/schemastery";
import { createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { dirname, join } from "node:path";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { Readable } from "node:stream";
//#region src/adapter.ts
/**
* Trae pi-ai provider adapter for DeepSeek Harness.
*
* @module dsh-trae-connect/adapter
*/
const TRAE_PROVIDER = "trae";
const TRAE_AI_PROVIDER = "trae-global";
const TRAE_STREAM_IDLE_TIMEOUT_MS = 3e5;
const INERT_AUTH = {
	credentials: {
		async read() {},
		async list() {
			return [];
		},
		async modify() {
			throw new Error("dsh-trae-connect has no pi-ai credential lifecycle");
		},
		async delete() {}
	},
	authContext: {
		async env() {},
		async fileExists() {
			return false;
		}
	}
};
const REQUEST_IMAGE_BUDGETS = {
	maxRequestImageBytes: 20971520,
	requestImagePixelBudget: 4194304,
	requestImageMaxBytes: 1048576
};
function toPiModel(info, baseUrl, providerId, useMax = false) {
	const displayName = formatTraeModelDisplayName(info);
	const ctxWindow = (useMax ? info.maxContextWindow ?? info.contextWindow : info.contextWindow) ?? info.maxContextWindow;
	return {
		id: info.id,
		name: displayName,
		api: "openai-completions",
		provider: providerId,
		baseUrl,
		input: traeInputModalities(info),
		cost: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0
		},
		reasoning: info.reasoningEfforts !== void 0,
		...info.reasoningEfforts === void 0 ? {} : { thinkingLevelMap: {
			off: null,
			minimal: null,
			low: info.reasoningEfforts.low ?? null,
			medium: null,
			high: info.reasoningEfforts.high ?? null,
			xhigh: info.reasoningEfforts.xhigh ?? null,
			max: null
		} },
		...ctxWindow === void 0 ? {} : { contextWindow: ctxWindow },
		...info.maxTokens === void 0 ? {} : { maxTokens: info.maxTokens },
		compat: { supportsReasoningEffort: info.reasoningEfforts !== void 0 }
	};
}
var TraePiAiAdapter = class extends PiAiAdapter {
	catalog;
	constructor(catalog, options) {
		super(options);
		this.catalog = catalog;
	}
	infoFor(model) {
		return this.catalog.current().find((entry) => entry.id === model);
	}
	async listModels(provider) {
		return (await super.listModels(provider)).map((model) => {
			const info = this.infoFor(model.id);
			if (info === void 0) return model;
			return {
				...model,
				name: formatTraeModelDisplayName(info)
			};
		});
	}
	async resolveModel(provider, model, signal) {
		const resolved = await super.resolveModel(provider, model, signal);
		const info = this.infoFor(model);
		if (info === void 0) return resolved;
		return {
			...resolved,
			name: formatTraeModelDisplayName(info)
		};
	}
};
function createTraeAdapter(options) {
	const providerId = options.variant.id;
	const providerName = options.variant.displayName;
	const buildModels = () => {
		let baseUrl = "http://127.0.0.1:0/v1";
		try {
			baseUrl = `${options.shim.baseUrl()}/v1`;
		} catch {}
		const useMax = options.useMaximumContextWindow?.() ?? false;
		return options.catalog.current().map((info) => toPiModel(info, baseUrl, providerId, useMax));
	};
	const provider = {
		...createProvider({
			id: providerId,
			name: providerName,
			auth: { apiKey: {
				name: "Trae loopback secret",
				async resolve({ credential }) {
					return {
						auth: { apiKey: credential?.key ?? options.shim.token() },
						source: "Trae loopback"
					};
				}
			} },
			models: buildModels(),
			api: openAICompletionsApi()
		}),
		getModels: () => buildModels()
	};
	const profile = {
		provider: providerId,
		displayName: providerName,
		streamIdleTimeoutMs: TRAE_STREAM_IDLE_TIMEOUT_MS,
		retryPolicy: resolveRetryPolicy(void 0, "dsh-trae-connect retryPolicy"),
		configuredMaxTokens: /* @__PURE__ */ new Map(),
		modelErrors: /* @__PURE__ */ new Map(),
		...REQUEST_IMAGE_BUDGETS,
		piProvider: provider
	};
	let profiles = /* @__PURE__ */ new Map([[providerId, profile]]);
	return {
		adapter: new TraePiAiAdapter(options.catalog, {
			profiles: () => profiles,
			auth: INERT_AUTH,
			resolveApiKey: async () => options.shim.token(),
			...options.resolveAttachments === void 0 ? {} : { resolveAttachments: options.resolveAttachments }
		}),
		invalidate() {
			profiles = /* @__PURE__ */ new Map([[providerId, profile]]);
		}
	};
}
//#endregion
//#region src/catalog-store.ts
/**
* Persistent store for the last successful model catalog per account and variant.
*
* @module dsh-trae-connect/catalog-store
*/
const CATALOG_FORMAT_VERSION = 1;
const TRAE_CATALOG_FILENAME = ".trae-catalog.json";
function traeCatalogPath(filename = TRAE_CATALOG_FILENAME) {
	return join(traeStateDir(), filename);
}
function isModel(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const row = value;
	return typeof row["id"] === "string" && row["id"] !== "" && typeof row["name"] === "string";
}
function isSaved(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const entry = value;
	if (typeof entry["account"] !== "string" || entry["account"] === "") return false;
	if (typeof entry["source"] !== "string" || entry["source"] === "") return false;
	if (typeof entry["fetchedAtMs"] !== "number" || !Number.isFinite(entry["fetchedAtMs"])) return false;
	const models = entry["models"];
	if (!Array.isArray(models) || models.length === 0) return false;
	return models.every(isModel);
}
var TraeCatalogStore = class {
	path;
	entries;
	constructor(options = {}) {
		if (typeof options === "string") this.path = options;
		else if (options.path !== void 0) this.path = options.path;
		else {
			const filename = options.variant?.catalogFilename ?? ".trae-catalog.json";
			this.path = traeCatalogPath(filename);
		}
	}
	load() {
		if (this.entries !== void 0) return this.entries;
		if (!existsSync(this.path)) {
			this.entries = {};
			return this.entries;
		}
		try {
			const raw = JSON.parse(readFileSync(this.path, "utf8"));
			if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
				this.entries = {};
				return this.entries;
			}
			const doc = raw;
			if (doc["version"] !== CATALOG_FORMAT_VERSION || typeof doc["entries"] !== "object" || doc["entries"] === null) {
				this.entries = {};
				return this.entries;
			}
			const parsed = {};
			for (const [key, value] of Object.entries(doc["entries"])) if (isSaved(value)) parsed[key] = value;
			this.entries = parsed;
			return this.entries;
		} catch {
			this.entries = {};
			return this.entries;
		}
	}
	get(account) {
		const entry = this.load()[account];
		if (entry === void 0) return void 0;
		return {
			models: entry.models,
			fetchedAtMs: entry.fetchedAtMs
		};
	}
	put(account, source, models) {
		if (account.trim() === "" || models.length === 0) return;
		const current = this.load();
		current[account] = {
			account,
			source,
			fetchedAtMs: Date.now(),
			models
		};
		this.flush();
	}
	flush() {
		const dir = dirname(this.path);
		if (!existsSync(dir)) try {
			mkdirSync(dir, { recursive: true });
		} catch {}
		const doc = {
			version: CATALOG_FORMAT_VERSION,
			entries: this.entries ?? {}
		};
		const tempPath = `${this.path}.${process.pid}.${Date.now()}.tmp`;
		try {
			writeFileSync(tempPath, JSON.stringify(doc, null, 2), "utf8");
			renameSync(tempPath, this.path);
		} catch {}
	}
};
//#endregion
//#region src/checkin-scheduler.ts
/**
* 每日签到定时器与历史日志管理服务。
*
* @module dsh-trae-connect/checkin-scheduler
*/
function getUtc8DateString(now = /* @__PURE__ */ new Date()) {
	return new Date(now.getTime() + 288e5).toISOString().slice(0, 10);
}
var JsonFileCheckInStore = class {
	filePath;
	constructor(filePath) {
		this.filePath = filePath ?? join(traeStateDir(), "checkin-status.json");
	}
	readAll() {
		try {
			if (!existsSync(this.filePath)) return {};
			const raw = readFileSync(this.filePath, "utf-8");
			return JSON.parse(raw);
		} catch {
			return {};
		}
	}
	read(variantId) {
		return this.readAll()[variantId];
	}
	write(variantId, record) {
		try {
			const all = this.readAll();
			const existingLogs = all[variantId]?.logs ?? [];
			const newLog = {
				id: `${record.lastDate}-${record.lastAt}`,
				date: record.lastDate,
				timestamp: record.lastAt,
				status: record.status,
				...record.amount === void 0 ? {} : { amount: record.amount },
				...record.message === void 0 ? {} : { message: record.message }
			};
			const updatedLogs = [newLog, ...existingLogs.filter((l) => l.id !== newLog.id)].slice(0, 30);
			all[variantId] = {
				...record,
				logs: updatedLogs
			};
			mkdirSync(dirname(this.filePath), { recursive: true });
			writeFileSync(this.filePath, JSON.stringify(all, null, 2), "utf-8");
		} catch {}
	}
	clear(variantId) {
		try {
			const all = this.readAll();
			const today = getUtc8DateString();
			all[variantId] = {
				lastDate: all[variantId]?.lastDate ?? today,
				lastAt: Date.now(),
				status: all[variantId]?.status ?? "no-campaign",
				...all[variantId]?.amount !== void 0 ? { amount: all[variantId].amount } : {},
				logs: []
			};
			mkdirSync(dirname(this.filePath), { recursive: true });
			writeFileSync(this.filePath, JSON.stringify(all, null, 2), "utf-8");
		} catch {}
	}
};
var CheckInScheduler = class {
	timer;
	store;
	clients;
	constructor(clients, store) {
		this.clients = clients;
		this.store = store ?? new JsonFileCheckInStore();
	}
	start() {
		this.stop();
		setTimeout(() => {
			this.runAll();
		}, 1e3);
		this.timer = setInterval(() => {
			this.runAll();
		}, 72e5);
	}
	stop() {
		if (this.timer !== void 0) {
			clearInterval(this.timer);
			this.timer = void 0;
		}
	}
	get(variantId) {
		return this.store.read(variantId);
	}
	clearLogs(variantId) {
		this.store.clear(variantId);
	}
	/**
	* 主动同步指定版本的最新服务端签到状态并纠偏本地记录。
	*/
	async syncVariant(variantId) {
		const target = this.clients.find((c) => c.variantId === variantId);
		if (!target || target.client.variant.region !== "cn") return void 0;
		const today = getUtc8DateString();
		try {
			const checkin = await target.client.usageClient.checkinStatus();
			if (checkin.checkedIn) {
				const record = {
					lastDate: today,
					lastAt: Date.now(),
					status: "already-claimed",
					amount: checkin.credits
				};
				this.store.write(variantId, record);
				return record;
			}
		} catch {}
		return this.store.read(variantId);
	}
	async checkIn(variantId) {
		const target = this.clients.find((c) => c.variantId === variantId);
		if (!target) return {
			state: "error",
			reason: "未知版本"
		};
		if (target.client.variant.region !== "cn") return {
			state: "no-campaign",
			reason: "国际版（Trae Global）暂无每日签到活动"
		};
		const today = getUtc8DateString();
		try {
			const checkin = await target.client.usageClient.checkinStatus();
			if (!checkin.enabled) {
				this.store.write(variantId, {
					lastDate: today,
					lastAt: Date.now(),
					status: "no-campaign",
					message: "今日无签到活动"
				});
				return {
					state: "no-campaign",
					reason: "今日无签到活动"
				};
			}
			if (checkin.checkedIn) {
				this.store.write(variantId, {
					lastDate: today,
					lastAt: Date.now(),
					status: "already-claimed",
					amount: checkin.credits
				});
				return {
					state: "already-claimed",
					amount: checkin.credits
				};
			}
			const claimResult = await target.client.usageClient.claimCheckin();
			if (claimResult.ok) {
				const state = claimResult.alreadyClaimed ? "already-claimed" : "claimed";
				const amount = claimResult.credits ?? checkin.credits ?? 150;
				this.store.write(variantId, {
					lastDate: today,
					lastAt: Date.now(),
					status: state,
					amount
				});
				return {
					state,
					amount
				};
			}
			const failReason = claimResult.message ?? "签到失败，请稍后在 Trae 桌面端重试";
			this.store.write(variantId, {
				lastDate: today,
				lastAt: Date.now(),
				status: "error",
				message: failReason,
				amount: checkin.credits
			});
			return {
				state: "error",
				reason: failReason
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.store.write(variantId, {
				lastDate: today,
				lastAt: Date.now(),
				status: "error",
				message
			});
			return {
				state: "error",
				reason: message
			};
		}
	}
	async runAll() {
		const today = getUtc8DateString();
		for (const { variantId, client } of this.clients) {
			if (client.variant.region !== "cn") continue;
			try {
				const checkin = await client.usageClient.checkinStatus();
				if (!checkin.enabled) {
					this.store.write(variantId, {
						lastDate: today,
						lastAt: Date.now(),
						status: "no-campaign"
					});
					continue;
				}
				if (checkin.checkedIn) {
					this.store.write(variantId, {
						lastDate: today,
						lastAt: Date.now(),
						status: "already-claimed",
						amount: checkin.credits
					});
					continue;
				}
				const last = this.store.read(variantId);
				if (last?.lastDate === today && (last.status === "claimed" || last.status === "already-claimed")) continue;
				const claimResult = await client.usageClient.claimCheckin();
				if (claimResult.ok) {
					const status = claimResult.alreadyClaimed ? "already-claimed" : "claimed";
					this.store.write(variantId, {
						lastDate: today,
						lastAt: Date.now(),
						status,
						amount: claimResult.credits ?? checkin.credits
					});
				} else this.store.write(variantId, {
					lastDate: today,
					lastAt: Date.now(),
					status: "error",
					message: claimResult.message ?? "自动签到未成功",
					amount: checkin.credits
				});
			} catch (err) {
				this.store.write(variantId, {
					lastDate: today,
					lastAt: Date.now(),
					status: "error",
					message: err instanceof Error ? err.message : String(err)
				});
			}
		}
	}
};
//#endregion
//#region src/loopback.ts
/**
* 共享本地环回接口安全验证工具函数。
* 用于保护本地 shim 与同源状态路由，防止 DNS 重绑定攻击。
*
* @module dsh-trae-connect/loopback
*/
/** 允许的本地环回主机名白名单 */
const LOOPBACK_HOSTS$1 = /* @__PURE__ */ new Set([
	"127.0.0.1",
	"localhost",
	"[::1]"
]);
/** 从 Host 请求头中剥离可选的端口号（支持 IPv6 方括号格式） */
function hostnameOfHost$1(host) {
	let hostname = host.trim().toLowerCase();
	if (hostname.startsWith("[")) {
		const end = hostname.indexOf("]");
		return end === -1 ? hostname : hostname.slice(0, end + 1);
	}
	const colon = hostname.lastIndexOf(":");
	if (colon !== -1 && !hostname.slice(0, colon).includes(":") && /^\d+$/.test(hostname.slice(colon + 1))) hostname = hostname.slice(0, colon);
	return hostname;
}
/** 校验请求 Host 是否属于本地环回地址 */
function hostIsLoopback$1(host) {
	if (host === void 0 || host.trim() === "") return false;
	return LOOPBACK_HOSTS$1.has(hostnameOfHost$1(host));
}
/** 校验请求 Origin 是否属于本地环回地址（非浏览器发起无 Origin 默认放行） */
function originIsLoopback$1(origin) {
	if (origin === void 0 || origin.trim() === "") return true;
	try {
		const { hostname } = new URL(origin);
		return LOOPBACK_HOSTS$1.has(hostname) || hostname === "::1";
	} catch {
		return false;
	}
}
//#endregion
//#region src/login-route.ts
/**
* Trae 网页登录与授权路由处理器。
*
* @module dsh-trae-connect/login-route
*/
function createLoginKey() {
	return randomBytes(24).toString("hex");
}
function keyMatches$1(expected, presented) {
	if (presented === void 0 || presented.length !== expected.length) return false;
	const a = Buffer.from(expected);
	const b = Buffer.from(presented);
	return a.length === b.length && timingSafeEqual(a, b);
}
const MAX_BODY_BYTES$1 = 65536;
async function parseJsonBody$1(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let total = 0;
		req.on("data", (chunk) => {
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			total += buffer.length;
			if (total > MAX_BODY_BYTES$1) {
				reject(/* @__PURE__ */ new Error("请求体过大"));
				return;
			}
			chunks.push(buffer);
		});
		req.on("end", () => {
			try {
				const text = Buffer.concat(chunks).toString("utf8");
				resolve(text.trim() === "" ? {} : JSON.parse(text));
			} catch (err) {
				reject(err);
			}
		});
		req.on("error", reject);
	});
}
async function traeLoginHandler(req, res, options) {
	const send = (status, body) => {
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(JSON.stringify(body));
	};
	if (req.method !== "POST") {
		send(405, { error: "Method not allowed" });
		return;
	}
	if (!hostIsLoopback$1(req.headers.host) || !originIsLoopback$1(req.headers.origin)) {
		send(403, {
			status: "failed",
			message: "请求未受信：仅支持本地环回访问"
		});
		return;
	}
	if (options.loginKey !== void 0) {
		const headerKey = req.headers["x-trae-login-key"] ?? req.headers["x-dsh-login-key"];
		if (!keyMatches$1(options.loginKey(), headerKey)) {
			send(403, {
				status: "failed",
				message: "未经授权的操作：安全密钥不匹配"
			});
			return;
		}
	}
	let body;
	try {
		body = await parseJsonBody$1(req);
	} catch {
		send(400, {
			status: "failed",
			message: "无效的 JSON 请求体"
		});
		return;
	}
	try {
		if (body.action === "begin") {
			const attempt = await options.loginClient.begin();
			send(200, {
				status: "pending",
				state: attempt.state,
				url: attempt.authUrl
			});
		} else if (body.action === "poll") {
			if (typeof body.state !== "string" || body.state.trim() === "") {
				send(400, {
					status: "failed",
					message: "缺少轮询 state 标识"
				});
				return;
			}
			const pollRes = await options.loginClient.poll(body.state);
			if (pollRes.status === "complete") {
				options.onLoggedIn?.();
				send(200, {
					status: "complete",
					...pollRes.accountName !== void 0 ? { accountName: pollRes.accountName } : {},
					...pollRes.userId !== void 0 ? { userId: pollRes.userId } : {}
				});
			} else if (pollRes.status === "failed") send(200, {
				status: "failed",
				message: pollRes.message ?? "登录授权失败"
			});
			else send(200, { status: "pending" });
		} else if (body.action === "detect") {
			const cred = await options.loginClient.detectLocal();
			if (cred !== void 0) {
				options.onLoggedIn?.();
				send(200, {
					status: "complete",
					...cred.accountName !== void 0 ? { accountName: cred.accountName } : {},
					userId: cred.userId
				});
			} else send(200, {
				status: "failed",
				message: "未在本地检测到已登录的 Trae 账号或 CLI Token"
			});
		} else if (body.action === "import") {
			if (typeof body.document !== "string" || body.document.trim() === "") {
				send(400, {
					status: "failed",
					message: "缺少导入内容"
				});
				return;
			}
			const cred = await options.loginClient.importDocument(body.document);
			options.onLoggedIn?.();
			send(200, {
				status: "imported",
				...cred.accountName !== void 0 ? { accountName: cred.accountName } : {},
				userId: cred.userId
			});
		} else if (body.action === "logout") {
			await options.loginClient.logout();
			send(200, { status: "signed-out" });
		} else send(400, {
			status: "failed",
			message: "未知操作"
		});
	} catch (err) {
		send(200, {
			status: "failed",
			message: err instanceof Error ? err.message : String(err)
		});
	}
}
//#endregion
//#region src/probe-route.ts
/**
* Trae 探测、设置与签到控制路由处理器。
*
* @module dsh-trae-connect/probe-route
*/
function createProbeKey() {
	return randomBytes(24).toString("hex");
}
function keyMatches(expected, presented) {
	if (presented === void 0 || presented.length !== expected.length) return false;
	const a = Buffer.from(expected);
	const b = Buffer.from(presented);
	return a.length === b.length && timingSafeEqual(a, b);
}
const MAX_BODY_BYTES = 16384;
async function parseJsonBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let total = 0;
		req.on("data", (chunk) => {
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			total += buffer.length;
			if (total > MAX_BODY_BYTES) {
				reject(/* @__PURE__ */ new Error("请求体过大"));
				return;
			}
			chunks.push(buffer);
		});
		req.on("end", () => {
			try {
				const text = Buffer.concat(chunks).toString("utf8");
				resolve(text.trim() === "" ? {} : JSON.parse(text));
			} catch (err) {
				reject(err);
			}
		});
		req.on("error", reject);
	});
}
async function traeProbeHandler(req, res, options) {
	const send = (status, body) => {
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(JSON.stringify(body));
	};
	if (req.method !== "POST") {
		send(405, { error: "Method not allowed" });
		return;
	}
	if (!hostIsLoopback$1(req.headers.host) || !originIsLoopback$1(req.headers.origin)) {
		send(403, { error: "请求未受信：仅支持本地环回访问" });
		return;
	}
	if (options.probeKey !== void 0) {
		const headerKey = req.headers["x-trae-probe-key"] ?? req.headers["x-dsh-probe-key"];
		if (!keyMatches(options.probeKey(), headerKey)) {
			send(403, { error: "未经授权的操作：安全密钥不匹配" });
			return;
		}
	}
	let body;
	try {
		body = await parseJsonBody(req);
	} catch (err) {
		send(400, { error: err instanceof Error ? err.message : "无效的 JSON 请求体" });
		return;
	}
	try {
		if (body.action === "probe") {
			if (typeof body.model !== "string" || body.model === "") {
				send(400, { error: "缺少 model 参数" });
				return;
			}
			send(200, await options.probeService.probe(body.model));
		} else if (body.action === "clear") {
			options.probeService.clear();
			send(200, { state: "cleared" });
		} else if (body.action === "refresh") {
			if (options.onRefresh !== void 0) await options.onRefresh();
			send(200, { state: "refreshed" });
		} else if (body.action === "checkin") {
			if (options.onCheckin === void 0) {
				send(404, { error: "当前版本不支持每日签到" });
				return;
			}
			send(200, await options.onCheckin());
		} else if (body.action === "clear-checkin-logs") {
			options.onClearCheckInLogs?.();
			send(200, { state: "cleared" });
		} else if (body.action === "set-maximum-context-window") {
			if (options.onSetMaximumContextWindow === void 0) {
				send(404, { error: "当前版本不支持上下文窗口设置" });
				return;
			}
			send(200, await options.onSetMaximumContextWindow(body.enabled === true));
		} else if (body.action === "set-disabled-models") {
			if (options.onSetDisabledModels === void 0) {
				send(404, { error: "当前版本不支持模型禁用开关设置" });
				return;
			}
			send(200, await options.onSetDisabledModels(body.disabledModels ?? []));
		} else send(400, { error: "未知操作" });
	} catch (err) {
		send(500, { error: err instanceof Error ? err.message : String(err) });
	}
}
//#endregion
//#region src/probe.ts
const PROBE_EFFORT_CANDIDATES = [
	"low",
	"medium",
	"high",
	"xhigh"
];
const PROBE_REQUEST_TIMEOUT_MS = 3e4;
function randomSentinel() {
	return `probe_sentinel_${randomBytes(12).toString("hex")}`;
}
function isEffortRejection(attempt) {
	return attempt.status === 400 || attempt.errorCode !== void 0 && attempt.errorCode.includes("reasoning");
}
function isAcceptance(attempt) {
	return attempt.status === 200 && attempt.streamed;
}
async function probeModel(send, options = {}) {
	let requests = 0;
	const sentinelFactory = options.sentinel ?? randomSentinel;
	const baseline = await send(void 0, AbortSignal.timeout(PROBE_REQUEST_TIMEOUT_MS));
	requests++;
	if (!isAcceptance(baseline)) return {
		validation: "unknown",
		efforts: [],
		requests,
		reason: `baseline failed: HTTP ${baseline.status}`
	};
	const sentinel = await send(sentinelFactory(), AbortSignal.timeout(PROBE_REQUEST_TIMEOUT_MS));
	requests++;
	if (isAcceptance(sentinel)) return {
		validation: "non-validating",
		efforts: [],
		requests
	};
	if (!isEffortRejection(sentinel)) return {
		validation: "unknown",
		efforts: [],
		requests,
		reason: `sentinel gave unexpected status: ${sentinel.status}`
	};
	const supported = [];
	for (const effort of PROBE_EFFORT_CANDIDATES) {
		const attempt = await send(effort, AbortSignal.timeout(PROBE_REQUEST_TIMEOUT_MS));
		requests++;
		if (isAcceptance(attempt)) supported.push(effort);
	}
	return {
		validation: "validating",
		efforts: supported,
		requests
	};
}
//#endregion
//#region src/probe-service.ts
var TraeProbeService = class {
	options;
	queue = Promise.resolve();
	running = false;
	constructor(options) {
		this.options = options;
	}
	isRunning() {
		return this.running;
	}
	candidates() {
		return this.options.catalog.current().filter((m) => m.reasoningSupported || m.reasoningEfforts !== void 0).map((m) => m.id);
	}
	async probe(modelId) {
		if (!this.options.consent()) return {
			state: "unavailable",
			reason: "用户未授权推理档位探测"
		};
		const model = this.options.catalog.current().find((m) => m.id === modelId);
		if (model === void 0) return {
			state: "unavailable",
			reason: `模型 ${modelId} 不存在`
		};
		return new Promise((resolve) => {
			this.queue = this.queue.then(async () => {
				this.running = true;
				try {
					const outcome = await probeModel(this.options.send !== void 0 ? this.options.send(modelId) : async (effort, signal) => {
						const body = JSON.stringify({
							model: modelId,
							messages: [{
								role: "user",
								content: "ping"
							}],
							max_tokens: 1,
							...effort !== void 0 ? { reasoning_effort: effort } : {}
						});
						const result = await this.options.client.chatStream(body, signal);
						if (!result.ok) return {
							status: result.status,
							streamed: false,
							detail: result.message
						};
						return {
							status: 200,
							streamed: true
						};
					}, this.options.sentinel !== void 0 ? { sentinel: this.options.sentinel } : {});
					const currentAccount = this.options.account();
					this.options.store.put(model, outcome.validation, outcome.efforts, currentAccount);
					resolve({
						state: "ok",
						validation: outcome.validation,
						efforts: outcome.efforts,
						requests: outcome.requests
					});
				} catch (err) {
					resolve({
						state: "unavailable",
						reason: err instanceof Error ? err.message : String(err)
					});
				} finally {
					this.running = false;
				}
			});
		});
	}
	clear() {
		this.options.store.clear();
	}
};
//#endregion
//#region src/probe-store.ts
/**
* Persistent store for reasoning-effort probe observations.
*
* @module dsh-trae-connect/probe-store
*/
const TRAE_PROBE_FILENAME = ".trae-probe.json";
const PROBE_FORMAT_VERSION = 1;
const DEFAULT_TTL_MS = 12096e5;
function traeProbePath(filename = TRAE_PROBE_FILENAME) {
	return join(traeStateDir(), filename);
}
function fingerprintModel(model) {
	const parts = [
		model.id,
		model.reasoningSupported ? "reasoning:true" : "reasoning:false",
		JSON.stringify(model.reasoning?.supported ?? [])
	];
	return createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 16);
}
function newestFirst(records) {
	return Object.entries(records).sort(([, a], [, b]) => b.probedAtMs - a.probedAtMs);
}
var TraeProbeStore = class {
	path;
	ttlMs;
	records;
	constructor(options = {}) {
		if (options.path !== void 0) this.path = options.path;
		else {
			const filename = options.variant?.probeFilename ?? ".trae-probe.json";
			this.path = traeProbePath(filename);
		}
		this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
	}
	load() {
		if (this.records !== void 0) return this.records;
		if (!existsSync(this.path)) {
			this.records = {};
			return this.records;
		}
		try {
			const raw = JSON.parse(readFileSync(this.path, "utf8"));
			if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
				this.records = {};
				return this.records;
			}
			const doc = raw;
			if (doc["version"] !== PROBE_FORMAT_VERSION || typeof doc["records"] !== "object" || doc["records"] === null) {
				this.records = {};
				return this.records;
			}
			this.records = doc["records"];
			return this.records;
		} catch {
			this.records = {};
			return this.records;
		}
	}
	get(model, account) {
		const record = this.load()[model.id];
		if (record === void 0) return void 0;
		if (account !== void 0 && record.account !== account) return void 0;
		if (Date.now() - record.probedAtMs > this.ttlMs) return void 0;
		if (record.fingerprint !== fingerprintModel(model)) return void 0;
		return record;
	}
	all() {
		return { ...this.load() };
	}
	put(model, validation, efforts, account) {
		const current = this.load();
		current[model.id] = {
			fingerprint: fingerprintModel(model),
			validation,
			efforts: [...efforts],
			probedAtMs: Date.now(),
			pluginVersion: TRAE_CONNECT_VERSION,
			...account !== void 0 ? { account } : {}
		};
		this.flush();
	}
	clear() {
		this.records = {};
		this.flush();
	}
	flush() {
		const dir = dirname(this.path);
		if (!existsSync(dir)) try {
			mkdirSync(dir, { recursive: true });
		} catch {}
		const doc = {
			version: PROBE_FORMAT_VERSION,
			records: this.records ?? {}
		};
		const tempPath = `${this.path}.${process.pid}.${Date.now()}.tmp`;
		try {
			writeFileSync(tempPath, JSON.stringify(doc, null, 2), "utf8");
			renameSync(tempPath, this.path);
		} catch {}
	}
};
//#endregion
//#region src/refresh.ts
const OAUTH_CLIENT_ID = "en1oxy7wnw8j9n";
function normalizeHost(host) {
	const value = host.trim();
	if (value === "") throw new Error("Trae refresh host is missing");
	return value.replace(/\/$/, "");
}
async function refreshTraeCredential(credential, signal) {
	if (credential.refreshToken === void 0 || credential.refreshToken === "") throw new Error("Trae refresh token is missing");
	const { profile, deviceInfo } = await buildTraeDeviceInfo();
	const path = "/trae/api/v3/oauth/ExchangeToken";
	const proof = signDeviceProof("POST", path, OAUTH_CLIENT_ID, credential.refreshToken, profile.keyPair.privateKeyPEM);
	const body = {
		ClientID: OAUTH_CLIENT_ID,
		ClientSecret: "",
		RefreshToken: credential.refreshToken,
		DeviceInfo: deviceInfo,
		DeviceProof: {
			Signature: proof.signature,
			Timestamp: proof.timestamp,
			Nonce: proof.nonce
		},
		IDEVersion: "0.1.66"
	};
	const response = await fetch(`${normalizeHost(credential.host)}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-cloudide-token": "",
			"User-Agent": "Trae/0.1.66"
		},
		body: JSON.stringify(body),
		signal: signal ?? AbortSignal.timeout(3e4)
	});
	if (!response.ok) {
		let errorDetail = "";
		try {
			const errorText = await response.text();
			errorDetail = errorText !== "" ? ` - ${errorText}` : "";
		} catch {}
		throw new Error(`Trae token refresh failed (HTTP ${response.status})${errorDetail}`);
	}
	const result = (await response.json()).Result;
	const accessToken = typeof result?.["Token"] === "string" ? result["Token"] : "";
	if (accessToken === "") throw new Error("Trae token refresh returned no token");
	const expiry = result?.["TokenExpireAt"];
	const expiresAtMs = typeof expiry === "number" ? expiry > 0xe8d4a51000 ? expiry : expiry * 1e3 : typeof expiry === "string" ? Date.parse(expiry) : NaN;
	if (!Number.isFinite(expiresAtMs)) throw new Error("Trae token refresh returned an invalid expiry");
	const refreshToken = typeof result?.["RefreshToken"] === "string" && result["RefreshToken"] !== "" ? result["RefreshToken"] : void 0;
	return {
		accessToken,
		...refreshToken === void 0 ? {} : { refreshToken },
		expiresAtMs
	};
}
//#endregion
//#region src/sse.ts
/** Incremental SSE decoder supporting CRLF, chunk splits and multi-line data. */
var SseDecoder = class {
	buffer = "";
	event;
	id;
	retry;
	data = [];
	push(chunk) {
		this.buffer += chunk;
		const events = [];
		while (true) {
			const match = /\r?\n/.exec(this.buffer);
			if (match === null || match.index === void 0) break;
			const line = this.buffer.slice(0, match.index);
			this.buffer = this.buffer.slice(match.index + match[0].length);
			const emitted = this.consumeLine(line);
			if (emitted !== void 0) events.push(emitted);
		}
		return events;
	}
	finish() {
		const events = [];
		if (this.buffer !== "") {
			const emitted = this.consumeLine(this.buffer);
			this.buffer = "";
			if (emitted !== void 0) events.push(emitted);
		}
		const final = this.dispatch();
		if (final !== void 0) events.push(final);
		return events;
	}
	consumeLine(line) {
		if (line === "") return this.dispatch();
		if (line.startsWith(":")) return void 0;
		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		let value = colon === -1 ? "" : line.slice(colon + 1);
		if (value.startsWith(" ")) value = value.slice(1);
		if (field === "event") this.event = value;
		else if (field === "data") this.data.push(value);
		else if (field === "id" && !value.includes("\0")) this.id = value;
		else if (field === "retry" && /^\d+$/.test(value)) this.retry = Number(value);
	}
	dispatch() {
		if (this.data.length === 0) {
			this.event = void 0;
			this.retry = void 0;
			return;
		}
		const result = {
			...this.event === void 0 || this.event === "" ? {} : { event: this.event },
			data: this.data.join("\n"),
			...this.id === void 0 ? {} : { id: this.id },
			...this.retry === void 0 ? {} : { retry: this.retry }
		};
		this.event = void 0;
		this.retry = void 0;
		this.data = [];
		return result;
	}
};
function decodeTraeEvent(event) {
	if (event.data === "[DONE]") return {
		type: "done",
		finishReason: "stop"
	};
	let payload;
	try {
		payload = JSON.parse(event.data);
	} catch {
		return {
			type: "unknown",
			...event.event === void 0 ? {} : { event: event.event },
			data: event.data
		};
	}
	const record = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload : {};
	if (event.event === "request_wait_in_queue") return {
		type: "queue",
		...typeof record["position"] === "number" ? { position: record["position"] } : {}
	};
	if (event.event === "progress_notice") return {
		type: "progress",
		notice: payload
	};
	if (event.event === "token_usage") return {
		type: "usage",
		...typeof record["prompt_tokens"] === "number" ? { inputTokens: record["prompt_tokens"] } : {},
		...typeof record["completion_tokens"] === "number" ? { outputTokens: record["completion_tokens"] } : {},
		...typeof record["total_tokens"] === "number" ? { totalTokens: record["total_tokens"] } : {},
		...typeof record["reasoning_tokens"] === "number" ? { reasoningTokens: record["reasoning_tokens"] } : {}
	};
	if (event.event === "done" || typeof record["finish_reason"] === "string" && record["response"] === void 0) return {
		type: "done",
		finishReason: typeof record["finish_reason"] === "string" ? record["finish_reason"] : "stop"
	};
	if (event.event === "output" || record["response"] !== void 0 || record["reasoning_content"] !== void 0) return {
		type: "delta",
		text: typeof record["response"] === "string" ? record["response"] : "",
		...typeof record["reasoning_content"] === "string" ? { reasoning: record["reasoning_content"] } : {},
		...record["tool_calls"] === void 0 || record["tool_calls"] === null ? {} : { toolCalls: record["tool_calls"] }
	};
	return {
		type: "unknown",
		...event.event === void 0 ? {} : { event: event.event },
		data: payload
	};
}
//#endregion
//#region src/solo-bridge.ts
function normalizeToolCalls(value) {
	if (!Array.isArray(value)) return [];
	const calls = [];
	for (const raw of value) {
		if (typeof raw !== "object" || raw === null) continue;
		const record = raw;
		const rawFunction = typeof record["function_call"] === "object" && record["function_call"] !== null ? record["function_call"] : typeof record["function"] === "object" && record["function"] !== null ? record["function"] : {};
		const fn = {
			...typeof rawFunction["name"] === "string" ? { name: rawFunction["name"] } : {},
			...typeof rawFunction["arguments"] === "string" ? { arguments: rawFunction["arguments"] } : {}
		};
		calls.push({
			index: typeof record["index"] === "number" ? record["index"] : calls.length,
			...typeof record["id"] === "string" ? { id: record["id"] } : {},
			...record["type"] === "function" ? { type: "function" } : {},
			...Object.keys(fn).length === 0 ? {} : { function: fn }
		});
	}
	return calls;
}
function formatTraeErrorMessage(code, rawMsg = "") {
	let message = rawMsg.trim();
	if (code === 4120) message = "当前账号权限不足，该模型需要订阅 Trae Pro 会员计划 (错误码 4120)";
	else if (code === 4008) message = "当前 Trae 账号可用额度已耗尽，请前往 Trae 充值或升级套餐 (错误码 4008)";
	else if (code === 4001) message = rawMsg ? `${rawMsg} (错误码 4001)` : "模型调用参数无效 (错误码 4001)";
	else if (code === 4003) message = "Trae 账号登录凭据已失效，请重新登录 Trae 账号 (错误码 4003)";
	else if (code === 4029 || code === 429) message = "请求过于频繁，触发 Trae 限流，请稍后重试 (错误码 4029)";
	else if (!message) message = `Trae 上游请求错误 (错误码 ${code ?? "?"})`;
	return message;
}
function bridgeTraeSoloStream(response, model) {
	const source = response.body;
	if (source === null) return new Response(null, { status: 502 });
	const id = `chatcmpl-${randomUUID().replaceAll("-", "").slice(0, 24)}`;
	const created = Math.floor(Date.now() / 1e3);
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	const sse = new SseDecoder();
	let sawToolCalls = false;
	let emittedFinishReason = false;
	let upstreamError;
	let usage;
	const chunk = (delta, finishReason = null) => encoder.encode(`data: ${JSON.stringify({
		id,
		object: "chat.completion.chunk",
		created,
		model,
		choices: [{
			index: 0,
			delta,
			finish_reason: finishReason
		}],
		...usage === void 0 ? {} : { usage }
	})}\n\n`);
	const stream = new ReadableStream({
		async start(controller) {
			const reader = source.getReader();
			const consume = (event) => {
				const decoded = decodeTraeEvent(event);
				if (decoded.type === "unknown") {
					const payload = decoded.data;
					const code = typeof payload?.["code"] === "number" ? payload["code"] : void 0;
					if (decoded.event === "error" || code !== void 0 && code >= 4e3) {
						const message = formatTraeErrorMessage(code, typeof payload?.["message"] === "string" ? payload["message"].trim() : "");
						upstreamError = new Error(message);
					}
					return;
				}
				if (decoded.type === "delta") {
					const delta = {};
					if (decoded.text !== "") delta["content"] = decoded.text;
					if (decoded.reasoning !== void 0 && decoded.reasoning !== "") delta["reasoning_content"] = decoded.reasoning;
					const toolCalls = normalizeToolCalls(decoded.toolCalls);
					if (toolCalls.length > 0) {
						sawToolCalls = true;
						delta["tool_calls"] = toolCalls;
					}
					if (Object.keys(delta).length > 0) controller.enqueue(chunk(delta));
				} else if (decoded.type === "usage") usage = {
					...decoded.inputTokens === void 0 ? {} : { prompt_tokens: decoded.inputTokens },
					...decoded.outputTokens === void 0 ? {} : { completion_tokens: decoded.outputTokens },
					...decoded.totalTokens === void 0 ? {} : { total_tokens: decoded.totalTokens }
				};
				else if (decoded.type === "done") {
					if (!emittedFinishReason) {
						emittedFinishReason = true;
						if (upstreamError !== void 0) {
							controller.enqueue(chunk({ content: `\n\n⚠️ **[Trae 错误]**: ${upstreamError.message}` }));
							controller.enqueue(chunk({}, "stop"));
						} else controller.enqueue(chunk({}, sawToolCalls ? "tool_calls" : decoded.finishReason || "stop"));
					}
				}
			};
			try {
				while (true) {
					const next = await reader.read();
					if (next.done) break;
					for (const event of sse.push(decoder.decode(next.value, { stream: true }))) consume(event);
				}
				for (const event of sse.finish()) consume(event);
				if (!emittedFinishReason) {
					emittedFinishReason = true;
					if (upstreamError !== void 0) {
						controller.enqueue(chunk({ content: `\n\n⚠️ **[Trae 错误]**: ${upstreamError.message}` }));
						controller.enqueue(chunk({}, "stop"));
					} else controller.enqueue(chunk({}, sawToolCalls ? "tool_calls" : "stop"));
				}
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			} catch (error) {
				controller.error(error);
			} finally {
				reader.releaseLock();
			}
		},
		cancel(reason) {
			return source.cancel(reason);
		}
	});
	return new Response(stream, {
		status: 200,
		headers: { "Content-Type": "text/event-stream" }
	});
}
//#endregion
//#region src/shim.ts
const BODY_LIMIT = 67108864;
const LOOPBACK_HOSTS = /* @__PURE__ */ new Set([
	"127.0.0.1",
	"localhost",
	"[::1]"
]);
const STATUS_BY_KIND = {
	authentication: 401,
	hard_credit: 402,
	soft_rate: 429,
	not_found: 502,
	server: 502,
	client: 400,
	unconfigured: 503
};
function hostnameOfHost(host) {
	let hostname = host.trim().toLowerCase();
	if (hostname.startsWith("[")) {
		const end = hostname.indexOf("]");
		return end === -1 ? hostname : hostname.slice(0, end + 1);
	}
	const colon = hostname.lastIndexOf(":");
	if (colon !== -1 && /^\d+$/.test(hostname.slice(colon + 1))) hostname = hostname.slice(0, colon);
	return hostname;
}
function hostIsLoopback(host) {
	return host !== void 0 && host.trim() !== "" && LOOPBACK_HOSTS.has(hostnameOfHost(host));
}
function originIsLoopback(origin) {
	if (origin === void 0 || origin.trim() === "") return true;
	try {
		const hostname = new URL(origin).hostname;
		return LOOPBACK_HOSTS.has(hostname) || hostname === "::1";
	} catch {
		return false;
	}
}
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json",
		"Content-Length": Buffer.byteLength(payload)
	});
	res.end(payload);
}
function writeError(res, status, kind, message) {
	writeJson(res, status, { error: {
		message,
		type: kind,
		code: kind
	} });
}
function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > BODY_LIMIT) {
				reject(/* @__PURE__ */ new Error("request body too large"));
				req.destroy();
			} else chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks)));
		req.on("error", reject);
	});
}
function createTraeShim(options) {
	const secret = randomBytes(32).toString("base64url");
	const sockets = /* @__PURE__ */ new Set();
	const server = createServer((req, res) => {
		handle(req, res);
	});
	server.on("connection", (socket) => {
		sockets.add(socket);
		socket.once("close", () => sockets.delete(socket));
	});
	const ready = new Promise((resolve, reject) => {
		server.once("listening", resolve);
		server.once("error", reject);
	});
	server.listen(0, "127.0.0.1");
	function bearerOk(req) {
		const match = typeof req.headers.authorization === "string" ? /^Bearer\s+(.+)$/i.exec(req.headers.authorization.trim()) : null;
		if (match === null) return false;
		const actual = Buffer.from(match[1] ?? "");
		const expected = Buffer.from(secret);
		return actual.length === expected.length && timingSafeEqual(actual, expected);
	}
	async function handle(req, res) {
		try {
			if (!hostIsLoopback(req.headers.host)) return writeError(res, 403, "host_not_allowed", "Host must be loopback");
			if (!originIsLoopback(req.headers.origin)) return writeError(res, 403, "origin_not_allowed", "Origin must be loopback");
			if (!bearerOk(req)) return writeError(res, 401, "unauthorized", "Missing or invalid bearer");
			const url = req.url ?? "/";
			if (req.method === "GET" && (url === "/healthz" || url === "/healthz/")) return writeJson(res, 200, { ok: true });
			if (req.method === "GET" && (url === "/v1/models" || url === "/v1/models/")) return writeJson(res, 200, {
				object: "list",
				data: options.catalog.current().map((m) => ({
					id: m.id,
					object: "model",
					created: 0,
					owned_by: "trae"
				}))
			});
			if (req.method === "POST" && (url === "/v1/chat/completions" || url === "/v1/chat/completions/")) {
				const raw = (await readBody(req)).toString("utf8");
				let parsed;
				try {
					parsed = JSON.parse(raw);
				} catch {
					return writeError(res, 400, "invalid_json", "Request body must be valid JSON");
				}
				const modelName = typeof parsed.model === "string" && parsed.model !== "" ? parsed.model : "glm-5.2";
				const controller = new AbortController();
				const abort = () => controller.abort();
				req.once("aborted", abort);
				req.socket.once("close", abort);
				const result = await options.client.chatStream(raw, controller.signal);
				if (!result.ok) return writeError(res, STATUS_BY_KIND[result.kind], result.kind, result.message);
				const bridgedResponse = bridgeTraeSoloStream(result.response, modelName);
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					"Connection": "keep-alive",
					"X-Accel-Buffering": "no"
				});
				const bodyStream = Readable.fromWeb(bridgedResponse.body);
				bodyStream.on("error", (err) => {
					options.logger?.warn("dsh-trae-connect: stream error", err);
					if (!res.writableEnded) res.end();
				});
				bodyStream.pipe(res);
				return;
			}
			writeError(res, 404, "not_found", `No such route: ${req.method} ${url}`);
		} catch (error) {
			options.logger?.error("dsh-trae-connect: shim error", error);
			if (!res.headersSent) writeError(res, 500, "internal", "Internal shim error");
			else if (!res.writableEnded) res.end();
		}
	}
	return {
		ready,
		baseUrl() {
			const address = server.address();
			if (address === null || typeof address === "string") throw new Error("trae shim is not listening");
			return `http://127.0.0.1:${address.port}`;
		},
		token: () => secret,
		close: () => new Promise((resolve, reject) => {
			for (const socket of sockets) socket.destroy();
			server.close((error) => error === void 0 ? resolve() : reject(error));
		})
	};
}
//#endregion
//#region src/web-status.ts
const cachedCreditsByVariant = /* @__PURE__ */ new Map();
const CREDITS_TTL_MS = 6e4;
async function traeStatusHandler(req, res, options) {
	const send = (status, body) => {
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(JSON.stringify(body));
	};
	if (req.method !== "GET") {
		send(405, { error: "Method not allowed" });
		return;
	}
	if (!hostIsLoopback$1(req.headers.host) || !originIsLoopback$1(req.headers.origin)) {
		send(403, { error: "请求未受信：仅支持本地环回访问" });
		return;
	}
	const credential = await options.store.get();
	const modelBadges = options.models().map((m) => ({
		id: m.id,
		name: m.name,
		free: m.creditMultiplier === 0,
		...m.creditMultiplier !== void 0 ? { credits: `x${m.creditMultiplier.toFixed(2)}` } : {},
		...m.contextWindow !== void 0 ? { contextWindow: m.contextWindow } : {},
		...m.maxContextWindow !== void 0 ? { maxContextWindow: m.maxContextWindow } : {},
		...m.requiresMembership !== void 0 ? { requiresMembership: m.requiresMembership } : {}
	}));
	const probe = options.probe?.();
	const catalog = options.catalog?.();
	const checkIn = options.checkIn?.();
	const disabledModels = options.disabledModels?.();
	const useMaximumContextWindow = options.useMaximumContextWindow?.();
	if (credential === void 0 || credential.accessToken === "") {
		send(200, {
			status: "signed-out",
			region: options.variant.region,
			models: modelBadges,
			...catalog !== void 0 ? { catalog } : {},
			...probe !== void 0 ? { probe } : {},
			...options.loginKey !== void 0 ? { loginKey: options.loginKey } : {},
			...options.probeKey !== void 0 ? { probeKey: options.probeKey } : {},
			...checkIn !== void 0 ? { checkIn } : {},
			...disabledModels !== void 0 ? { disabledModels } : {},
			...useMaximumContextWindow !== void 0 ? { useMaximumContextWindow } : {}
		});
		return;
	}
	let credits;
	let creditsError;
	const now = Date.now();
	const forceRefresh = new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get("refresh") === "1";
	const cached = cachedCreditsByVariant.get(options.variant.id);
	if (!forceRefresh && cached !== void 0 && now - cached.at < CREDITS_TTL_MS) credits = cached.data;
	else {
		if (forceRefresh) options.onForceRefresh?.();
		try {
			credits = await options.client.fetchCredits(AbortSignal.timeout(1e4));
			cachedCreditsByVariant.set(options.variant.id, {
				data: credits,
				at: now
			});
		} catch (err) {
			creditsError = err instanceof Error ? err.message : String(err);
		}
	}
	send(200, {
		status: "signed-in",
		userId: credential.userId,
		nickname: credential.accountName ?? credential.userId,
		...credential.accountName !== void 0 ? { accountName: credential.accountName } : {},
		region: options.variant.region,
		source: credential.source,
		expiresAt: credential.expiresAtMs,
		...credits !== void 0 ? { credits } : {},
		...creditsError !== void 0 ? { creditsError } : {},
		models: modelBadges,
		...catalog !== void 0 ? { catalog } : {},
		...probe !== void 0 ? { probe } : {},
		...options.loginKey !== void 0 ? { loginKey: options.loginKey } : {},
		...options.probeKey !== void 0 ? { probeKey: options.probeKey } : {},
		...checkIn !== void 0 ? { checkIn } : {},
		...disabledModels !== void 0 ? { disabledModels } : {},
		...useMaximumContextWindow !== void 0 ? { useMaximumContextWindow } : {}
	});
}
//#endregion
//#region src/index.ts
const name = "llm-trae";
const inject = ["llm"];
const TRAE_SETTINGS_NS = "trae";
const TRAE_AI_SETTINGS_NS = "trae-global";
const TRAE_QUOTA_SETTINGS_NS = "trae-quota";
const PROBE_CONSENT_FIELD = z.boolean().default(false).description("Authorize reasoning-effort probes (each probe sends real requests that may consume credit)");
const MAXIMUM_CONTEXT_WINDOW_FIELD = z.boolean().default(true).description("Use the largest context window declared by Trae when alternatives are available (on by default)");
const QUOTA_TOGGLE_FIELD = z.boolean().default(false).description("Show this variant’s remaining-credit card in the sidebar footer (off by default)");
const CHECKIN_TOGGLE_FIELD = z.boolean().default(false).description("Automatically check in daily (off by default)");
const QUOTA_POLL_DEFAULT_MS = 3e5;
const QUOTA_POLL_MIN_MS = 6e4;
const QUOTA_POLL_FIELD = z.number().default(QUOTA_POLL_DEFAULT_MS).min(QUOTA_POLL_MIN_MS).description("Sidebar quota card refresh interval in milliseconds (default 300000, minimum 60000)");
const Config = z.object({
	probeConsent: PROBE_CONSENT_FIELD,
	useMaximumContextWindow: MAXIMUM_CONTEXT_WINDOW_FIELD,
	sidebarQuotaCN: QUOTA_TOGGLE_FIELD,
	sidebarQuotaAI: QUOTA_TOGGLE_FIELD,
	autoCheckInCN: CHECKIN_TOGGLE_FIELD,
	autoCheckInAI: CHECKIN_TOGGLE_FIELD,
	quotaPollMs: QUOTA_POLL_FIELD
});
const CN_SECTION = z.object({
	probeConsent: PROBE_CONSENT_FIELD,
	useMaximumContextWindow: MAXIMUM_CONTEXT_WINDOW_FIELD
});
const AI_SECTION = z.object({ useMaximumContextWindow: MAXIMUM_CONTEXT_WINDOW_FIELD });
const QUOTA_SECTION = z.object({
	sidebarQuotaCN: QUOTA_TOGGLE_FIELD,
	sidebarQuotaAI: QUOTA_TOGGLE_FIELD,
	autoCheckInCN: CHECKIN_TOGGLE_FIELD,
	autoCheckInAI: CHECKIN_TOGGLE_FIELD,
	quotaPollMs: QUOTA_POLL_FIELD
});
function apply(ctx, config = {}) {
	const contexts = [];
	const sources = {
		cn: () => config,
		ai: () => config,
		quota: () => config
	};
	const merged = () => ({
		...sources.cn().probeConsent === void 0 ? {} : { probeConsent: sources.cn().probeConsent },
		...sources.ai().useMaximumContextWindow === void 0 ? {} : { useMaximumContextWindow: sources.ai().useMaximumContextWindow },
		...sources.quota().sidebarQuotaCN === void 0 ? {} : { sidebarQuotaCN: sources.quota().sidebarQuotaCN },
		...sources.quota().sidebarQuotaAI === void 0 ? {} : { sidebarQuotaAI: sources.quota().sidebarQuotaAI },
		...sources.quota().autoCheckInCN === void 0 ? {} : { autoCheckInCN: sources.quota().autoCheckInCN },
		...sources.quota().autoCheckInAI === void 0 ? {} : { autoCheckInAI: sources.quota().autoCheckInAI },
		...sources.quota().quotaPollMs === void 0 ? {} : { quotaPollMs: sources.quota().quotaPollMs }
	});
	const maximumContextWindowByVariant = {
		trae: config.useMaximumContextWindow ?? true,
		"trae-global": config.useMaximumContextWindow ?? true
	};
	for (const variant of TRAE_VARIANTS) {
		const store = new TraeCredentialStore({
			variant,
			refresh: (cred) => refreshTraeCredential(cred)
		});
		const loginClient = new TraeLoginClient(variant, store);
		const catalog = new TraeCatalog(variant.region);
		const catalogStore = new TraeCatalogStore({ variant });
		const probeStore = new TraeProbeStore({ variant });
		const client = new TraeUpstreamClient({
			variant,
			store,
			catalog: () => catalog.current()
		});
		const probeService = new TraeProbeService({
			store: probeStore,
			catalog,
			client,
			consent: () => merged().probeConsent === true,
			account: () => variant.region
		});
		const shim = createTraeShim({
			catalog,
			client,
			logger: {
				warn: (message, ...args) => ctx.logger.warn(String(message), ...args),
				error: (message, ...args) => ctx.logger.error(String(message), ...args)
			}
		});
		const adapter = createTraeAdapter({
			variant,
			shim,
			catalog,
			useMaximumContextWindow: () => maximumContextWindowByVariant[variant.id] ?? false
		});
		shim.ready.then(() => {
			adapter.invalidate();
		});
		const key = createLoginKey();
		contexts.push({
			variant,
			store,
			loginClient,
			catalog,
			catalogStore,
			probeStore,
			probeService,
			client,
			shim,
			adapter,
			key
		});
		const cached = catalogStore.get(variant.region);
		if (cached !== void 0 && cached.models.length > 0) catalog.setSaved([...cached.models], cached.fetchedAtMs);
		const llmAny = ctx.llm;
		if (typeof llmAny.registerAdapter === "function") {
			const unregisterAdapter = llmAny.registerAdapter([variant.id], adapter.adapter);
			const unregisterConfig = llmAny.registerConfigurableProviders?.([{
				provider: variant.id,
				displayName: variant.displayName,
				settingsNs: variant.id === "trae" ? TRAE_SETTINGS_NS : TRAE_AI_SETTINGS_NS,
				settingsPath: [],
				declared: false
			}]);
			ctx.effect(() => () => {
				unregisterAdapter?.();
				unregisterConfig?.();
			});
		} else if (typeof llmAny.registerProvider === "function") {
			const handle = llmAny.registerProvider(adapter.adapter);
			ctx.effect(() => () => handle.unregister());
		}
		setTimeout(async () => {
			try {
				const live = await client.fetchCatalog();
				if (live.length > 0) {
					catalog.setLive(live);
					catalogStore.put(variant.region, "live", live);
					adapter.invalidate();
				}
			} catch {
				catalog.setFallback();
			}
		}, 1e3);
	}
	const scheduler = new CheckInScheduler(contexts.map((c) => ({
		variantId: c.variant.id,
		client: c.client
	})));
	scheduler.start();
	ctx.inject(["webServer"], (webCtx) => {
		for (const vCtx of contexts) webCtx.effect(() => {
			const disposeStatus = webCtx.webServer.register({
				kind: "exact",
				path: vCtx.variant.statusPath,
				handler: (req, res) => {
					traeStatusHandler(req, res, {
						variant: vCtx.variant,
						store: vCtx.store,
						client: vCtx.client,
						models: () => vCtx.catalog.current(),
						catalog: () => vCtx.catalog.status(),
						probe: () => ({
							consent: true,
							running: vCtx.probeService.isRunning(),
							candidates: vCtx.probeService.candidates(),
							results: Object.entries(vCtx.probeStore.all()).map(([id, r]) => ({
								id,
								name: id,
								validation: r.validation,
								efforts: r.efforts,
								probedAt: r.probedAtMs
							}))
						}),
						loginKey: vCtx.key,
						probeKey: vCtx.key,
						checkIn: () => {
							const rec = scheduler.get(vCtx.variant.id);
							if (!rec) return void 0;
							return {
								lastDate: rec.lastDate,
								lastAt: rec.lastAt,
								status: rec.status,
								amount: rec.amount,
								message: rec.message,
								logs: rec.logs
							};
						},
						disabledModels: () => vCtx.catalog.getDisabledModels(),
						useMaximumContextWindow: () => maximumContextWindowByVariant[vCtx.variant.id] ?? false,
						onForceRefresh: async () => {
							const live = await vCtx.client.fetchCatalog().catch(() => []);
							if (live.length > 0) {
								vCtx.catalog.setLive(live);
								vCtx.catalogStore.put(vCtx.variant.region, "live", live);
								vCtx.adapter.invalidate();
							}
						}
					});
				}
			});
			const disposeLogin = webCtx.webServer.register({
				kind: "exact",
				path: vCtx.variant.loginPath,
				handler: (req, res) => {
					traeLoginHandler(req, res, {
						variant: vCtx.variant,
						loginClient: vCtx.loginClient,
						loginKey: () => vCtx.key,
						onLoggedIn: () => {
							vCtx.client.fetchCatalog().then((live) => {
								if (live.length > 0) {
									vCtx.catalog.setLive(live);
									vCtx.catalogStore.put(vCtx.variant.region, "live", live);
									vCtx.adapter.invalidate();
								}
							});
						}
					});
				}
			});
			const disposeProbe = webCtx.webServer.register({
				kind: "exact",
				path: vCtx.variant.probePath,
				handler: (req, res) => {
					traeProbeHandler(req, res, {
						variant: vCtx.variant,
						probeService: vCtx.probeService,
						probeKey: () => vCtx.key,
						onRefresh: async () => {
							const live = await vCtx.client.fetchCatalog();
							if (live.length > 0) {
								vCtx.catalog.setLive(live);
								vCtx.catalogStore.put(vCtx.variant.region, "live", live);
								vCtx.adapter.invalidate();
							}
							await scheduler.syncVariant(vCtx.variant.id);
						},
						onCheckin: async () => {
							return await scheduler.checkIn(vCtx.variant.id);
						},
						onClearCheckInLogs: () => {
							scheduler.clearLogs(vCtx.variant.id);
						},
						onSetMaximumContextWindow: async (enabled) => {
							maximumContextWindowByVariant[vCtx.variant.id] = enabled;
							vCtx.adapter.invalidate();
							return {
								state: "updated",
								enabled
							};
						},
						onSetDisabledModels: async (disabled) => {
							vCtx.catalog.setDisabledModels(disabled);
							vCtx.adapter.invalidate();
							return {
								state: "updated",
								disabledModels: disabled
							};
						}
					});
				}
			});
			return () => {
				disposeStatus();
				disposeLogin();
				disposeProbe();
			};
		});
	});
	writeHostHeartbeat();
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.installSection(ctx, TRAE_SETTINGS_NS, CN_SECTION, config, {
			setSource(source) {
				sources.cn = source;
			},
			onChange: () => {}
		});
		settingsCtx.settings.installSection(ctx, TRAE_AI_SETTINGS_NS, AI_SECTION, config, {
			setSource(source) {
				sources.ai = source;
			},
			onChange: () => {}
		});
		settingsCtx.settings.installSection(ctx, TRAE_QUOTA_SETTINGS_NS, QUOTA_SECTION, config, {
			setSource(source) {
				sources.quota = source;
			},
			onChange: () => {
				scheduler.runAll();
			}
		});
	});
	ctx.effect(() => () => {
		scheduler.stop();
		clearHostHeartbeat();
		for (const vCtx of contexts) vCtx.shim.close().catch(() => {});
	});
}
//#endregion
export { AI_VARIANT, CN_VARIANT, CheckInScheduler, Config, FALLBACK_TRAE_MODELS, FALLBACK_TRAE_MODELS_AI, JsonFileCheckInStore, PROBE_EFFORT_CANDIDATES, QUOTA_POLL_DEFAULT_MS, QUOTA_POLL_MIN_MS, TRAE_AI_LOGIN_PATH, TRAE_AI_PROBE_PATH, TRAE_AI_PROVIDER, TRAE_AI_SETTINGS_NS, TRAE_AI_STATUS_PATH, TRAE_CATALOG_FILENAME, TRAE_CONNECT_VERSION, TRAE_LOGIN_PATH, TRAE_PROBE_FILENAME, TRAE_PROBE_PATH, TRAE_PROVIDER, TRAE_QUOTA_SETTINGS_NS, TRAE_SETTINGS_NS, TRAE_STATUS_PATH, TRAE_VARIANTS, TraeCatalog, TraeCatalogStore, TraeCredentialStore, TraeLoginClient, TraeProbeService, TraeProbeStore, TraeUpstreamClient, apply, classifyUpstreamError, clearHostHeartbeat, createLoginKey, createProbeKey, createTraeAdapter, createTraeShim, fallbackModelsFor, fingerprintModel, formatTraeModelDisplayName, getUtc8DateString, inject, isHeartbeatProcessAlive, mergeTraeModelSources, name, newestFirst, parseTraeAuth, parseTraeDocument, probeModel, readHostHeartbeat, refreshTraeCredential, traeHostHeartbeatPath, traeLoginHandler, traePluginDataDir, traeProbeHandler, traeStateDir, traeStatusHandler, traeStorageCandidates, variantFor, variantForRegion, writeHostHeartbeat };
