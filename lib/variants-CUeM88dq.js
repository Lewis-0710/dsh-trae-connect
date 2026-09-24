import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { createDecipheriv, createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { homedir, hostname, release, userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { execSync } from "node:child_process";
//#region src/catalog.ts
/**
* 国内版（16 个模型，含 Auto）兜底目录。
*/
const FALLBACK_TRAE_MODELS = [
	{
		id: "auto",
		name: "Auto",
		contextWindow: 2e5,
		wireConfigName: "glm-5.2",
		wireFunction: "solo_work_lite"
	},
	{
		id: "Doubao-Seed-Evolving",
		name: "Seed-Evolving",
		contextWindow: 2e5,
		creditMultiplier: .8,
		wireConfigName: "Doubao-Seed-Evolving",
		wireFunction: "solo_work_remote"
	},
	{
		id: "Doubao-Seed-2.1-Pro",
		name: "Seed-2.1-Pro-0915",
		contextWindow: 2e5,
		creditMultiplier: .8,
		wireConfigName: "Doubao-Seed-2.1-Pro",
		wireFunction: "solo_work_remote"
	},
	{
		id: "Doubao-Seed-2.1-Turbo",
		name: "Seed-2.1-Turbo",
		contextWindow: 2e5,
		creditMultiplier: .2,
		wireConfigName: "Doubao-Seed-2.1-Turbo",
		wireFunction: "solo_work_remote"
	},
	{
		id: "Doubao-Seed-Code",
		name: "Seed-Code",
		contextWindow: 2e5,
		creditMultiplier: .06,
		wireConfigName: "Doubao-Seed-Code",
		wireFunction: "solo_agent_remote"
	},
	{
		id: "step-5-preview",
		name: "Step-5-Preview",
		contextWindow: 2e5,
		creditMultiplier: .48,
		wireConfigName: "step-5-preview",
		wireFunction: "solo_work_remote"
	},
	{
		id: "glm-5.3",
		name: "GLM-5.3",
		contextWindow: 2e5,
		creditMultiplier: .78,
		wireConfigName: "glm-5.3",
		wireFunction: "solo_work_remote"
	},
	{
		id: "glm-5.2",
		name: "GLM-5.2",
		contextWindow: 2e5,
		creditMultiplier: .78,
		wireConfigName: "glm-5.2",
		wireFunction: "solo_work_remote"
	},
	{
		id: "DeepSeek-V4-Flash-Official",
		name: "DeepSeek-V4-Flash 正式版",
		contextWindow: 2e5,
		creditMultiplier: .16,
		wireConfigName: "DeepSeek-V4-Flash-Official",
		wireFunction: "solo_work_remote"
	},
	{
		id: "DeepSeek-V4-Pro-Official",
		name: "DeepSeek-V4-Pro 正式版",
		contextWindow: 2e5,
		creditMultiplier: .72,
		wireConfigName: "DeepSeek-V4-Pro-Official",
		wireFunction: "solo_work_remote"
	},
	{
		id: "kimi-k3",
		name: "Kimi-K3",
		contextWindow: 2e5,
		creditMultiplier: 1.83,
		wireConfigName: "kimi-k3",
		wireFunction: "solo_work_remote"
	},
	{
		id: "kimi-k2.7-code",
		name: "Kimi-K2.7-Code",
		contextWindow: 2e5,
		creditMultiplier: .83,
		wireConfigName: "kimi-k2.7-code",
		wireFunction: "solo_work_remote"
	},
	{
		id: "kimi-k2.6",
		name: "Kimi-K2.6",
		contextWindow: 2e5,
		creditMultiplier: .75,
		wireConfigName: "kimi-k2.6",
		wireFunction: "solo_work_remote"
	},
	{
		id: "minimax-m3",
		name: "MiniMax-M3",
		contextWindow: 2e5,
		creditMultiplier: .26,
		wireConfigName: "minimax-m3",
		wireFunction: "solo_work_remote"
	},
	{
		id: "qwen3.8-max",
		name: "Qwen3.8-Max",
		contextWindow: 2e5,
		creditMultiplier: 1.5,
		wireConfigName: "qwen3.8-max",
		wireFunction: "solo_work_remote"
	},
	{
		id: "qwen-3.7-plus",
		name: "Qwen3.7-Plus",
		contextWindow: 2e5,
		creditMultiplier: .25,
		wireConfigName: "qwen-3.7-plus",
		wireFunction: "solo_work_remote"
	}
];
/**
* 国际版（17 个模型，含 Auto）兜底目录。
*/
const FALLBACK_TRAE_MODELS_AI = [
	{
		id: "auto",
		name: "Auto",
		contextWindow: 2e5,
		wireConfigName: "gpt-5.4",
		wireFunction: "solo_agent"
	},
	{
		id: "Dola-Seed-2.0-Code",
		name: "Seed-2.1-Turbo",
		contextWindow: 2e5,
		wireConfigName: "Dola-Seed-2.0-Code",
		wireFunction: "solo_agent"
	},
	{
		id: "gpt-6-astra",
		name: "GPT-6-Astra",
		contextWindow: 272e3,
		wireConfigName: "gpt-6-astra",
		wireFunction: "solo_agent"
	},
	{
		id: "gpt-5.6-sol",
		name: "GPT-5.6-Sol",
		contextWindow: 272e3,
		wireConfigName: "gpt-5.6-sol",
		wireFunction: "solo_agent"
	},
	{
		id: "gpt-5.6-terra",
		name: "GPT-5.6-Terra",
		contextWindow: 272e3,
		wireConfigName: "gpt-5.6-terra",
		wireFunction: "solo_agent"
	},
	{
		id: "gpt-5.6-luna",
		name: "GPT-5.6-Luna",
		contextWindow: 272e3,
		wireConfigName: "gpt-5.6-luna",
		wireFunction: "solo_agent"
	},
	{
		id: "gpt-5.5",
		name: "GPT-5.5",
		contextWindow: 272e3,
		wireConfigName: "gpt-5.5",
		wireFunction: "solo_agent"
	},
	{
		id: "gpt-5.4",
		name: "GPT-5.4",
		contextWindow: 272e3,
		wireConfigName: "gpt-5.4",
		wireFunction: "solo_agent"
	},
	{
		id: "gpt-5.2",
		name: "GPT-5.2",
		contextWindow: 272e3,
		wireConfigName: "gpt-5.2",
		wireFunction: "solo_agent"
	},
	{
		id: "glm-5.2",
		name: "GLM-5.2",
		contextWindow: 2e5,
		wireConfigName: "glm-5.2",
		wireFunction: "solo_agent"
	},
	{
		id: "deepseek-v4-flash-0731",
		name: "DeepSeek-V4-Flash",
		contextWindow: 2e5,
		wireConfigName: "deepseek-v4-flash-0731",
		wireFunction: "solo_agent"
	},
	{
		id: "kimi-k2.7-code",
		name: "Kimi-K2.7-Code",
		contextWindow: 2e5,
		wireConfigName: "kimi-k2.7-code",
		wireFunction: "solo_agent"
	},
	{
		id: "kimi-k2.5",
		name: "Kimi-K2.5",
		contextWindow: 2e5,
		wireConfigName: "kimi-k2.5",
		wireFunction: "solo_agent"
	},
	{
		id: "gemini-3.1-pro",
		name: "Gemini-3.1-Pro-Preview",
		contextWindow: 2e5,
		wireConfigName: "gemini-3.1-pro",
		wireFunction: "solo_agent"
	},
	{
		id: "gemini-3-flash-solo",
		name: "Gemini-3-Flash-Preview",
		contextWindow: 2e5,
		wireConfigName: "gemini-3-flash-solo",
		wireFunction: "solo_agent"
	},
	{
		id: "minimax-m3",
		name: "MiniMax-M3",
		contextWindow: 2e5,
		wireConfigName: "minimax-m3",
		wireFunction: "solo_agent"
	},
	{
		id: "minimax-m2.7",
		name: "MiniMax-M2.7",
		contextWindow: 2e5,
		wireConfigName: "minimax-m2.7",
		wireFunction: "solo_agent"
	}
];
function fallbackModelsFor(region) {
	return region === "ai" ? FALLBACK_TRAE_MODELS_AI : FALLBACK_TRAE_MODELS;
}
const RATE_SEPARATOR = " · ";
/**
* 格式化模型在 DSH 界面中的展示名称。
* 对齐 WorkBuddy 格式规范：通过 ` · ` 分割显示模型名、积分倍率与活动标签。
* 样例：
*   - Auto · 智能路由
*   - GLM-5.3 · x0.78
*   - DeepSeek-V4-Flash 正式版 · x0.16
*   - Hy3 · x0.00 · 限时免费
*   - GLM-5.2 · x0.79 · 夜间折扣
*/
function formatTraeModelDisplayName(model) {
	if (model.id.toLowerCase() === "auto" || model.name.toLowerCase() === "auto") return "Auto · 智能路由";
	const parts = [model.name];
	if (model.creditMultiplier !== void 0) parts.push(`x${model.creditMultiplier.toFixed(2)}`);
	if (model.badges !== void 0 && model.badges.length > 0) parts.push(...model.badges);
	else if (model.creditMultiplier === 0) parts.push("限时免费");
	else if (model.requiresMembership === true) parts.push("会员计划");
	return parts.join(RATE_SEPARATOR);
}
function traeInputModalities(model) {
	return [...model.input ?? ["text"]];
}
function displayKey(name) {
	return name.trim().toLowerCase();
}
/**
* 合并远端模型目录与 wire 运行时映射。
* 确保包含 Auto 以及所有可调用的模型，不遗漏任何有效模型。
*/
function mergeTraeModelSources(remote, wire, region = "cn") {
	const wireByName = /* @__PURE__ */ new Map();
	const wireById = /* @__PURE__ */ new Map();
	for (const model of wire) {
		wireByName.set(displayKey(model.name), model);
		wireById.set(displayKey(model.id), model);
	}
	const seenIds = /* @__PURE__ */ new Set();
	const seenNames = /* @__PURE__ */ new Set();
	const result = [];
	const defaultWire = region === "ai" ? "gpt-5.4" : "glm-5.2";
	const defaultFunction = region === "ai" ? "solo_agent" : "solo_work_lite";
	result.push({
		id: "auto",
		name: "Auto",
		contextWindow: 2e5,
		wireConfigName: defaultWire,
		wireFunction: defaultFunction
	});
	seenIds.add("auto");
	seenNames.add("auto");
	for (const model of remote) {
		const idKey = displayKey(model.id);
		const nameKey = displayKey(model.name);
		if (seenIds.has(idKey) || seenNames.has(nameKey)) continue;
		const wireModel = wireById.get(idKey) ?? wireByName.get(nameKey);
		const wireConfigName = wireModel !== void 0 && wireModel.id !== "" && wireModel.id !== model.id ? wireModel.id : model.id;
		const wireFunction = wireModel?.function ?? (region === "ai" ? "solo_agent" : "solo_work_remote");
		seenIds.add(idKey);
		seenNames.add(nameKey);
		result.push({
			id: model.id,
			name: model.name,
			...model.contextWindow === void 0 ? {} : { contextWindow: model.contextWindow },
			...model.maxContextWindow === void 0 ? {} : { maxContextWindow: model.maxContextWindow },
			...model.creditMultiplier === void 0 ? {} : { creditMultiplier: model.creditMultiplier },
			...model.badges !== void 0 && model.badges.length > 0 ? { badges: model.badges } : {},
			input: model.multimodal ? ["text", "image"] : ["text"],
			...model.requiresMembership ? { requiresMembership: true } : {},
			reasoningSupported: model.reasoningSupported,
			...model.reasoning === void 0 ? {} : {
				reasoning: model.reasoning,
				reasoningEfforts: Object.fromEntries(model.reasoning.supported.map((effort) => [effort, effort === "low" ? "light" : effort === "xhigh" ? "extra_high" : "high"]))
			},
			wireConfigName,
			wireFunction
		});
	}
	return result;
}
function finitePositive(value) {
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function record(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function parseFeatures(value) {
	if (typeof value === "object" && value !== null && !Array.isArray(value)) return value;
	if (typeof value !== "string" || value === "") return void 0;
	try {
		return record(JSON.parse(value));
	} catch {
		return;
	}
}
const EFFORT_MAP = {
	light: "low",
	high: "high",
	extra_high: "xhigh"
};
function parseTraeRemoteModel(value) {
	const raw = record(value);
	if (raw === void 0 || typeof raw["name"] !== "string" || raw["name"] === "") return void 0;
	const context = record(raw["context_window_tokens"]);
	const features = parseFeatures(raw["features"]);
	const contextWindowsFeature = record(features?.["context_windows"]);
	const contextWindowsData = record(contextWindowsFeature?.["data"]);
	const contextWindowSize = record(raw["context_window_size"]);
	const dev = finitePositive(context?.["dev"]) ?? finitePositive(contextWindowsData?.["dev_context"]) ?? finitePositive(contextWindowSize?.["default"]) ?? finitePositive(raw["prompt_max_tokens"]);
	const maxFromList = Array.isArray(contextWindowsData?.["max_context_list"]) ? finitePositive(contextWindowsData["max_context_list"][0]) : void 0;
	const maxFromSizeList = Array.isArray(contextWindowSize?.["max"]) ? finitePositive(contextWindowSize["max"][0]) : void 0;
	const maxVal = finitePositive(context?.["max"]) ?? finitePositive(contextWindowsData?.["max_context"]) ?? maxFromList ?? finitePositive(contextWindowSize?.["max"]) ?? maxFromSizeList;
	const max = (raw["max_mode"] === true || contextWindowsFeature?.["enable"] === true || maxVal !== void 0) && maxVal !== void 0 && maxVal > (dev ?? 0) ? maxVal : void 0;
	const activityDiscount = record(features?.["activity_discount"]);
	const currentDiscount = record(record(activityDiscount?.["data"])?.["current"]);
	const discountedRate = activityDiscount?.["enable"] === true ? finitePositive(currentDiscount?.["consumption_rate"]) : void 0;
	const consumption = record(features?.["consumption_rate"]);
	const consumptionData = record(consumption?.["data"]);
	const standardRate = consumption?.["enable"] === true ? finitePositive(consumptionData?.["rate"]) : void 0;
	const creditMultiplier = discountedRate ?? standardRate;
	const badges = [];
	if (activityDiscount?.["enable"] === true) {
		const actName = typeof currentDiscount?.["activity_name"] === "string" ? currentDiscount["activity_name"].trim() : "";
		const actType = typeof currentDiscount?.["discount_type"] === "string" ? currentDiscount["discount_type"].trim() : "";
		if (actName !== "") badges.push(actName);
		else if (actType === "limited" || actType === "time_limit") badges.push("限时优惠");
		else if (actType === "night") badges.push("夜间折扣");
	}
	if (creditMultiplier === 0 && !badges.includes("限时免费")) badges.push("限时免费");
	const reasoningSupported = record(features?.["reasoning"])?.["enable"] === true;
	const multimodalFeature = record(features?.["multimodal"]);
	const multimodal = raw["multimodal"] === true || multimodalFeature?.["enable"] === true;
	const accessData = record(record(features?.["access"])?.["data"]);
	const identityList = Array.isArray(accessData?.["identity_list"]) ? accessData["identity_list"] : void 0;
	const requiresMembership = identityList !== void 0 && !identityList.includes(0);
	const reasoningConfig = record(raw["reasoning_effort_config"]);
	const supported = (Array.isArray(reasoningConfig?.["options"]) ? reasoningConfig["options"] : []).flatMap((option) => {
		if (typeof option !== "string") return [];
		const effort = EFFORT_MAP[option];
		return effort === void 0 ? [] : [effort];
	});
	const rawDefault = reasoningConfig?.["default_level"];
	const mappedDefault = typeof rawDefault === "string" ? EFFORT_MAP[rawDefault] : void 0;
	const defaultEffort = mappedDefault !== void 0 && supported.includes(mappedDefault) ? mappedDefault : void 0;
	return {
		id: raw["name"],
		name: typeof raw["display_name"] === "string" && raw["display_name"] !== "" ? raw["display_name"] : raw["name"],
		multimodal,
		...requiresMembership ? { requiresMembership: true } : {},
		...dev === void 0 ? {} : { contextWindow: dev },
		...max === void 0 ? {} : { maxContextWindow: max },
		...creditMultiplier === void 0 ? {} : { creditMultiplier },
		...badges.length > 0 ? { badges } : {},
		reasoningSupported,
		...supported.length === 0 ? {} : { reasoning: {
			supported,
			...defaultEffort === void 0 ? {} : { defaultEffort }
		} }
	};
}
var TraeCatalog = class {
	region;
	models;
	disabledModels = /* @__PURE__ */ new Set();
	source = "fallback";
	fetchedAt = void 0;
	lastError = void 0;
	listeners = /* @__PURE__ */ new Set();
	constructor(region) {
		this.region = region;
		this.models = [...fallbackModelsFor(region)];
	}
	setDisabledModels(disabled) {
		const next = new Set(disabled);
		if (this.disabledModels.size === next.size && [...this.disabledModels].every((id) => next.has(id))) return false;
		this.disabledModels = next;
		this.notify();
		return true;
	}
	getDisabledModels() {
		return Array.from(this.disabledModels);
	}
	current() {
		return this.models;
	}
	status() {
		return {
			source: this.source,
			...this.fetchedAt !== void 0 ? { fetchedAt: this.fetchedAt } : {},
			...this.lastError !== void 0 ? { error: this.lastError } : {}
		};
	}
	setLive(models) {
		if (models.length === 0) return;
		this.models = [...models];
		this.source = "live";
		this.fetchedAt = Date.now();
		this.lastError = void 0;
		this.notify();
	}
	setSaved(models, fetchedAt) {
		if (this.source === "live" || models.length === 0) return;
		this.models = [...models];
		this.source = "saved";
		this.fetchedAt = fetchedAt;
		this.notify();
	}
	setFallback(error) {
		if (this.source === "live") {
			this.lastError = error;
			return;
		}
		if (this.source !== "saved") {
			this.models = [...fallbackModelsFor(this.region)];
			this.source = "fallback";
		}
		this.lastError = error;
		this.notify();
	}
	subscribe(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	notify() {
		for (const listener of this.listeners) try {
			listener();
		} catch {}
	}
};
//#endregion
//#region src/decrypt.ts
const TRAE_AUTH_STORAGE_KEY = "iCubeAuthInfo://icube.cloudide";
const SALT_A = Uint8Array.from([
	82,
	9,
	106,
	213,
	48,
	54,
	165,
	56,
	191,
	64,
	163,
	158,
	129,
	243,
	215,
	251,
	124,
	227,
	57,
	130,
	155,
	47,
	255,
	135,
	52,
	142,
	67,
	68,
	196,
	222,
	233,
	203,
	84,
	123,
	148,
	50,
	166,
	194,
	35,
	61,
	238,
	76,
	149,
	11,
	66,
	250,
	195,
	78,
	8,
	46,
	161,
	102,
	40,
	217,
	36,
	178,
	118,
	91,
	162,
	73,
	109,
	139,
	209,
	37
]);
const SALT_B = Uint8Array.from([
	31,
	221,
	168,
	51,
	136,
	7,
	199,
	49,
	177,
	18,
	16,
	89,
	39,
	128,
	236,
	95,
	96,
	81,
	127,
	169,
	25,
	181,
	74,
	13,
	45,
	229,
	122,
	159,
	147,
	201,
	156,
	239,
	160,
	224,
	59,
	77,
	174,
	42,
	245,
	176,
	200,
	235,
	187,
	60,
	131,
	83,
	153,
	97,
	23,
	43,
	4,
	126,
	186,
	119,
	214,
	38,
	225,
	105,
	20,
	99,
	85,
	33,
	12,
	125
]);
const SALT_C = Uint8Array.from([
	191,
	192,
	216,
	250,
	122,
	246,
	220,
	97,
	31,
	254,
	98,
	27,
	8,
	72,
	71,
	176,
	135,
	99,
	96,
	18,
	127,
	101,
	203,
	104,
	211,
	102,
	191,
	125,
	37,
	72,
	150,
	156,
	51,
	229,
	121,
	35,
	17,
	153,
	141,
	177,
	110,
	131,
	150,
	128,
	172,
	255,
	254,
	6,
	18,
	140,
	55,
	62,
	236,
	249,
	135,
	64,
	135,
	12,
	117,
	4,
	89,
	149,
	168,
	209
]);
const SALT_D = Uint8Array.from([
	246,
	204,
	26,
	232,
	232,
	70,
	129,
	109,
	223,
	146,
	169,
	242,
	23,
	241,
	105,
	145,
	50,
	196,
	165,
	42,
	254,
	120,
	3,
	54,
	244,
	207,
	209,
	85,
	53,
	6,
	138,
	106,
	175,
	148,
	31,
	204,
	186,
	186,
	165,
	182,
	87,
	142,
	49,
	10,
	39,
	110,
	26,
	154,
	86,
	56,
	173,
	125,
	18,
	64,
	198,
	225,
	99,
	99,
	83,
	82,
	191,
	134,
	76,
	170
]);
function xor(a, b) {
	return Buffer.from(a.map((value, index) => value ^ (b[index] ?? 0)));
}
function encryptionType(header) {
	if (header.equals(Buffer.from([
		116,
		99,
		5,
		16,
		0,
		0
	]))) return "aes";
	if (header.equals(Buffer.from([
		18,
		57,
		32,
		32,
		2,
		3
	]))) return "aes-private";
	throw new Error("unsupported Trae auth encryption header");
}
function decryptTraeStorageValue(encoded) {
	const buffer = Buffer.from(encoded, "base64");
	if (buffer.length <= 102) throw new Error("Trae auth ciphertext is too short");
	const type = encryptionType(buffer.subarray(0, 6));
	const random = buffer.subarray(6, 38);
	const encrypted = buffer.subarray(38);
	const salt = type === "aes-private" ? xor(SALT_C, SALT_D) : xor(SALT_A, SALT_B);
	const first = createHash("sha512").update(random).digest();
	const derived = createHash("sha512").update(Buffer.concat([first, salt])).digest();
	const decipher = createDecipheriv("aes-128-cbc", derived.subarray(0, 16), derived.subarray(16, 32));
	const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
	if (decrypted.length < 64) throw new Error("Trae auth plaintext is too short");
	const expected = decrypted.subarray(0, 64);
	const plaintext = decrypted.subarray(64);
	const actual = createHash("sha512").update(plaintext).digest();
	if (!expected.equals(actual)) throw new Error("Trae auth integrity check failed");
	return plaintext.toString("utf8");
}
function parseTraeAuthValue(value) {
	const trimmed = value.trim();
	if (trimmed === "") throw new Error("Trae auth value is empty");
	const plaintext = trimmed.startsWith("{") ? trimmed : decryptTraeStorageValue(trimmed);
	return JSON.parse(plaintext);
}
function parseTraeStorageDocument(text) {
	const parsed = JSON.parse(text);
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("Trae storage document must be an object");
	const value = parsed[TRAE_AUTH_STORAGE_KEY];
	if (typeof value !== "string") throw new Error(`Trae storage document has no ${TRAE_AUTH_STORAGE_KEY}`);
	return parseTraeAuthValue(value);
}
function decodeBase64UrlJson(segment) {
	try {
		const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
		const decoded = Buffer.from(padded, "base64").toString("utf8");
		const parsed = JSON.parse(decoded);
		return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : void 0;
	} catch {
		return;
	}
}
function parseTraeCliToken(text) {
	const trimmed = text.trim();
	if (trimmed === "") throw new Error("Trae CLI token file is empty");
	let token = trimmed;
	if (trimmed.startsWith("{")) {
		const envelope = JSON.parse(trimmed);
		const candidate = envelope["token"] ?? envelope["accessToken"] ?? envelope["jwt"];
		if (typeof candidate !== "string" || candidate.trim() === "") throw new Error("Trae CLI token document has no token field");
		token = candidate.trim();
	}
	const segments = token.split(".");
	if (segments.length !== 3 || segments.some((segment) => segment === "")) throw new Error("Trae CLI token is not a three-part JWT");
	const payload = decodeBase64UrlJson(segments[1]);
	if (payload === void 0) throw new Error("Trae CLI token payload is not decodable JSON");
	const data = typeof payload["data"] === "object" && payload["data"] !== null && !Array.isArray(payload["data"]) ? payload["data"] : void 0;
	const userId = typeof data?.["user_id"] === "string" ? data["user_id"] : void 0;
	if (userId === void 0 || userId === "") throw new Error("Trae CLI token has no data.user_id claim");
	const exp = payload["exp"];
	const expiresAtMs = typeof exp === "number" && Number.isFinite(exp) && exp > 0 ? exp * 1e3 : void 0;
	return {
		accessToken: token,
		userId,
		...expiresAtMs === void 0 ? {} : { expiresAtMs }
	};
}
//#endregion
//#region src/paths.ts
/**
* Path resolution for plugin-owned files and local Trae installation discovery.
*
* @module dsh-trae-connect/paths
*/
const TRAE_DATA_DIR_NAME = ".dsh-trae-connect";
const TRAE_STATE_DIR_NAME = "state";
const TRAE_DATA_DIR_ENV = "DSH_TRAE_DATA_DIR";
const PROFILES_DIR_NAME = "profiles";
const PLUGIN_PACKAGE_NAME = "dsh-trae-connect";
function pluginPackageRoot() {
	try {
		return dirname(dirname(fileURLToPath(import.meta.url)));
	} catch {
		return;
	}
}
function profileDeclaresPlugin(profileDir) {
	try {
		const manifest = JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8"));
		return typeof manifest.dependencies?.[PLUGIN_PACKAGE_NAME] === "string" || typeof manifest.devDependencies?.[PLUGIN_PACKAGE_NAME] === "string";
	} catch {
		return false;
	}
}
function profileLinksToThisPackage(profileDir) {
	const own = pluginPackageRoot();
	if (own === void 0) return false;
	try {
		return realpathSync(join(profileDir, "node_modules", PLUGIN_PACKAGE_NAME)) === realpathSync(own);
	} catch {
		return false;
	}
}
function discoverProfileDir() {
	const dshHome = resolveDshHome();
	const profilesDir = join(dshHome, PROFILES_DIR_NAME);
	let entries;
	try {
		entries = readdirSync(profilesDir);
	} catch {
		return;
	}
	const declared = [];
	for (const entry of entries) {
		const candidate = join(profilesDir, entry);
		if (profileDeclaresPlugin(candidate)) declared.push(candidate);
	}
	if (declared.length === 1) return declared[0];
	if (declared.length > 1) {
		const linked = declared.find((dir) => profileLinksToThisPackage(dir));
		if (linked !== void 0) return linked;
		return declared[0];
	}
}
function traePluginDataDir() {
	const env = process.env[TRAE_DATA_DIR_ENV];
	if (typeof env === "string" && env.trim() !== "") return env.trim();
	const profileDir = discoverProfileDir();
	if (profileDir !== void 0) return join(profileDir, TRAE_DATA_DIR_NAME);
	return join(resolveDshHome(), TRAE_DATA_DIR_NAME);
}
function traeStateDir() {
	return join(traePluginDataDir(), TRAE_STATE_DIR_NAME);
}
const APP_NAMES = {
	cn: "Trae CN",
	sg: "Trae",
	solo: "TRAE SOLO CN",
	"solo-sg": "TRAE SOLO"
};
const LINUX_APP_NAMES = {
	cn: [
		"trae-cn",
		"Trae CN",
		"trae",
		"Trae"
	],
	sg: ["trae", "Trae"],
	solo: ["trae-solo-cn", "TRAE SOLO CN"],
	"solo-sg": ["trae-solo", "TRAE SOLO"]
};
const CLI_HOME_NAMES = [".trae-cn", ".trae"];
const TRAE_CLI_TOKEN_FILENAME = "trae-jwt-token";
function traeStorageCandidates(platform = process.platform, home = homedir(), env = process.env) {
	const result = [];
	for (const edition of [
		"cn",
		"sg",
		"solo",
		"solo-sg"
	]) {
		const app = APP_NAMES[edition];
		const region = edition === "sg" || edition === "solo-sg" ? "ai" : "cn";
		let roots;
		let appNames;
		if (platform === "darwin") {
			roots = [join(home, "Library", "Application Support")];
			appNames = [app];
		} else if (platform === "win32") {
			roots = [env.APPDATA, join(home, "AppData", "Roaming")].filter((value, index, all) => typeof value === "string" && value !== "" && all.indexOf(value) === index);
			appNames = [app];
		} else if (platform === "linux") {
			roots = [env.XDG_CONFIG_HOME || join(home, ".config")];
			appNames = LINUX_APP_NAMES[edition];
		} else {
			roots = [];
			appNames = [app];
		}
		for (const root of roots) for (const appName of appNames) result.push({
			edition,
			path: join(root, appName, "User", "globalStorage", "storage.json"),
			source: "desktop",
			region
		});
	}
	return [...result, ...traeCliCandidates(platform, home, env)];
}
function traeCliCandidates(platform = process.platform, home = homedir(), env = process.env) {
	const roots = [];
	if (platform === "win32") {
		for (const value of [env.USERPROFILE, home]) if (typeof value === "string" && value !== "" && !roots.includes(value)) roots.push(value);
	} else roots.push(home);
	const result = [];
	for (const root of roots) for (const name of CLI_HOME_NAMES) {
		const edition = name === ".trae-cn" ? "cn" : "sg";
		const region = edition === "sg" ? "ai" : "cn";
		result.push({
			edition,
			path: join(root, name, TRAE_CLI_TOKEN_FILENAME),
			source: "cli",
			region
		});
	}
	return result;
}
//#endregion
//#region src/auth.ts
/**
* Trae credential store, managing persistent tokens for CN and Global variants.
*
* @module dsh-trae-connect/auth
*/
const OWN_VERSION = 1;
const CLI_DEFAULT_HOST = "https://api.trae.cn";
function optionalString(value) {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : void 0;
}
function timeToMs(value) {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) return value > 0xe8d4a51000 ? value : value * 1e3;
	if (typeof value !== "string" || value.trim() === "") return void 0;
	const numeric = Number(value);
	if (Number.isFinite(numeric) && numeric > 0) return numeric > 0xe8d4a51000 ? numeric : numeric * 1e3;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : void 0;
}
function parseTraeAuth(raw, edition = "cn", source = "dsh") {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
	const value = raw;
	const accessToken = optionalString(value["token"]) ?? optionalString(value["accessToken"]);
	if (accessToken === void 0) return void 0;
	const expiresAtMs = timeToMs(value["expiredAt"] ?? value["expiresAt"]) ?? 0;
	const refreshExpiresAtMs = timeToMs(value["refreshExpiredAt"] ?? value["refreshExpiresAt"]);
	const refreshToken = optionalString(value["refreshToken"]);
	const rawUserRegion = value["userRegion"];
	const userRegion = typeof rawUserRegion === "object" && rawUserRegion !== null ? optionalString(rawUserRegion["region"]) : optionalString(rawUserRegion);
	const accountName = optionalString((typeof value["account"] === "object" && value["account"] !== null && !Array.isArray(value["account"]) ? value["account"] : void 0)?.["username"] ?? value["accountName"]);
	const defaultHost = edition === "sg" || edition === "solo-sg" ? "https://coresg-normal.trae.ai" : "https://api.trae.cn";
	const host = optionalString(value["host"]) ?? defaultHost;
	return {
		accessToken,
		...refreshToken === void 0 ? {} : { refreshToken },
		userId: optionalString(value["userId"]) ?? "",
		...accountName === void 0 ? {} : { accountName },
		host,
		...userRegion === void 0 ? {} : { userRegion },
		expiresAtMs,
		...refreshExpiresAtMs === void 0 ? {} : { refreshExpiresAtMs },
		edition,
		source
	};
}
function parseTraeDocument(text) {
	const trimmed = text.trim();
	if (trimmed === "") return void 0;
	if (!trimmed.startsWith("{")) try {
		const claims = parseTraeCliToken(trimmed);
		return {
			accessToken: claims.accessToken,
			userId: claims.userId,
			host: CLI_DEFAULT_HOST,
			expiresAtMs: claims.expiresAtMs ?? 0,
			edition: "cn",
			source: "cli"
		};
	} catch {
		return;
	}
	try {
		const document = JSON.parse(trimmed);
		if (document["version"] === OWN_VERSION && typeof document["credential"] === "object" && document["credential"] !== null) {
			const cred = document["credential"];
			return parseTraeAuth(cred, cred["edition"] ?? "cn", "dsh");
		}
		if (typeof document["token"] === "string" || typeof document["accessToken"] === "string") return parseTraeAuth(document, "cn", "dsh");
	} catch {
		return;
	}
}
var TraeCredentialStore = class {
	variant;
	refresh;
	refreshMarginMs;
	inflight;
	constructor(options) {
		this.variant = options.variant;
		this.refresh = options.refresh;
		this.refreshMarginMs = options.refreshMarginMs ?? 3e5;
	}
	ownAuthPath() {
		return join(traePluginDataDir(), this.variant.ownFilename);
	}
	legacyAuthPaths() {
		const dshHome = resolveDshHome();
		return [
			join(dshHome, this.variant.ownFilename),
			join(dshHome, `.trae-auth.${this.variant.region}.json`),
			join(dshHome, ".trae-auth.json")
		];
	}
	async read() {
		const candidates = [this.ownAuthPath(), ...this.legacyAuthPaths()];
		for (const path of candidates) try {
			const cred = parseTraeDocument(await readFile(path, "utf8"));
			if (cred !== void 0) {
				if ((cred.edition === "sg" || cred.edition === "solo-sg" ? "ai" : "cn") === this.variant.region) return cred;
			}
		} catch {}
	}
	async write(credential) {
		const filePath = this.ownAuthPath();
		const content = JSON.stringify({
			version: OWN_VERSION,
			updatedAt: Date.now(),
			credential
		}, null, 2);
		await withFileLock(filePath, async () => {
			await writeFileAtomic(filePath, content, {
				mode: 384,
				dirMode: 448
			});
		});
	}
	async remove() {
		const targets = [this.ownAuthPath(), ...this.legacyAuthPaths()];
		for (const target of targets) try {
			await rm(target, { force: true });
		} catch {}
	}
	async get() {
		if (this.inflight !== void 0) return this.inflight;
		this.inflight = this.resolveCurrent();
		try {
			return await this.inflight;
		} finally {
			this.inflight = void 0;
		}
	}
	async resolveCurrent() {
		let credential = await this.read();
		if (credential === void 0) return void 0;
		const now = Date.now();
		if (credential.refreshToken !== void 0 && credential.expiresAtMs > 0 && credential.expiresAtMs - now < this.refreshMarginMs && this.refresh !== void 0) try {
			const refreshed = await this.refresh(credential);
			credential = {
				...credential,
				accessToken: refreshed.accessToken,
				...refreshed.refreshToken !== void 0 ? { refreshToken: refreshed.refreshToken } : {},
				expiresAtMs: refreshed.expiresAtMs
			};
			await this.write(credential);
		} catch (err) {
			if (credential.expiresAtMs <= now) return;
		}
		return credential;
	}
	async status() {
		try {
			const cred = await this.read();
			if (cred === void 0) return { status: "unconfigured" };
			const now = Date.now();
			if (cred.expiresAtMs > 0 && cred.expiresAtMs <= now && cred.refreshToken === void 0) return {
				status: "expired",
				credential: cred,
				expiresAtMs: cred.expiresAtMs
			};
			return {
				status: "valid",
				credential: cred,
				expiresAtMs: cred.expiresAtMs
			};
		} catch (err) {
			return {
				status: "unconfigured",
				error: err instanceof Error ? err.message : String(err)
			};
		}
	}
};
//#endregion
//#region src/version.ts
/**
* Resolved npm package version, injected at build time by tsdown/vitest.
* Falls back to a development marker when running unbundled from source.
*/
const TRAE_CONNECT_VERSION = "0.1.0";
//#endregion
//#region src/host-heartbeat.ts
/**
* Host process heartbeat file for health reporting via CLI.
*
* @module dsh-trae-connect/host-heartbeat
*/
const TRAE_HOST_HEARTBEAT_FILENAME = ".trae-host-heartbeat.json";
const HEARTBEAT_FORMAT_VERSION = 1;
function traeHostHeartbeatPath() {
	return join(traeStateDir(), TRAE_HOST_HEARTBEAT_FILENAME);
}
async function writeHostHeartbeat() {
	const document = {
		version: HEARTBEAT_FORMAT_VERSION,
		package: "dsh-trae-connect",
		pluginVersion: TRAE_CONNECT_VERSION,
		registeredAt: Date.now(),
		pid: process.pid
	};
	try {
		const filePath = traeHostHeartbeatPath();
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, JSON.stringify(document, null, 2), "utf8");
	} catch {}
}
async function clearHostHeartbeat() {
	try {
		await rm(traeHostHeartbeatPath(), { force: true });
	} catch {}
}
function isHeartbeatProcessAlive(heartbeat) {
	try {
		process.kill(heartbeat.pid, 0);
		return true;
	} catch {
		return false;
	}
}
async function readHostHeartbeat() {
	try {
		const raw = await readFile(traeHostHeartbeatPath(), "utf8");
		const parsed = JSON.parse(raw);
		if (parsed.version === HEARTBEAT_FORMAT_VERSION && parsed.package === "dsh-trae-connect" && typeof parsed.registeredAt === "number" && typeof parsed.pid === "number") return {
			version: HEARTBEAT_FORMAT_VERSION,
			package: "dsh-trae-connect",
			pluginVersion: typeof parsed.pluginVersion === "string" ? parsed.pluginVersion : "unknown",
			registeredAt: parsed.registeredAt,
			pid: parsed.pid
		};
	} catch {}
}
//#endregion
//#region src/device.ts
/**
* Device identity, hardware metadata, and ECDSA key pair management for Trae OAuth.
*
* Implements official Trae device binding requirements:
* - ECDSA P-256 (prime256v1) key pair generation & persistent storage.
* - Hardware and OS metadata collection (CPU, model, brand, OS version).
* - DeviceProof signature generation for token refresh (_Te contract).
*
* @module dsh-trae-connect/device
*/
const DEVICE_PROFILE_FILE = "device-profile.json";
/**
* Generate a new ECDSA P-256 (prime256v1) key pair as SPKI / PKCS8 PEM strings.
*/
function generateDeviceKeyPair() {
	const { privateKey, publicKey } = generateKeyPairSync("ec", {
		namedCurve: "P-256",
		publicKeyEncoding: {
			type: "spki",
			format: "pem"
		},
		privateKeyEncoding: {
			type: "pkcs8",
			format: "pem"
		}
	});
	return {
		publicKeyPEM: publicKey,
		privateKeyPEM: privateKey
	};
}
/**
* Generate stable machineId and deviceId if none stored.
*/
function createDefaultIdentifiers() {
	try {
		const raw = `${hostname()}-${userInfo().username}-${process.platform}`;
		const machineId = createHash("sha256").update(raw).digest("hex");
		let num = "";
		for (let i = 0; i < 16; i++) num += (machineId.charCodeAt(i) % 10).toString();
		return {
			machineId,
			deviceId: num
		};
	} catch {
		const rand = randomBytes(16).toString("hex");
		return {
			machineId: createHash("sha256").update(rand).digest("hex"),
			deviceId: "3493610113527706"
		};
	}
}
/**
* Collect device hardware and operating system metadata.
*/
function collectHardwareInfo() {
	const platform = process.platform;
	let deviceModel = "PC";
	let deviceCPU = "Unknown CPU";
	let deviceBrand = "Generic";
	const osInfo = platform === "darwin" ? "mac" : platform === "win32" ? "windows" : "linux";
	let osVersion = `${osInfo} ${release()}`;
	let deviceName = hostname();
	try {
		const user = userInfo().username;
		if (user.trim() !== "") deviceName = `${user}的电脑`;
	} catch {}
	if (platform === "darwin") {
		deviceBrand = "Apple Inc.";
		try {
			deviceModel = execSync("sysctl -n hw.model", {
				encoding: "utf8",
				timeout: 2e3
			}).trim();
		} catch {
			deviceModel = "Mac";
		}
		try {
			deviceCPU = execSync("sysctl -n machdep.cpu.brand_string", {
				encoding: "utf8",
				timeout: 2e3
			}).trim();
		} catch {
			deviceCPU = "Apple";
		}
		try {
			osVersion = `macOS ${execSync("sw_vers -productVersion", {
				encoding: "utf8",
				timeout: 2e3
			}).trim()}`;
		} catch {
			osVersion = `macOS ${release()}`;
		}
	} else if (platform === "win32") {
		deviceBrand = "PC";
		deviceModel = "Windows PC";
		osVersion = `Windows ${release()}`;
	} else {
		deviceBrand = "Linux";
		deviceModel = "Linux PC";
	}
	return {
		deviceModel,
		deviceCPU,
		deviceBrand,
		osInfo,
		osVersion,
		deviceName
	};
}
/**
* Load or initialize the persistent device profile containing machine identity and ECDSA key pair.
*/
async function getOrCreateDeviceProfile() {
	const filePath = join(traePluginDataDir(), DEVICE_PROFILE_FILE);
	if (existsSync(filePath)) try {
		const raw = readFileSync(filePath, "utf8");
		const data = JSON.parse(raw);
		if (typeof data.machineId === "string" && typeof data.deviceId === "string" && typeof data.keyPair?.publicKeyPEM === "string" && typeof data.keyPair?.privateKeyPEM === "string") return {
			machineId: data.machineId,
			deviceId: data.deviceId,
			keyPair: data.keyPair
		};
		if (typeof data.machineId === "string" && typeof data.deviceId === "string" && typeof data.publicKeyPEM === "string" && typeof data.privateKeyPEM === "string") return {
			machineId: data.machineId,
			deviceId: data.deviceId,
			keyPair: {
				publicKeyPEM: data.publicKeyPEM,
				privateKeyPEM: data.privateKeyPEM
			}
		};
	} catch {}
	const { machineId, deviceId } = createDefaultIdentifiers();
	const profile = {
		machineId,
		deviceId,
		keyPair: generateDeviceKeyPair()
	};
	try {
		await withFileLock(filePath, async () => {
			await writeFileAtomic(filePath, JSON.stringify(profile, null, 2), {
				mode: 384,
				dirMode: 448
			});
		});
	} catch (err) {
		console.error("Failed to save Trae device profile:", err);
	}
	return profile;
}
/**
* Construct the official Trae DeviceInfo payload strictly conforming to official contract.
*/
async function buildTraeDeviceInfo(profile) {
	const activeProfile = profile ?? await getOrCreateDeviceProfile();
	const hardware = collectHardwareInfo();
	return {
		profile: activeProfile,
		deviceInfo: {
			DeviceID: activeProfile.deviceId,
			MachineID: activeProfile.machineId,
			PlatformCode: "SOLO_PC",
			DeviceType: "PC",
			DeviceName: hardware.deviceName,
			DeviceModel: hardware.deviceModel,
			ClientVersion: "0.1.66",
			DevicePublicKey: activeProfile.keyPair.publicKeyPEM,
			DeviceBrand: hardware.deviceBrand,
			DeviceCPU: hardware.deviceCPU,
			OSInfo: hardware.osInfo,
			OSVersion: hardware.osVersion
		}
	};
}
/**
* Official DeviceProof signature for refresh token verification (_Te contract).
*/
function signDeviceProof(method, path, clientId, refreshToken, privateKeyPEM) {
	const timestamp = Math.floor(Date.now() / 1e3);
	const nonce = randomBytes(16).toString("hex");
	const message = [
		method,
		path,
		clientId,
		refreshToken,
		String(timestamp),
		nonce
	].join("\n");
	return {
		timestamp,
		nonce,
		signature: sign("sha256", Buffer.from(message), privateKeyPEM).toString("base64")
	};
}
/**
* 读取本地安装的 Trae 桌面端真实设备 ID。
*/
function getTraeLocalDeviceId() {
	const home = process.env["HOME"] || "";
	const candidates = [
		join(home, "Library/Application Support/TRAE SOLO CN/ModularData/ckg_server/local_env.json"),
		join(home, "Library/Application Support/Trae/ModularData/ckg_server/local_env.json"),
		join(home, "Library/Application Support/TRAE CN/ModularData/ckg_server/local_env.json"),
		join(process.env["APPDATA"] || "", "TRAE SOLO CN/ModularData/ckg_server/local_env.json"),
		join(process.env["APPDATA"] || "", "Trae/ModularData/ckg_server/local_env.json"),
		join(home, ".config/TRAE SOLO CN/ModularData/ckg_server/local_env.json"),
		join(home, ".config/Trae/ModularData/ckg_server/local_env.json")
	];
	for (const localEnvPath of candidates) try {
		if (existsSync(localEnvPath)) {
			const raw = JSON.parse(readFileSync(localEnvPath, "utf8"));
			if (typeof raw.device_id === "string" && raw.device_id.trim() !== "") return raw.device_id.trim();
		}
	} catch {}
	return createDefaultIdentifiers().deviceId || "3493610113527706";
}
/**
* 读取本地安装的 Trae 桌面端真实版本号。
*/
function getTraeClientAppVersion() {
	const home = process.env["HOME"] || "";
	const candidates = [
		"/Applications/TRAE SOLO CN.app/Contents/Resources/app/product.json",
		"/Applications/Trae.app/Contents/Resources/app/product.json",
		"/Applications/Trae CN.app/Contents/Resources/app/product.json",
		join(home, "Applications/TRAE SOLO CN.app/Contents/Resources/app/product.json"),
		join(home, "Applications/Trae.app/Contents/Resources/app/product.json"),
		join(process.env["LOCALAPPDATA"] || "", "Programs/TRAE SOLO CN/resources/app/product.json"),
		join(process.env["LOCALAPPDATA"] || "", "Programs/Trae/resources/app/product.json"),
		"/opt/trae-solo-cn/resources/app/product.json",
		"/opt/trae/resources/app/product.json"
	];
	for (const productPath of candidates) try {
		if (existsSync(productPath)) {
			const raw = JSON.parse(readFileSync(productPath, "utf8"));
			if (typeof raw.appVersion === "string" && raw.appVersion.trim() !== "") return raw.appVersion.trim();
		}
	} catch {}
	return "0.1.69";
}
/**
* 构造完全符合官方 Trae 桌面端底层的原生请求头（严格对齐官方 clientParams）。
*/
function buildTraeClientHeaders(accessToken) {
	const deviceId = getTraeLocalDeviceId();
	const appVersion = getTraeClientAppVersion();
	const platform = process.platform;
	const osType = platform === "darwin" ? "darwin" : platform === "win32" ? "windows" : "linux";
	let osVersion = "15.3.1";
	if (platform === "darwin") try {
		osVersion = execSync("sw_vers -productVersion", {
			encoding: "utf8",
			timeout: 1e3
		}).trim();
	} catch {
		osVersion = release();
	}
	else if (platform === "win32") osVersion = release();
	else osVersion = release();
	return {
		"Content-Type": "application/json",
		"Authorization": `Cloud-IDE-JWT ${accessToken}`,
		"x-device-id": deviceId,
		"x-device-brand": platform === "darwin" ? "Mac" : "PC",
		"x-device-type": osType,
		"x-os-version": osVersion,
		"x-app-version": appVersion,
		"User-Agent": `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TRAE/${appVersion} Chrome/130.0.6723.137 Electron/33.2.1 Safari/537.36`
	};
}
//#endregion
//#region src/login.ts
/**
* Sign-in client for Trae: OAuth PKCE browser authorization & credential import.
*
* Implements the official Trae OAuth 2.0 PKCE flow with a loopback callback server.
* This completely decouples the plugin from any local Trae desktop app or CLI installation.
*
* @module dsh-trae-connect/login
*/
const CLIENT_ID = "en1oxy7wnw8j9n";
const ATTEMPT_TIMEOUT_MS = 3e5;
const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Trae 授权成功</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #0f141c;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 32px 40px;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
      max-width: 440px;
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
      margin-bottom: 16px;
    }
    h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 600; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
    button {
      background: #3b82f6;
      color: #fff;
      border: none;
      padding: 8px 22px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      font-weight: 500;
    }
    button:hover { background: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h2>授权登录成功</h2>
    <p>您已成功授权 Trae 账号！凭据已自动同步，您可以关闭此浏览器标签页并返回 DSH Desktop 继续使用。</p>
    <button onclick="window.close()">关闭此标签页</button>
  </div>
</body>
</html>`;
var TraeLoginClient = class {
	variant;
	store;
	fetchImpl;
	attempts = /* @__PURE__ */ new Map();
	constructor(variant, store, fetchImpl = fetch) {
		this.variant = variant;
		this.store = store;
		this.fetchImpl = fetchImpl;
	}
	/**
	* Start an OAuth PKCE sign-in attempt.
	* Spawns a temporary loopback HTTP server to catch browser authorization callback.
	*/
	async begin() {
		const traceId = randomUUID();
		const codeVerifier = randomBytes(48).toString("base64url");
		const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
		const { profile, deviceInfo } = await buildTraeDeviceInfo();
		let serverInstance;
		let timer;
		const cleanup = () => {
			if (timer !== void 0) {
				clearTimeout(timer);
				timer = void 0;
			}
			if (serverInstance !== void 0) {
				try {
					serverInstance.close();
				} catch {}
				serverInstance = void 0;
			}
		};
		const attempt = {
			state: traceId,
			authUrl: "",
			status: "pending",
			cleanup
		};
		timer = setTimeout(() => {
			if (attempt.status === "pending") {
				attempt.status = "failed";
				attempt.error = "登录授权超时（5分钟未完成）";
				attempt.cleanup();
			}
		}, ATTEMPT_TIMEOUT_MS);
		const port = await new Promise((resolve, reject) => {
			const s = createServer((req, res) => {
				res.setHeader("Access-Control-Allow-Origin", "*");
				res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
				res.setHeader("Access-Control-Allow-Headers", "*");
				if (req.method === "OPTIONS") {
					res.writeHead(204);
					res.end();
					return;
				}
				const parsedUrl = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
				if (parsedUrl.pathname === "/authorize") {
					this.handleAuthorizeCallback(req, parsedUrl, codeVerifier, deviceInfo, attempt, res);
					return;
				}
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("Not Found");
			});
			s.on("error", reject);
			s.listen(0, "127.0.0.1", () => {
				const addr = s.address();
				serverInstance = s;
				resolve(addr.port);
			});
		});
		const authHost = this.variant.region === "ai" ? "https://www.trae.ai" : "https://www.trae.cn";
		const callbackUrl = `http://127.0.0.1:${port}/authorize`;
		const authUrl = `${authHost}/authorization?${new URLSearchParams({
			login_version: "1",
			auth_from: "solo",
			login_channel: "native_ide",
			plugin_version: "local",
			auth_type: "local",
			client_id: CLIENT_ID,
			redirect: "0",
			login_trace_id: traceId,
			auth_callback_url: callbackUrl,
			machine_id: profile.machineId,
			device_id: profile.deviceId,
			x_device_id: profile.deviceId,
			x_machine_id: profile.machineId,
			x_device_brand: deviceInfo.DeviceModel,
			x_device_type: deviceInfo.OSInfo,
			x_os_version: deviceInfo.OSVersion,
			x_app_version: "0.1.66",
			x_app_type: "stable",
			code_challenge: codeChallenge,
			code_challenge_method: "S256",
			hide_saas_login: "true",
			channel_name: "common"
		}).toString()}`;
		attempt.authUrl = authUrl;
		this.attempts.set(traceId, attempt);
		return {
			state: traceId,
			authUrl
		};
	}
	/**
	* Handle the loopback callback from browser after user authorization.
	*/
	async handleAuthorizeCallback(req, url, codeVerifier, deviceInfo, attempt, res) {
		try {
			res.writeHead(200, {
				"Content-Type": "text/html; charset=utf-8",
				"Access-Control-Allow-Origin": "*"
			});
			res.end(SUCCESS_HTML);
			let authCode;
			let userInfoObj;
			const authCodeInfoParam = url.searchParams.get("authCodeInfo");
			const userInfoParam = url.searchParams.get("userInfo");
			if (authCodeInfoParam !== null) try {
				const parsed = JSON.parse(authCodeInfoParam);
				if (typeof parsed["AuthCode"] === "string") authCode = parsed["AuthCode"];
			} catch {}
			if (authCode === void 0) authCode = url.searchParams.get("AuthCode") ?? url.searchParams.get("auth_code") ?? url.searchParams.get("code") ?? void 0;
			if (userInfoParam !== null) try {
				userInfoObj = JSON.parse(userInfoParam);
			} catch {}
			if (req.method === "POST") {
				const bodyChunks = [];
				for await (const chunk of req) bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				const bodyText = Buffer.concat(bodyChunks).toString("utf8").trim();
				if (bodyText !== "") try {
					const bodyObj = JSON.parse(bodyText);
					if (authCode === void 0) {
						if (typeof bodyObj["authCodeInfo"] === "string") {
							const p = JSON.parse(bodyObj["authCodeInfo"]);
							if (typeof p["AuthCode"] === "string") authCode = p["AuthCode"];
						} else if (typeof bodyObj["AuthCode"] === "string") authCode = bodyObj["AuthCode"];
					}
					if (userInfoObj === void 0 && typeof bodyObj["userInfo"] === "string") userInfoObj = JSON.parse(bodyObj["userInfo"]);
				} catch {}
			}
			if (authCode === void 0 || authCode === "") {
				attempt.status = "failed";
				attempt.error = "回调未携带有效的授权码 (AuthCode)";
				attempt.cleanup();
				return;
			}
			await this.exchangeToken(authCode, codeVerifier, deviceInfo, userInfoObj, attempt);
		} catch (err) {
			attempt.status = "failed";
			attempt.error = err instanceof Error ? err.message : String(err);
			attempt.cleanup();
		}
	}
	/**
	* Request /ExchangeToken to obtain access and refresh tokens.
	*/
	async exchangeToken(authCode, codeVerifier, deviceInfo, userInfoObj, attempt) {
		const isGlobal = this.variant.region === "ai";
		const endpoint = isGlobal ? "https://growsg-normal.trae.ai/trae/api/v3/oauth/ExchangeToken" : "https://api.trae.cn/trae/api/v3/oauth/ExchangeToken";
		const payload = {
			ClientID: CLIENT_ID,
			AuthCode: authCode,
			CodeVerifier: codeVerifier,
			DeviceInfo: deviceInfo,
			IDEVersion: "0.1.66"
		};
		const resp = await this.fetchImpl(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-cloudide-token": "",
				"User-Agent": "Trae/0.1.66"
			},
			body: JSON.stringify(payload)
		});
		if (!resp.ok) {
			let errorDetail = "";
			try {
				const errorText = await resp.text();
				try {
					const parsed = JSON.parse(errorText);
					const code = parsed.ResponseMetadata?.Error?.Code ?? "";
					const msg = parsed.ResponseMetadata?.Error?.Message ?? parsed.message ?? "";
					errorDetail = code !== "" || msg !== "" ? ` [${code}] ${msg}` : ` ${errorText}`;
				} catch {
					errorDetail = errorText !== "" ? ` ${errorText}` : "";
				}
			} catch {}
			throw new Error(`Trae OAuth 换取令牌失败 (HTTP ${resp.status})${errorDetail}`);
		}
		const result = (await resp.json()).Result;
		if (result?.Token === void 0 || result.Token === "") throw new Error("Trae OAuth 未返回有效的 Token");
		const screenName = typeof userInfoObj?.["ScreenName"] === "string" ? userInfoObj["ScreenName"] : void 0;
		const userId = typeof userInfoObj?.["UserID"] === "string" ? userInfoObj["UserID"] : "";
		const avatarUrl = typeof userInfoObj?.["AvatarUrl"] === "string" ? userInfoObj["AvatarUrl"] : void 0;
		const credential = {
			accessToken: result.Token,
			...result.RefreshToken !== void 0 && result.RefreshToken !== "" ? { refreshToken: result.RefreshToken } : {},
			userId,
			...screenName !== void 0 ? { accountName: screenName } : {},
			...avatarUrl !== void 0 ? { avatarUrl } : {},
			...typeof result.RefreshExpireAt === "number" ? { refreshExpiresAtMs: result.RefreshExpireAt } : {},
			host: isGlobal ? "https://coresg-normal.trae.ai" : "https://api.trae.cn",
			expiresAtMs: typeof result.TokenExpireAt === "number" ? result.TokenExpireAt : 0,
			edition: isGlobal ? "sg" : "cn",
			source: "dsh"
		};
		await this.store.write(credential);
		attempt.status = "complete";
		if (screenName !== void 0) attempt.accountName = screenName;
		if (userId !== "") attempt.userId = userId;
		setTimeout(() => {
			attempt.cleanup();
		}, 1e3);
	}
	/**
	* Poll the status of an ongoing sign-in attempt.
	*/
	async poll(state) {
		const attempt = this.attempts.get(state);
		if (attempt === void 0) return {
			status: "failed",
			message: "未找到该登录会话或已过期"
		};
		if (attempt.status === "complete") {
			this.attempts.delete(state);
			return {
				status: "complete",
				...attempt.accountName !== void 0 ? { accountName: attempt.accountName } : {},
				...attempt.userId !== void 0 ? { userId: attempt.userId } : {}
			};
		}
		if (attempt.status === "failed") {
			this.attempts.delete(state);
			return {
				status: "failed",
				message: attempt.error ?? "登录失败"
			};
		}
		return { status: "pending" };
	}
	/**
	* Automatically detect and adopt a sign-in from local Trae desktop app or CLI (fallback).
	*/
	async detectLocal() {
		const matching = traeStorageCandidates().filter((c) => c.region === this.variant.region);
		for (const candidate of matching) try {
			const text = await readFile(candidate.path, "utf8");
			if (candidate.source === "desktop") {
				const cred = parseTraeAuth(parseTraeStorageDocument(text), candidate.edition, "desktop");
				if (cred !== void 0) {
					await this.store.write(cred);
					return cred;
				}
			} else if (candidate.source === "cli") {
				const claims = parseTraeCliToken(text);
				const cred = {
					accessToken: claims.accessToken,
					userId: claims.userId,
					host: this.variant.region === "ai" ? "https://coresg-normal.trae.ai" : "https://api.trae.cn",
					expiresAtMs: claims.expiresAtMs ?? 0,
					edition: candidate.edition,
					source: "cli"
				};
				await this.store.write(cred);
				return cred;
			}
		} catch {}
	}
	/**
	* Adopt a user-provided credential document or bare token.
	*/
	async importDocument(text) {
		const trimmed = text.trim();
		if (trimmed === "") throw new Error("凭据内容为空");
		let cred = parseTraeDocument(trimmed);
		if (cred === void 0 && trimmed.startsWith("{")) try {
			cred = parseTraeAuth(parseTraeStorageDocument(trimmed), this.variant.region === "ai" ? "sg" : "cn", "desktop");
		} catch {}
		if (cred === void 0 && trimmed.includes(".")) try {
			const claims = parseTraeCliToken(trimmed);
			cred = {
				accessToken: claims.accessToken,
				userId: claims.userId,
				host: this.variant.region === "ai" ? "https://coresg-normal.trae.ai" : "https://api.trae.cn",
				expiresAtMs: claims.expiresAtMs ?? 0,
				edition: this.variant.region === "ai" ? "sg" : "cn",
				source: "cli"
			};
		} catch {}
		if (cred === void 0) throw new Error("无法解析凭据：请提供有效的 Trae 凭据 JSON 文件或 JWT Token");
		const targetRegion = cred.edition === "sg" || cred.edition === "solo-sg" ? "ai" : "cn";
		if (targetRegion !== this.variant.region) throw new Error(`凭据版本不匹配：当前为 ${this.variant.displayName}，而该凭证属于 ${targetRegion === "ai" ? "国际版" : "国内版"}`);
		await this.store.write(cred);
		return cred;
	}
	async logout() {
		await this.store.remove();
	}
};
//#endregion
//#region src/identity.ts
function fallbackTraeIdentity(edition = "cn") {
	const seed = `${homedir()}:${process.platform}:${edition}`;
	const hash = createHash("sha256").update(seed).digest("hex");
	return {
		edition,
		machineId: hash,
		deviceId: hash.slice(0, 32),
		appVersion: "1.0.8357",
		buildVersion: "20260716",
		deviceBrand: process.platform === "darwin" ? "Apple" : "PC",
		deviceCpu: process.arch,
		osVersion: release(),
		platform: process.platform
	};
}
function identityHeaders(identity) {
	return {
		"x-machine-id": identity.machineId,
		"x-device-id": identity.deviceId,
		"x-client-platform": identity.platform === "darwin" ? "darwin" : identity.platform === "win32" ? "win32" : "linux",
		"x-device-brand": identity.deviceBrand ?? (identity.platform === "darwin" ? "Apple" : "PC"),
		"x-device-model": identity.deviceBrand ?? (identity.platform === "darwin" ? "Apple" : "PC"),
		"x-os-name": identity.platform === "darwin" ? "darwin" : identity.platform === "win32" ? "win32" : "linux",
		"x-os-version": identity.osVersion ?? release()
	};
}
//#endregion
//#region src/protocol.ts
const TRAE_SOLO_CHAT_PATH = "/api/agent/v3/llm_utils_chat";
const TRAE_SOLO_MODELS_PATH = "/api/ide/v1/get_detail_param";
function traeEndpoint(baseUrl, path) {
	return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
const TRAE_VERSION_CODE_FALLBACK = "20260716";
function normalizeTraeVersionCode(buildVersion) {
	if (buildVersion === void 0 || buildVersion.trim() === "") return TRAE_VERSION_CODE_FALLBACK;
	const trimmed = buildVersion.trim();
	if (!/^\d+$/.test(trimmed)) return TRAE_VERSION_CODE_FALLBACK;
	if (Number.parseInt(trimmed, 10) < 2e7) return TRAE_VERSION_CODE_FALLBACK;
	return trimmed;
}
/**
* 构建完整的 Trae 官方请求头。
* 必须包含 x-app-id、X-Ide-Token、x-plugin-channel 及版本号、Trace ID 等，
* 否则官方微服务网关在参数绑定时会直接报错 4001（expr_path=app_id）。
*/
function buildTraeHeaders(credential, identity, options = {}) {
	const requestId = options.requestId ?? randomUUID();
	const traceId = requestId.replaceAll("-", "").slice(0, 32);
	const profile = options.profile ?? "agent-task";
	const appVersion = identity.appVersion && identity.appVersion !== "1.0.0" ? identity.appVersion : "1.0.8357";
	const common = {
		"Authorization": `Cloud-IDE-JWT ${credential.accessToken}`,
		"X-Ide-Token": credential.accessToken,
		"x-plugin-channel": "icube-ai",
		"User-Agent": `Trae/${appVersion}`,
		"x-app-id": options.appId ?? "6eefa01c-1036-4c7e-9ca5-d891f63bfcd8",
		...identityHeaders(identity),
		"x-app-version-code": normalizeTraeVersionCode(identity.buildVersion),
		"x-ide-version-code": normalizeTraeVersionCode(identity.buildVersion),
		"x-custom-trace-id": traceId,
		"x-flow-traceparent": `04-${traceId}-${traceId.slice(0, 16)}-01`,
		"request-traffic-type": "prod",
		"Content-Type": "application/json"
	};
	if (profile === "model-detail") return {
		...common,
		"Accept": "application/json"
	};
	return {
		...common,
		"X-Cloudide-Token": credential.accessToken,
		"x-uid": credential.userId,
		"x-request-id": requestId,
		"x-trae-request-id": requestId,
		"Accept": "text/event-stream"
	};
}
const buildTraeCnHeaders = buildTraeHeaders;
//#endregion
//#region src/reasoning.ts
const TRAE_REASONING_EFFORTS = [
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh"
];
function parseReasoningCapability(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
	const record = value;
	const supported = (Array.isArray(record["reasoning_effort_options"]) ? record["reasoning_effort_options"] : []).filter((item) => typeof item === "string" && TRAE_REASONING_EFFORTS.includes(item));
	const rawDefault = record["default_reasoning_effort"];
	const defaultEffort = typeof rawDefault === "string" && supported.includes(rawDefault) ? rawDefault : void 0;
	if (supported.length === 0 && defaultEffort === void 0) return void 0;
	return {
		supported,
		...defaultEffort === void 0 ? {} : { defaultEffort }
	};
}
const TRAE_DIRECTORY_FUNCTIONS = {
	cn: [
		"solo_work_remote",
		"solo_agent",
		"builder_v3",
		"code_review_summary",
		"solo_work_lite"
	],
	ai: [
		"solo_agent",
		"solo_work_remote",
		"solo_work_lite",
		"solo_agent_lite",
		"builder_v3",
		"code_review_summary"
	]
};
/**
* 组装发送给 Trae llm_utils_chat 端点的请求体。
* 精确匹配模型对应的 wireConfigName 与 wireFunction 通道，避免 4001 param is invalid 报错。
*/
function prepareSoloBody(source, optionsOrModel, functionName, region = "cn") {
	const opts = typeof optionsOrModel === "object" && optionsOrModel !== null ? optionsOrModel : {
		defaultModel: typeof optionsOrModel === "string" ? optionsOrModel : "glm-5.2",
		functionName,
		region
	};
	const effectiveRegion = opts.region ?? "cn";
	const defaultModel = opts.defaultModel ?? (effectiveRegion === "ai" ? "gpt-5.4" : "glm-5.2");
	const input = JSON.parse(source);
	let requestedModel = typeof input["model"] === "string" && input["model"].trim() !== "" ? input["model"].trim() : defaultModel;
	if (requestedModel.toLowerCase() === "auto") requestedModel = effectiveRegion === "ai" ? "gpt-5.4" : "glm-5.2";
	const entry = opts.catalogModels?.find((m) => m.id === requestedModel || m.name === requestedModel || m.wireConfigName === requestedModel);
	const wireModel = entry?.wireConfigName ?? requestedModel;
	const wireFunction = typeof input["function"] === "string" && input["function"] !== "" ? input["function"] : entry?.wireFunction ?? opts.functionName ?? (effectiveRegion === "ai" ? "solo_agent" : "solo_work_remote");
	const body = {
		...Array.isArray(input["messages"]) ? { messages: input["messages"] } : {},
		model: wireModel,
		config_name: wireModel,
		function: wireFunction,
		stream: true,
		...Array.isArray(input["tools"]) ? { tools: input["tools"] } : {}
	};
	if (typeof input["reasoning_effort"] === "string") {
		const rawEffort = input["reasoning_effort"];
		const efforts = entry?.reasoningEfforts;
		const mapped = efforts?.[rawEffort];
		if (typeof mapped === "string") body["reasoning_effort"] = mapped;
		else if (efforts !== void 0 && Object.values(efforts).includes(rawEffort)) body["reasoning_effort"] = rawEffort;
	}
	if (Array.isArray(body["messages"])) for (const raw of body["messages"]) {
		if (typeof raw !== "object" || raw === null) continue;
		const message = raw;
		if (message["role"] === "developer") message["role"] = "system";
		if (typeof message["content"] === "string") message["content"] = [{
			type: "text",
			text: message["content"]
		}];
		if (message["role"] === "assistant" && Array.isArray(message["tool_calls"])) for (const rawCall of message["tool_calls"]) {
			if (typeof rawCall !== "object" || rawCall === null) continue;
			const call = rawCall;
			if (typeof call["function"] === "object" && call["function"] !== null) {
				call["function_call"] = call["function"];
				delete call["function"];
			}
		}
		if (message["role"] === "tool") {
			if (typeof message["tool_call_id"] !== "string" || message["tool_call_id"] === "") throw new Error("Trae SOLO tool message requires tool_call_id");
		}
	}
	if (Array.isArray(body["tools"])) for (const raw of body["tools"]) {
		if (typeof raw !== "object" || raw === null) continue;
		const fn = raw["function"];
		if (typeof fn !== "object" || fn === null) continue;
		const record = fn;
		if (typeof record["parameters"] === "object" && record["parameters"] !== null) record["parameters"] = JSON.stringify(record["parameters"]);
	}
	return JSON.stringify(body);
}
var TraeSoloUpstreamClient = class {
	options;
	fetchImpl;
	constructor(options) {
		this.options = options;
		this.fetchImpl = options.fetchImpl ?? fetch;
	}
	async fetchModels(signal) {
		const [credential, identity] = await Promise.all([this.options.credential(), this.options.identity()]);
		if (credential === void 0 || credential.accessToken === "") throw new Error("Trae credential unavailable; cannot fetch wire models");
		const region = credential.edition === "sg" || credential.edition === "solo-sg" ? "ai" : "cn";
		const defaultBase = region === "ai" ? "https://coresg-normal.trae.ai" : "https://trae-api-cn.mchost.guru";
		const base = this.options.baseUrl ?? defaultBase;
		const headers = buildTraeHeaders(credential, identity, { profile: "model-detail" });
		const byId = /* @__PURE__ */ new Map();
		for (const directoryFunction of TRAE_DIRECTORY_FUNCTIONS[region]) try {
			const response = await this.fetchImpl(traeEndpoint(base, TRAE_SOLO_MODELS_PATH), {
				method: "POST",
				headers,
				body: JSON.stringify({
					function: directoryFunction,
					config_names: null,
					need_prompt: false,
					current_config_info: null,
					poly_prompt: true,
					mode_type: null,
					agent_type: null
				}),
				signal: signal ?? AbortSignal.timeout(15e3)
			});
			if (!response.ok) continue;
			const payload = await response.json();
			const list = Array.isArray(payload["config_info_list"]) ? payload["config_info_list"] : Array.isArray(payload["data"]?.["config_detail_list"]) ? payload["data"]["config_detail_list"] : [];
			for (const item of list) {
				if (typeof item !== "object" || item === null) continue;
				const config = item;
				const id = typeof config["config_name"] === "string" ? config["config_name"] : "";
				if (id === "" || byId.has(id)) continue;
				const display = typeof config["display_config"] === "object" && config["display_config"] !== null ? config["display_config"] : {};
				const name = typeof display["display_name"] === "string" && display["display_name"] !== "" ? display["display_name"] : typeof config["model"] === "string" && config["model"] !== "" ? config["model"] : id;
				const details = Array.isArray(config["model_detail_list"]) ? config["model_detail_list"] : [];
				const detail = typeof details[0] === "object" && details[0] !== null ? details[0] : {};
				const promptMaxTokens = typeof detail["prompt_max_tokens"] === "number" ? detail["prompt_max_tokens"] : void 0;
				const maxTokens = typeof detail["max_tokens"] === "number" ? detail["max_tokens"] : void 0;
				const reasoning = parseReasoningCapability({
					...config,
					...detail
				});
				byId.set(id, {
					id,
					name,
					function: directoryFunction,
					...promptMaxTokens === void 0 ? {} : { contextWindow: promptMaxTokens },
					...maxTokens === void 0 ? {} : { maxTokens },
					...reasoning === void 0 ? {} : { reasoning }
				});
			}
		} catch {}
		return Array.from(byId.values());
	}
};
//#endregion
//#region src/solo-remote.ts
function remoteDressing(region) {
	return region === "ai" ? {
		referer: "https://coresg-normal.trae.ai/",
		timezone: "Asia/Singapore",
		language: "en"
	} : {
		referer: "https://solo.trae.cn/",
		timezone: "Asia/Shanghai",
		language: "zh-cn"
	};
}
var TraeSoloRemoteCatalogClient = class {
	options;
	fetchImpl;
	baseUrl;
	constructor(options) {
		this.options = options;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.baseUrl = options.baseUrl;
	}
	async headers(credential, region) {
		const dressing = remoteDressing(region);
		return {
			"Authorization": `Cloud-IDE-JWT ${credential.accessToken}`,
			"Content-Type": "application/json",
			"x-trae-client-type": "web",
			"x-trae-user-timezone": dressing.timezone,
			"x-preferenced-language": dressing.language,
			"Referer": dressing.referer,
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
		};
	}
	async fetchModels(signal) {
		const credential = await this.options.credential();
		if (credential === void 0 || credential.accessToken === "") throw new Error("Trae credential unavailable; cannot fetch models");
		const region = credential.edition === "sg" || credential.edition === "solo-sg" ? "ai" : "cn";
		const defaultBase = region === "ai" ? "https://coresg-normal.trae.ai/api/remote/v1" : "https://solo.trae.cn/api/remote/v1";
		const base = this.baseUrl ?? defaultBase;
		const functions = region === "ai" ? "solo_agent,solo_agent_remote,solo_work_remote" : "solo_agent_remote,solo_work_remote";
		const headers = await this.headers(credential, region);
		const response = await this.fetchImpl(`${base}/models?functions=${functions}`, {
			headers,
			signal: signal ?? AbortSignal.timeout(3e4)
		});
		if (!response.ok) throw new Error(`SOLO remote models returned HTTP ${response.status}`);
		const groups = (await response.json()).data?.list ?? [];
		const seenIds = /* @__PURE__ */ new Set();
		const seenNames = /* @__PURE__ */ new Set();
		const models = [];
		for (const group of groups) for (const raw of group.models ?? []) {
			const model = parseTraeRemoteModel(raw);
			if (model === void 0) continue;
			const idKey = model.id.trim().toLowerCase();
			const nameKey = model.name.trim().toLowerCase();
			if (seenIds.has(idKey) || seenNames.has(nameKey)) continue;
			seenIds.add(idKey);
			seenNames.add(nameKey);
			models.push(model);
		}
		if (models.length === 0) throw new Error("SOLO remote models response contained no models");
		return models;
	}
};
//#endregion
//#region src/usage.ts
function asNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function parseUsageSnapshot(payload) {
	const summaryRaw = payload["usage_summary"];
	const summary = {
		totalAmount: asNumber(summaryRaw?.["total_amount"]) ?? 0,
		consumedAmount: asNumber(summaryRaw?.["consumed_amount"]) ?? 0,
		consumptionRatio: asNumber(summaryRaw?.["consumption_ratio"]) ?? 0
	};
	const trial = payload["trial_status"];
	const packs = [];
	const rawPacks = Array.isArray(payload["user_entitlement_pack_list"]) ? payload["user_entitlement_pack_list"] : [];
	for (const raw of rawPacks) {
		if (typeof raw !== "object" || raw === null) continue;
		const pack = raw;
		const base = pack["entitlement_base_info"];
		const quota = base?.["quota"];
		const usage = pack["usage"];
		const packageQuota = ((base?.["product_extra"])?.["package_extra"])?.["quota"];
		const creditsLimit = asNumber(packageQuota?.["credits_limit"]) ?? asNumber(quota?.["credits_limit"]);
		const consumedCredits = asNumber(usage?.["credits_amount"]);
		const availableEndpoint = asNumber(base?.["available_endpoint"]);
		packs.push({
			displayDesc: typeof pack["display_desc"] === "string" ? pack["display_desc"] : "",
			entitlementId: typeof base?.["entitlement_id"] === "string" ? base["entitlement_id"] : "",
			endTimeMs: asNumber(base?.["end_time"]) ?? 0,
			currency: asNumber(base?.["currency"]) ?? 0,
			...availableEndpoint === void 0 ? {} : { availableEndpoint },
			...creditsLimit === void 0 ? {} : { creditsLimit },
			...consumedCredits === void 0 ? {} : { consumedCredits }
		});
	}
	return {
		isCreditsBilling: payload["is_credits_billing"] === true,
		isDollarUsageBilling: payload["is_dollar_usage_billing"] === true,
		isPayFreshman: payload["is_pay_freshman"] === true,
		inTrial: trial?.["is_in_trial"] === true,
		trialEndTimeMs: asNumber(trial?.["trial_end_time"]) ?? 0,
		summary,
		packs
	};
}
var TraeUsageClient = class {
	options;
	fetchImpl;
	baseUrl;
	timeoutMs;
	constructor(options) {
		this.options = options;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.baseUrl = options.baseUrl;
		this.timeoutMs = options.timeoutMs ?? 3e4;
	}
	async currentRegion() {
		const cred = await this.options.credential();
		if (cred === void 0) return "cn";
		return cred.edition === "sg" || cred.edition === "solo-sg" ? "ai" : "cn";
	}
	async payBase() {
		if (this.baseUrl !== void 0) return this.baseUrl;
		return await this.currentRegion() === "ai" ? "https://growsg-normal.trae.ai" : "https://api.trae.cn";
	}
	async authedHeaders() {
		const credential = await this.options.credential();
		if (credential === void 0 || credential.accessToken === "") throw new Error("Trae credential is not available; cannot query usage");
		const origin = await this.currentRegion() === "ai" ? "https://www.trae.ai" : "https://www.trae.cn";
		return {
			"Authorization": `Cloud-IDE-JWT ${credential.accessToken}`,
			"Content-Type": "application/json",
			"User-Agent": "Mozilla/5.0",
			"Origin": origin,
			"Referer": `${origin}/`
		};
	}
	async post(path, data, signal) {
		const headers = await this.authedHeaders();
		const response = await this.fetchImpl(`${await this.payBase()}${path}`, {
			method: "POST",
			headers,
			body: JSON.stringify(data),
			signal: signal ?? AbortSignal.timeout(this.timeoutMs)
		});
		if (!response.ok) throw new Error(`Trae usage endpoint ${path} returned HTTP ${response.status}`);
		return await response.json();
	}
	async payStatus(signal) {
		const payload = await this.post("/trae/api/v1/pay/ide_user_pay_status", {}, signal);
		const flag = (key) => payload[key] === true;
		const trial = typeof payload["trial_status"] === "object" && payload["trial_status"] !== null ? payload["trial_status"] : {};
		const fissionStart = asNumber(payload["solo_fission_start_time"]);
		const fissionExpire = asNumber(payload["solo_fission_expire_time"]);
		const fissionMax = asNumber(payload["solo_fission_max_usage"]);
		return {
			isDollarUsageBilling: flag("is_dollar_usage_billing"),
			hasPackage: flag("has_package"),
			isPayFreshman: flag("is_pay_freshman") || flag("is_pay_freshman_v2"),
			inTrial: trial["is_in_trial"] === true,
			trialEndTimeMs: asNumber(trial["trial_end_time"]) ?? 0,
			enableSoloLite: flag("enable_solo_lite"),
			enableSoloBuilder: flag("enable_solo_builder"),
			enableSoloCoder: flag("enable_solo_coder"),
			enableSoloWeb: flag("enable_solo_web"),
			...fissionStart === void 0 || fissionExpire === void 0 || fissionMax === void 0 ? {} : { fission: {
				startTimeMs: fissionStart,
				expireTimeMs: fissionExpire,
				maxUsage: fissionMax
			} }
		};
	}
	async snapshot(signal) {
		return parseUsageSnapshot(await this.post("/trae/api/v2/pay/web_user_ent_usage", { require_usage: true }, signal));
	}
	async clientHeaders() {
		const credential = await this.options.credential();
		if (credential === void 0 || credential.accessToken === "") throw new Error("Trae credential is not available; cannot query usage");
		return buildTraeClientHeaders(credential.accessToken);
	}
	async checkinStatus(signal) {
		if (await this.currentRegion() !== "cn") return {
			checkedIn: false,
			credits: 0,
			enabled: false
		};
		const headers = await this.clientHeaders();
		const response = await this.fetchImpl("https://api.trae.cn/trae/api/v2/ug/checkin_credits/status", {
			method: "POST",
			headers,
			body: JSON.stringify({ req_source: 2 }),
			signal: signal ?? AbortSignal.timeout(this.timeoutMs)
		});
		if (!response.ok) throw new Error(`Trae checkinStatus returned HTTP ${response.status}`);
		const payload = await response.json();
		return {
			checkedIn: payload["checked_in"] === true || payload["did_checked_in"] === true,
			credits: asNumber(payload["credits"]) ?? 0,
			enabled: payload["enable"] !== false
		};
	}
	async claimCheckin(signal) {
		if (await this.currentRegion() !== "cn") return {
			ok: false,
			message: "国际版（Trae Global）暂无每日签到活动"
		};
		try {
			const current = await this.checkinStatus(signal);
			if (current.checkedIn) return {
				ok: true,
				alreadyClaimed: true,
				credits: current.credits
			};
		} catch {}
		const headers = await this.clientHeaders();
		const requestSources = [2, 1];
		let lastResult;
		for (const reqSource of requestSources) try {
			const response = await this.fetchImpl("https://api.trae.cn/trae/api/v2/ug/checkin_credits/claim", {
				method: "POST",
				headers,
				body: JSON.stringify({ req_source: reqSource }),
				signal: signal ?? AbortSignal.timeout(this.timeoutMs)
			});
			if (!response.ok) {
				lastResult = { message: `HTTP ${response.status}` };
				continue;
			}
			const json = await response.json();
			if (json.code === 0) return {
				ok: true,
				credits: json.credits ?? 150
			};
			if (json.code === 9095) return {
				ok: true,
				alreadyClaimed: true,
				credits: json.credits ?? 150
			};
			lastResult = json;
			if (reqSource === 2 && (json.code === 2001 || json.message?.includes("参与用户太多"))) continue;
			break;
		} catch (err) {
			lastResult = { message: err instanceof Error ? err.message : String(err) };
		}
		try {
			const statusAfter = await this.checkinStatus(signal);
			if (statusAfter.checkedIn) return {
				ok: true,
				alreadyClaimed: true,
				credits: statusAfter.credits
			};
		} catch {}
		let friendlyMessage = lastResult?.message;
		if (lastResult?.code === 1002) friendlyMessage = "无法验证您的 Trae 账号，请在设置中刷新或重新登录后再试";
		else if (lastResult?.code === 9090) friendlyMessage = "当前活动暂不可用或已结束";
		else if (lastResult?.code === 9095) friendlyMessage = "该设备或账号今日已完成签到";
		else if (lastResult?.code === 2001 && friendlyMessage?.includes("用户太多")) friendlyMessage = "当前参与签到用户较多，请稍后点击立即签到或等待自动重试";
		return {
			ok: false,
			...typeof lastResult?.code === "number" ? { code: lastResult.code } : {},
			message: friendlyMessage ?? (typeof lastResult?.code === "number" ? `签到未成功 (错误码 ${lastResult.code})` : "签到未成功")
		};
	}
	async view(signal) {
		if (await this.currentRegion() === "ai") try {
			return { payStatus: await this.payStatus(signal) };
		} catch {
			return {};
		}
		try {
			const [snapshot, checkin] = await Promise.all([this.snapshot(signal).catch(() => void 0), this.checkinStatus(signal).catch(() => void 0)]);
			return {
				...snapshot !== void 0 ? { snapshot } : {},
				...checkin !== void 0 ? { checkin } : {}
			};
		} catch {
			return {};
		}
	}
};
//#endregion
//#region src/upstream.ts
function classifyUpstreamError(status) {
	if (status === 401 || status === 403) return "authentication";
	if (status === 402) return "hard_credit";
	if (status === 429) return "soft_rate";
	if (status === 404) return "not_found";
	if (status >= 500) return "server";
	return "client";
}
var TraeUpstreamClient = class {
	variant;
	store;
	identityProvider;
	fetchImpl;
	chatBaseUrl;
	catalogProvider;
	usageClient;
	remoteClient;
	soloClient;
	constructor(options) {
		this.variant = options.variant;
		this.store = options.store;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.identityProvider = options.identity ?? (async () => fallbackTraeIdentity(this.variant.region === "ai" ? "sg" : "cn"));
		this.chatBaseUrl = options.chatBaseUrl;
		this.catalogProvider = options.catalog;
		this.usageClient = new TraeUsageClient({
			credential: () => this.store.get(),
			fetchImpl: this.fetchImpl,
			...options.payBaseUrl !== void 0 ? { baseUrl: options.payBaseUrl } : {}
		});
		this.remoteClient = new TraeSoloRemoteCatalogClient({
			credential: () => this.store.get(),
			fetchImpl: this.fetchImpl,
			...options.remoteBaseUrl !== void 0 ? { baseUrl: options.remoteBaseUrl } : {}
		});
		this.soloClient = new TraeSoloUpstreamClient({
			credential: () => this.store.get(),
			identity: this.identityProvider,
			...options.chatBaseUrl !== void 0 ? { baseUrl: options.chatBaseUrl } : {},
			fetchImpl: this.fetchImpl
		});
	}
	async chatStream(bodyJson, signal) {
		const [credential, identity] = await Promise.all([this.store.get(), this.identityProvider()]);
		if (credential === void 0 || credential.accessToken === "") return {
			ok: false,
			status: 401,
			kind: "authentication",
			message: `未配置或未登录 ${this.variant.displayName} 凭据`
		};
		const defaultBase = this.variant.region === "ai" ? "https://coresg-normal.trae.ai" : "https://trae-api-cn.mchost.guru";
		const url = traeEndpoint(this.chatBaseUrl ?? defaultBase, TRAE_SOLO_CHAT_PATH);
		const headers = buildTraeCnHeaders(credential, identity);
		const models = this.catalogProvider?.() ?? [];
		const body = prepareSoloBody(bodyJson, {
			region: this.variant.region,
			catalogModels: models
		});
		try {
			const response = await this.fetchImpl(url, {
				method: "POST",
				headers,
				body,
				...signal !== void 0 ? { signal } : {}
			});
			if (!response.ok) {
				const errorText = await response.text().catch(() => "");
				return {
					ok: false,
					status: response.status,
					kind: classifyUpstreamError(response.status),
					message: errorText || `HTTP ${response.status}`
				};
			}
			return {
				ok: true,
				response
			};
		} catch (err) {
			return {
				ok: false,
				status: 0,
				kind: "server",
				message: err instanceof Error ? err.message : String(err)
			};
		}
	}
	async fetchCatalog(signal) {
		try {
			const [remoteModels, wireModels] = await Promise.all([this.remoteClient.fetchModels(signal).catch(() => []), this.soloClient.fetchModels(signal).catch(() => [])]);
			const merged = mergeTraeModelSources(remoteModels, wireModels, this.variant.region);
			return merged.length > 0 ? merged : [...fallbackModelsFor(this.variant.region)];
		} catch {
			return [...fallbackModelsFor(this.variant.region)];
		}
	}
	async fetchCredits(signal) {
		const cred = await this.store.get();
		if (cred === void 0 || cred.accessToken === "") return void 0;
		const view = await this.usageClient.view(signal);
		if (this.variant.region === "ai") {
			const pay = view.payStatus;
			if (pay === void 0) return void 0;
			return {
				total: pay.hasPackage ? 100 : 0,
				accounts: [],
				isSubscription: true,
				inTrial: pay.inTrial,
				...pay.trialEndTimeMs > 0 ? { trialEndTime: new Date(pay.trialEndTimeMs).toLocaleString() } : {}
			};
		}
		const snap = view.snapshot;
		if (snap === void 0) return void 0;
		const totalAvailable = Math.max(0, snap.summary.totalAmount - snap.summary.consumedAmount);
		const accounts = snap.packs.map((p) => ({
			packageName: p.displayDesc || "权益额度",
			remain: p.consumedCredits !== void 0 && p.creditsLimit !== void 0 ? Math.max(0, p.creditsLimit - p.consumedCredits) : p.creditsLimit ?? 0,
			size: p.creditsLimit ?? 0,
			...p.endTimeMs > 0 ? { packageEndTime: new Date(p.endTimeMs).toLocaleDateString() } : {}
		}));
		return {
			total: totalAvailable,
			totalSize: snap.summary.totalAmount,
			accounts
		};
	}
};
//#endregion
//#region src/status-paths.ts
/**
* 前后端契约路径与状态类型定义。
*
* @module dsh-trae-connect/status-paths
*/
/** 插件国内版状态接口路径 */
const TRAE_STATUS_PATH = "/plugins/dsh-trae-connect/status";
/** 插件国际版（Trae Global）状态接口路径 */
const TRAE_AI_STATUS_PATH = "/plugins/dsh-trae-connect/ai/status";
/** 插件国内版探测与操作接口路径 */
const TRAE_PROBE_PATH = "/plugins/dsh-trae-connect/probe";
/** 插件国际版（Trae Global）探测与操作接口路径 */
const TRAE_AI_PROBE_PATH = "/plugins/dsh-trae-connect/ai/probe";
/** 插件国内版登录授权接口路径 */
const TRAE_LOGIN_PATH = "/plugins/dsh-trae-connect/login";
/** 插件国际版登录授权接口路径 */
const TRAE_AI_LOGIN_PATH = "/plugins/dsh-trae-connect/ai/login";
//#endregion
//#region src/variants.ts
/**
* The two Trae products this plugin serves (Domestic CN and International Global).
*
* @module dsh-trae-connect/variants
*/
const TRAE_VARIANTS = [{
	id: "trae",
	displayName: "Trae",
	appName: "Trae",
	region: "cn",
	ownFilename: ".trae-auth.json",
	probeFilename: ".trae-probe.json",
	catalogFilename: ".trae-catalog.json",
	statusPath: TRAE_STATUS_PATH,
	probePath: TRAE_PROBE_PATH,
	loginPath: TRAE_LOGIN_PATH
}, {
	id: "trae-global",
	displayName: "Trae Global",
	appName: "Trae Global",
	region: "ai",
	ownFilename: ".trae-ai-auth.json",
	probeFilename: ".trae-ai-probe.json",
	catalogFilename: ".trae-ai-catalog.json",
	statusPath: TRAE_AI_STATUS_PATH,
	probePath: TRAE_AI_PROBE_PATH,
	loginPath: TRAE_AI_LOGIN_PATH
}];
const CN_VARIANT = TRAE_VARIANTS[0];
const AI_VARIANT = TRAE_VARIANTS[1];
function variantFor(id) {
	return TRAE_VARIANTS.find((v) => v.id === id);
}
function variantForRegion(region) {
	return region === "ai" ? AI_VARIANT : CN_VARIANT;
}
//#endregion
export { FALLBACK_TRAE_MODELS_AI as A, TraeCredentialStore as C, traeStateDir as D, traePluginDataDir as E, traeInputModalities as F, fallbackModelsFor as M, formatTraeModelDisplayName as N, traeStorageCandidates as O, mergeTraeModelSources as P, TRAE_CONNECT_VERSION as S, parseTraeDocument as T, clearHostHeartbeat as _, variantForRegion as a, traeHostHeartbeatPath as b, TRAE_AI_STATUS_PATH as c, TRAE_STATUS_PATH as d, TraeUpstreamClient as f, signDeviceProof as g, buildTraeDeviceInfo as h, variantFor as i, TraeCatalog as j, FALLBACK_TRAE_MODELS as k, TRAE_LOGIN_PATH as l, TraeLoginClient as m, CN_VARIANT as n, TRAE_AI_LOGIN_PATH as o, classifyUpstreamError as p, TRAE_VARIANTS as r, TRAE_AI_PROBE_PATH as s, AI_VARIANT as t, TRAE_PROBE_PATH as u, isHeartbeatProcessAlive as v, parseTraeAuth as w, writeHostHeartbeat as x, readHostHeartbeat as y };
