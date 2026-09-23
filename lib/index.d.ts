import z from "@deepseek-ai/schemastery";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { IncomingMessage, ServerResponse } from "node:http";
import { Context } from "@deepseek-ai/cordis";
import { SettingsNamespace } from "@deepseek-ai/dsh-settings";
import { AttachmentStore } from "@deepseek-ai/dsh-attachment";
//#region src/reasoning.d.ts
declare const TRAE_REASONING_EFFORTS: readonly ["minimal", "low", "medium", "high", "xhigh"];
type TraeReasoningEffort = typeof TRAE_REASONING_EFFORTS[number];
interface TraeReasoningCapability {
  supported: readonly TraeReasoningEffort[];
  defaultEffort?: TraeReasoningEffort;
}
//#endregion
//#region src/variants.d.ts
/**
 * The two Trae products this plugin serves (Domestic CN and International Global).
 *
 * @module dsh-trae-connect/variants
 */
type TraeRegion = 'cn' | 'ai';
interface TraeVariant {
  id: string;
  displayName: string;
  appName: string;
  region: TraeRegion;
  ownFilename: string;
  probeFilename: string;
  catalogFilename: string;
  statusPath: string;
  probePath: string;
  loginPath: string;
}
declare const TRAE_VARIANTS: readonly TraeVariant[];
declare const CN_VARIANT: TraeVariant;
declare const AI_VARIANT: TraeVariant;
declare function variantFor(id: string): TraeVariant | undefined;
declare function variantForRegion(region: TraeRegion): TraeVariant;
//#endregion
//#region src/catalog.d.ts
type TraeInputModality = 'text' | 'image';
interface TraeDiscoveredReasoning {
  supported: TraeReasoningEffort[];
  defaultEffort?: TraeReasoningEffort;
}
interface TraeDiscoveredModel {
  id: string;
  name: string;
  multimodal: boolean;
  requiresMembership?: boolean;
  contextWindow?: number;
  maxContextWindow?: number;
  creditMultiplier?: number;
  badges?: string[];
  reasoningSupported: boolean;
  reasoning?: TraeDiscoveredReasoning | undefined;
}
interface TraeWireModel {
  id: string;
  name: string;
  contextWindow?: number | undefined;
  maxTokens?: number | undefined;
  reasoning?: TraeReasoningCapability | undefined;
  function?: string | undefined;
}
interface TraeModelInfo {
  id: string;
  name: string;
  contextWindow?: number | undefined;
  maxTokens?: number | undefined;
  input?: TraeInputModality[] | undefined;
  creditMultiplier?: number | undefined;
  badges?: string[] | undefined;
  requiresMembership?: boolean | undefined;
  reasoningSupported?: boolean | undefined;
  reasoning?: TraeDiscoveredReasoning | undefined;
  reasoningEfforts?: Partial<Record<TraeReasoningEffort, string | null>> | undefined;
  maxContextWindow?: number | undefined;
  wireConfigName?: string | undefined;
  wireFunction?: string | undefined;
}
/**
 * 国内版（16 个模型，含 Auto）兜底目录。
 */
declare const FALLBACK_TRAE_MODELS: readonly TraeModelInfo[];
/**
 * 国际版（17 个模型，含 Auto）兜底目录。
 */
declare const FALLBACK_TRAE_MODELS_AI: readonly TraeModelInfo[];
declare function fallbackModelsFor(region: TraeRegion): readonly TraeModelInfo[];
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
declare function formatTraeModelDisplayName(model: Pick<TraeModelInfo, 'id' | 'name' | 'creditMultiplier' | 'requiresMembership' | 'badges'>): string;
/**
 * 合并远端模型目录与 wire 运行时映射。
 * 确保包含 Auto 以及所有可调用的模型，不遗漏任何有效模型。
 */
declare function mergeTraeModelSources(remote: readonly TraeDiscoveredModel[], wire: readonly TraeWireModel[], region?: TraeRegion): TraeModelInfo[];
type CatalogSource = 'live' | 'saved' | 'fallback';
declare class TraeCatalog {
  readonly region: TraeRegion;
  private models;
  private disabledModels;
  private source;
  private fetchedAt;
  private lastError;
  private listeners;
  constructor(region: TraeRegion);
  setDisabledModels(disabled: readonly string[]): boolean;
  getDisabledModels(): readonly string[];
  current(): readonly TraeModelInfo[];
  status(): {
    source: CatalogSource;
    fetchedAt?: number;
    error?: string;
  };
  setLive(models: readonly TraeModelInfo[]): void;
  setSaved(models: readonly TraeModelInfo[], fetchedAt?: number): void;
  setFallback(error?: string): void;
  subscribe(listener: () => void): () => void;
  private notify;
}
//#endregion
//#region src/paths.d.ts
declare function traePluginDataDir(): string;
declare function traeStateDir(): string;
type TraeEdition = 'cn' | 'sg' | 'solo' | 'solo-sg';
type TraeCredentialSource = 'desktop' | 'cli';
interface TraeStorageCandidate {
  edition: TraeEdition;
  path: string;
  source: TraeCredentialSource;
  region: TraeRegion;
}
declare function traeStorageCandidates(platform?: NodeJS.Platform, home?: string, env?: NodeJS.ProcessEnv): TraeStorageCandidate[];
//#endregion
//#region src/auth.d.ts
interface TraeRefreshOutcome {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAtMs: number;
  refreshExpiresAtMs?: number | undefined;
  host?: string | undefined;
}
interface TraeCredential {
  accessToken: string;
  refreshToken?: string | undefined;
  userId: string;
  accountName?: string | undefined;
  avatarUrl?: string | undefined;
  host: string;
  userRegion?: string | undefined;
  expiresAtMs: number;
  refreshExpiresAtMs?: number | undefined;
  edition: TraeEdition;
  source: 'desktop' | 'dsh' | 'cli';
}
interface TraeCredentialStoreOptions {
  variant: TraeVariant;
  refresh?: ((credential: TraeCredential) => Promise<TraeRefreshOutcome>) | undefined;
  refreshMarginMs?: number | undefined;
}
interface TraeAuthStatus {
  status: 'valid' | 'expired' | 'unconfigured';
  credential?: TraeCredential | undefined;
  expiresAtMs?: number | undefined;
  error?: string | undefined;
}
declare function parseTraeAuth(raw: unknown, edition?: TraeEdition, source?: TraeCredential['source']): TraeCredential | undefined;
declare function parseTraeDocument(text: string): TraeCredential | undefined;
declare class TraeCredentialStore {
  readonly variant: TraeVariant;
  private readonly refresh?;
  private readonly refreshMarginMs;
  private inflight;
  constructor(options: TraeCredentialStoreOptions);
  ownAuthPath(): string;
  legacyAuthPaths(): string[];
  read(): Promise<TraeCredential | undefined>;
  write(credential: TraeCredential): Promise<void>;
  remove(): Promise<void>;
  get(): Promise<TraeCredential | undefined>;
  private resolveCurrent;
  status(): Promise<TraeAuthStatus>;
}
//#endregion
//#region src/identity.d.ts
interface TraeIdentity {
  edition: TraeEdition;
  machineId: string;
  deviceId: string;
  appVersion?: string;
  buildVersion?: string;
  deviceBrand?: string;
  deviceCpu?: string;
  osVersion?: string;
  platform: NodeJS.Platform;
}
//#endregion
//#region src/solo.d.ts
interface TraeSoloModel {
  id: string;
  name: string;
  contextWindow?: number | undefined;
  maxTokens?: number | undefined;
  reasoning?: TraeReasoningCapability | undefined;
  function?: string | undefined;
}
interface TraeSoloClientOptions {
  credential: () => Promise<TraeCredential | undefined>;
  identity: () => Promise<TraeIdentity>;
  baseUrl?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
}
declare class TraeSoloUpstreamClient {
  private readonly options;
  private readonly fetchImpl;
  constructor(options: TraeSoloClientOptions);
  fetchModels(signal?: AbortSignal): Promise<TraeSoloModel[]>;
}
//#endregion
//#region src/solo-remote.d.ts
interface TraeSoloRemoteCatalogOptions {
  credential: () => Promise<TraeCredential | undefined>;
  fetchImpl?: typeof fetch | undefined;
  baseUrl?: string | undefined;
}
declare class TraeSoloRemoteCatalogClient {
  private readonly options;
  private readonly fetchImpl;
  private readonly baseUrl;
  constructor(options: TraeSoloRemoteCatalogOptions);
  private headers;
  fetchModels(signal?: AbortSignal): Promise<TraeDiscoveredModel[]>;
}
//#endregion
//#region src/status-paths.d.ts
/**
 * 前后端契约路径与状态类型定义。
 *
 * @module dsh-trae-connect/status-paths
 */
/** 插件国内版状态接口路径 */
declare const TRAE_STATUS_PATH = "/plugins/dsh-trae-connect/status";
/** 插件国际版（Trae Global）状态接口路径 */
declare const TRAE_AI_STATUS_PATH = "/plugins/dsh-trae-connect/ai/status";
/** 插件国内版探测与操作接口路径 */
declare const TRAE_PROBE_PATH = "/plugins/dsh-trae-connect/probe";
/** 插件国际版（Trae Global）探测与操作接口路径 */
declare const TRAE_AI_PROBE_PATH = "/plugins/dsh-trae-connect/ai/probe";
/** 插件国内版登录授权接口路径 */
declare const TRAE_LOGIN_PATH = "/plugins/dsh-trae-connect/login";
/** 插件国际版登录授权接口路径 */
declare const TRAE_AI_LOGIN_PATH = "/plugins/dsh-trae-connect/ai/login";
/** 登录接口支持的操作类型 */
type TraeWebLoginAction = 'begin' | 'poll' | 'logout' | 'import' | 'detect';
/** 登录接口请求体结构 */
interface TraeWebLoginRequest {
  action: TraeWebLoginAction;
  state?: string;
  document?: string;
}
/** 登录接口响应结果 */
type TraeWebLoginResult = {
  status: 'pending';
  state?: string;
  url?: string;
} | {
  status: 'complete';
  userId?: string;
  nickname?: string;
  accountName?: string;
} | {
  status: 'imported';
  userId?: string;
  uid?: string;
  nickname?: string;
  accountName?: string;
} | {
  status: 'signed-out';
} | {
  status: 'failed';
  message: string;
};
/** 单个模型的探测记录 */
interface TraeWebProbeModel {
  id: string;
  name: string;
  validation: 'validating' | 'non-validating' | 'unknown';
  efforts: readonly string[];
  probedAt: number;
}
/** 状态文档中的探测区域信息 */
interface TraeWebProbeSection {
  consent: boolean;
  running: boolean;
  candidates: readonly string[];
  results: readonly TraeWebProbeModel[];
}
/** 探测与管理接口接受的操作动作 */
interface TraeProbeAction {
  action: 'probe' | 'clear' | 'refresh' | 'set-maximum-context-window' | 'set-disabled-models' | 'clear-checkin-logs' | 'checkin';
  model?: string;
  enabled?: boolean;
  disabledModels?: readonly string[];
}
/** 模型目录状态 */
interface TraeWebCatalog {
  source: 'live' | 'saved' | 'fallback';
  fetchedAt?: number;
  appVersion?: string;
  error?: string;
}
/** 单个积分或资源包明细 */
interface TraeWebCreditAccount {
  packageName: string;
  remain: number;
  size: number;
  unlimited?: true;
  packageEndTime?: string;
}
/** 聚合额度与积分信息 */
interface TraeWebCredits {
  total: number;
  totalSize?: number;
  accounts: readonly TraeWebCreditAccount[];
  unlimited?: true;
  cycleResetTime?: string;
  isSubscription?: boolean;
  inTrial?: boolean;
  trialEndTime?: string;
}
/** 签到单条日志 */
interface TraeCheckInLog {
  id: string;
  date: string;
  timestamp: number;
  status: 'claimed' | 'already-claimed' | 'no-campaign' | 'error';
  amount?: number | undefined;
  message?: string | undefined;
}
/** 签到整体信息 */
interface TraeWebCheckInInfo {
  lastDate: string;
  lastAt: number;
  status: 'claimed' | 'already-claimed' | 'no-campaign' | 'error';
  amount?: number | undefined;
  message?: string | undefined;
  nextRunAt?: number | undefined;
  logs?: readonly TraeCheckInLog[] | undefined;
}
/** 模型计费与上下文信息徽章 */
interface TraeWebModelBadge {
  id: string;
  name: string;
  free?: boolean;
  badges?: readonly string[];
  credits?: string;
  rateUnknown?: true;
  contextWindow?: number;
  defaultContextWindow?: number;
  maxContextWindow?: number;
  maxInputTokens?: number;
  requiresMembership?: boolean;
}
/** 前端渲染读取的完整 Trae 状态文档 */
type TraeWebStatus = {
  status: 'signed-in';
  userId?: string;
  nickname?: string;
  accountName?: string;
  domain?: string;
  region?: 'cn' | 'ai' | 'global';
  source?: string;
  expiresAt?: number;
  credits?: TraeWebCredits;
  creditsError?: string;
  models?: readonly TraeWebModelBadge[];
  catalog?: TraeWebCatalog;
  probe?: TraeWebProbeSection;
  useMaximumContextWindow?: boolean;
  disabledModels?: readonly string[];
  probeKey?: string;
  loginKey?: string;
  checkIn?: TraeWebCheckInInfo;
} | {
  status: 'signed-out';
  region?: 'cn' | 'ai' | 'global';
  reason?: string;
  loginKey?: string;
  probeKey?: string;
  models?: readonly TraeWebModelBadge[];
  catalog?: TraeWebCatalog;
  probe?: TraeWebProbeSection;
  useMaximumContextWindow?: boolean;
  disabledModels?: readonly string[];
  checkIn?: TraeWebCheckInInfo;
} | {
  status: 'error';
  message: string;
};
//#endregion
//#region src/usage.d.ts
interface TraeUsageOptions {
  credential: () => Promise<TraeCredential | undefined>;
  fetchImpl?: typeof fetch | undefined;
  baseUrl?: string | undefined;
  timeoutMs?: number | undefined;
}
interface TraePayStatus {
  isDollarUsageBilling: boolean;
  hasPackage: boolean;
  isPayFreshman: boolean;
  inTrial: boolean;
  trialEndTimeMs: number;
  enableSoloLite: boolean;
  enableSoloBuilder: boolean;
  enableSoloCoder: boolean;
  enableSoloWeb: boolean;
  fission?: {
    startTimeMs: number;
    expireTimeMs: number;
    maxUsage: number;
  } | undefined;
}
interface TraeUsageSummary {
  totalAmount: number;
  consumedAmount: number;
  consumptionRatio: number;
}
interface TraeUsagePack {
  displayDesc: string;
  entitlementId: string;
  endTimeMs: number;
  currency: number;
  availableEndpoint?: number;
  creditsLimit?: number;
  consumedCredits?: number;
}
interface TraeUsageSnapshot {
  isCreditsBilling: boolean;
  isDollarUsageBilling: boolean;
  isPayFreshman: boolean;
  inTrial: boolean;
  trialEndTimeMs: number;
  summary: TraeUsageSummary;
  packs: TraeUsagePack[];
}
interface TraeCheckinStatus {
  checkedIn: boolean;
  credits: number;
  enabled: boolean;
}
interface TraeActivityRule {
  activityId: string;
  enabled: boolean;
  activityType: number;
  startTimeMs: number;
  endTimeMs: number;
  workExtra?: Record<string, unknown>;
}
interface TraeUsageView {
  snapshot?: TraeUsageSnapshot;
  checkin?: TraeCheckinStatus;
  activities?: TraeActivityRule[];
  payStatus?: TraePayStatus;
}
declare class TraeUsageClient {
  private readonly options;
  private readonly fetchImpl;
  private readonly baseUrl;
  private readonly timeoutMs;
  constructor(options: TraeUsageOptions);
  private currentRegion;
  private payBase;
  private authedHeaders;
  private post;
  payStatus(signal?: AbortSignal): Promise<TraePayStatus>;
  snapshot(signal?: AbortSignal): Promise<TraeUsageSnapshot>;
  private clientHeaders;
  checkinStatus(signal?: AbortSignal): Promise<TraeCheckinStatus>;
  claimCheckin(signal?: AbortSignal): Promise<{
    ok: boolean;
    code?: number;
    message?: string;
    credits?: number;
    alreadyClaimed?: boolean;
  }>;
  view(signal?: AbortSignal): Promise<TraeUsageView>;
}
//#endregion
//#region src/upstream.d.ts
type UpstreamErrorKind = 'authentication' | 'hard_credit' | 'soft_rate' | 'not_found' | 'server' | 'client' | 'unconfigured';
type TraeChatResult = {
  ok: true;
  response: Response;
} | {
  ok: false;
  status: number;
  kind: UpstreamErrorKind;
  message: string;
};
declare function classifyUpstreamError(status: number): UpstreamErrorKind;
interface TraeUpstreamClientOptions {
  variant: TraeVariant;
  store: TraeCredentialStore;
  identity?: (() => Promise<TraeIdentity>) | undefined;
  fetchImpl?: typeof fetch | undefined;
  chatBaseUrl?: string | undefined;
  remoteBaseUrl?: string | undefined;
  payBaseUrl?: string | undefined;
  catalog?: (() => readonly TraeModelInfo[]) | undefined;
}
declare class TraeUpstreamClient {
  readonly variant: TraeVariant;
  private readonly store;
  private readonly identityProvider;
  private readonly fetchImpl;
  private readonly chatBaseUrl;
  private readonly catalogProvider?;
  readonly usageClient: TraeUsageClient;
  readonly remoteClient: TraeSoloRemoteCatalogClient;
  readonly soloClient: TraeSoloUpstreamClient;
  constructor(options: TraeUpstreamClientOptions);
  chatStream(bodyJson: string, signal?: AbortSignal): Promise<TraeChatResult>;
  fetchCatalog(signal?: AbortSignal): Promise<readonly TraeModelInfo[]>;
  fetchCredits(signal?: AbortSignal): Promise<TraeWebCredits | undefined>;
}
//#endregion
//#region src/shim.d.ts
interface ShimLogger {
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}
interface TraeShim {
  ready: Promise<void>;
  baseUrl(): string;
  token(): string;
  close(): Promise<void>;
}
interface TraeShimOptions {
  catalog: TraeCatalog;
  client: TraeUpstreamClient;
  logger?: ShimLogger | undefined;
}
declare function createTraeShim(options: TraeShimOptions): TraeShim;
//#endregion
//#region src/adapter.d.ts
declare const TRAE_PROVIDER = "trae";
declare const TRAE_AI_PROVIDER = "trae-global";
interface TraeAdapterOptions {
  variant: TraeVariant;
  shim: TraeShim;
  catalog: TraeCatalog;
  resolveAttachments?: () => AttachmentStore | undefined;
  useMaximumContextWindow?: () => boolean;
}
interface TraeAdapter {
  adapter: PiAiAdapter;
  invalidate(): void;
}
declare function createTraeAdapter(options: TraeAdapterOptions): TraeAdapter;
//#endregion
//#region src/catalog-store.d.ts
declare const TRAE_CATALOG_FILENAME = ".trae-catalog.json";
interface TraeCatalogStoreOptions {
  path?: string;
  variant?: TraeVariant;
}
declare class TraeCatalogStore {
  private readonly path;
  private entries;
  constructor(options?: TraeCatalogStoreOptions | string);
  private load;
  get(account: string): {
    models: readonly TraeModelInfo[];
    fetchedAtMs: number;
  } | undefined;
  put(account: string, source: string, models: readonly TraeModelInfo[]): void;
  private flush;
}
//#endregion
//#region src/checkin-scheduler.d.ts
interface CheckInLogItem {
  id: string;
  date: string;
  timestamp: number;
  status: 'claimed' | 'already-claimed' | 'no-campaign' | 'error';
  amount?: number;
  message?: string;
}
interface CheckInRecord {
  lastDate: string;
  lastAt: number;
  status: 'claimed' | 'already-claimed' | 'no-campaign' | 'error';
  amount?: number;
  message?: string;
  logs?: CheckInLogItem[];
}
declare function getUtc8DateString(now?: Date): string;
declare class JsonFileCheckInStore {
  private readonly filePath;
  constructor(filePath?: string);
  private readAll;
  read(variantId: string): CheckInRecord | undefined;
  write(variantId: string, record: CheckInRecord): void;
  clear(variantId: string): void;
}
declare class CheckInScheduler {
  private timer;
  private readonly store;
  private readonly clients;
  constructor(clients: readonly {
    variantId: string;
    client: TraeUpstreamClient;
  }[], store?: JsonFileCheckInStore);
  start(): void;
  stop(): void;
  get(variantId: string): CheckInRecord | undefined;
  clearLogs(variantId: string): void;
  /**
   * 主动同步指定版本的最新服务端签到状态并纠偏本地记录。
   */
  syncVariant(variantId: string): Promise<CheckInRecord | undefined>;
  checkIn(variantId: string): Promise<{
    state: string;
    reason?: string;
    amount?: number;
  }>;
  runAll(): Promise<void>;
}
//#endregion
//#region src/host-heartbeat.d.ts
declare const HEARTBEAT_FORMAT_VERSION = 1;
interface TraeHostHeartbeat {
  version: typeof HEARTBEAT_FORMAT_VERSION;
  package: 'dsh-trae-connect';
  pluginVersion: string;
  registeredAt: number;
  pid: number;
}
declare function traeHostHeartbeatPath(): string;
declare function writeHostHeartbeat(): Promise<void>;
declare function clearHostHeartbeat(): Promise<void>;
declare function isHeartbeatProcessAlive(heartbeat: TraeHostHeartbeat): boolean;
declare function readHostHeartbeat(): Promise<TraeHostHeartbeat | undefined>;
//#endregion
//#region src/login.d.ts
declare class TraeLoginClient {
  readonly variant: TraeVariant;
  private readonly store;
  private readonly fetchImpl;
  private readonly attempts;
  constructor(variant: TraeVariant, store: TraeCredentialStore, fetchImpl?: typeof fetch);
  /**
   * Start an OAuth PKCE sign-in attempt.
   * Spawns a temporary loopback HTTP server to catch browser authorization callback.
   */
  begin(): Promise<{
    state: string;
    authUrl: string;
  }>;
  /**
   * Handle the loopback callback from browser after user authorization.
   */
  private handleAuthorizeCallback;
  /**
   * Request /ExchangeToken to obtain access and refresh tokens.
   */
  private exchangeToken;
  /**
   * Poll the status of an ongoing sign-in attempt.
   */
  poll(state: string): Promise<{
    status: 'pending' | 'complete' | 'failed';
    accountName?: string | undefined;
    userId?: string | undefined;
    message?: string | undefined;
  }>;
  /**
   * Automatically detect and adopt a sign-in from local Trae desktop app or CLI (fallback).
   */
  detectLocal(): Promise<TraeCredential | undefined>;
  /**
   * Adopt a user-provided credential document or bare token.
   */
  importDocument(text: string): Promise<TraeCredential>;
  logout(): Promise<void>;
}
//#endregion
//#region src/login-route.d.ts
interface TraeLoginRouteOptions {
  variant: TraeVariant;
  loginClient: TraeLoginClient;
  loginKey?: () => string;
  onLoggedIn?: () => void;
}
declare function createLoginKey(): string;
declare function traeLoginHandler(req: IncomingMessage, res: ServerResponse, options: TraeLoginRouteOptions): Promise<void>;
//#endregion
//#region src/probe.d.ts
declare const PROBE_EFFORT_CANDIDATES: readonly TraeReasoningEffort[];
type SentinelFactory = () => string;
interface ProbeAttempt {
  status: number;
  streamed: boolean;
  errorCode?: string;
  detail?: string;
}
type ProbeSender = (effort: string | undefined, signal: AbortSignal) => Promise<ProbeAttempt>;
type ProbeOutcome = {
  validation: 'validating';
  efforts: readonly TraeReasoningEffort[];
  requests: number;
} | {
  validation: 'non-validating';
  efforts: readonly [];
  requests: number;
} | {
  validation: 'unknown';
  efforts: readonly [];
  requests: number;
  reason: string;
};
declare function probeModel(send: ProbeSender, options?: {
  sentinel?: SentinelFactory | undefined;
}): Promise<ProbeOutcome>;
//#endregion
//#region src/probe-store.d.ts
declare const TRAE_PROBE_FILENAME = ".trae-probe.json";
type TraeProbeValidation = 'validating' | 'non-validating' | 'unknown';
interface TraeProbeRecord {
  fingerprint: string;
  validation: TraeProbeValidation;
  efforts: readonly TraeReasoningEffort[];
  probedAtMs: number;
  pluginVersion: string;
  account?: string | undefined;
}
declare function fingerprintModel(model: TraeModelInfo): string;
declare function newestFirst(records: Record<string, TraeProbeRecord>): [string, TraeProbeRecord][];
interface TraeProbeStoreOptions {
  path?: string;
  variant?: TraeVariant;
  ttlMs?: number;
}
declare class TraeProbeStore {
  private readonly path;
  private readonly ttlMs;
  private records;
  constructor(options?: TraeProbeStoreOptions);
  private load;
  get(model: TraeModelInfo, account?: string): TraeProbeRecord | undefined;
  all(): Record<string, TraeProbeRecord>;
  put(model: TraeModelInfo, validation: TraeProbeValidation, efforts: readonly TraeReasoningEffort[], account?: string): void;
  clear(): void;
  private flush;
}
//#endregion
//#region src/probe-service.d.ts
type TraeProbeStatus = {
  state: 'ok';
  validation: TraeProbeValidation;
  efforts: readonly string[];
  requests: number;
} | {
  state: 'unavailable';
  reason: string;
};
interface TraeProbeServiceOptions {
  store: TraeProbeStore;
  catalog: TraeCatalog;
  client: TraeUpstreamClient;
  consent: () => boolean;
  account: () => string | undefined;
  sentinel?: SentinelFactory | undefined;
  send?: ((modelId: string) => ProbeSender) | undefined;
}
declare class TraeProbeService {
  private readonly options;
  private queue;
  private running;
  constructor(options: TraeProbeServiceOptions);
  isRunning(): boolean;
  candidates(): readonly string[];
  probe(modelId: string): Promise<TraeProbeStatus>;
  clear(): void;
}
//#endregion
//#region src/probe-route.d.ts
interface TraeProbeRouteOptions {
  variant: TraeVariant;
  probeService: TraeProbeService;
  probeKey?: () => string;
  onRefresh?: () => Promise<void>;
  onCheckin?: () => Promise<{
    state: string;
    reason?: string;
    amount?: number;
  }>;
  onClearCheckInLogs?: () => void;
  onSetMaximumContextWindow?: (enabled: boolean) => Promise<{
    state: string;
    reason?: string;
  }>;
  onSetDisabledModels?: (disabledModels: readonly string[]) => Promise<{
    state: string;
    reason?: string;
  }>;
}
declare function createProbeKey(): string;
declare function traeProbeHandler(req: IncomingMessage, res: ServerResponse, options: TraeProbeRouteOptions): Promise<void>;
//#endregion
//#region src/refresh.d.ts
declare function refreshTraeCredential(credential: TraeCredential, signal?: AbortSignal): Promise<TraeRefreshOutcome>;
//#endregion
//#region src/version.d.ts
/**
 * Resolved npm package version, injected at build time by tsdown/vitest.
 * Falls back to a development marker when running unbundled from source.
 */
declare const TRAE_CONNECT_VERSION: string;
//#endregion
//#region src/web-status.d.ts
interface TraeStatusRouteOptions {
  variant: TraeVariant;
  store: TraeCredentialStore;
  client: TraeUpstreamClient;
  models: () => readonly TraeModelInfo[];
  catalog?: () => TraeWebCatalog | undefined;
  probe?: () => TraeWebProbeSection;
  probeKey?: string;
  loginKey?: string;
  useMaximumContextWindow?: () => boolean;
  disabledModels?: () => readonly string[];
  checkIn?: () => TraeWebCheckInInfo | undefined;
  onForceRefresh?: () => Promise<void>;
}
declare function traeStatusHandler(req: IncomingMessage, res: ServerResponse, options: TraeStatusRouteOptions): Promise<void>;
//#endregion
//#region src/index.d.ts
declare const name = "llm-trae";
declare const inject: string[];
declare const TRAE_SETTINGS_NS: SettingsNamespace;
declare const TRAE_AI_SETTINGS_NS: SettingsNamespace;
declare const TRAE_QUOTA_SETTINGS_NS: SettingsNamespace;
/** Plugin configuration. */
interface Config {
  probeConsent?: boolean;
  useMaximumContextWindow?: boolean;
  sidebarQuotaCN?: boolean;
  sidebarQuotaAI?: boolean;
  autoCheckInCN?: boolean;
  autoCheckInAI?: boolean;
  quotaPollMs?: number;
}
declare const QUOTA_POLL_DEFAULT_MS = 300000;
declare const QUOTA_POLL_MIN_MS = 60000;
declare const Config: z<Config>;
declare function apply(ctx: Context, config?: Config): void;
//#endregion
export { AI_VARIANT, CN_VARIANT, CheckInScheduler, Config, FALLBACK_TRAE_MODELS, FALLBACK_TRAE_MODELS_AI, JsonFileCheckInStore, PROBE_EFFORT_CANDIDATES, type ProbeAttempt, type ProbeOutcome, type ProbeSender, QUOTA_POLL_DEFAULT_MS, QUOTA_POLL_MIN_MS, TRAE_AI_LOGIN_PATH, TRAE_AI_PROBE_PATH, TRAE_AI_PROVIDER, TRAE_AI_SETTINGS_NS, TRAE_AI_STATUS_PATH, TRAE_CATALOG_FILENAME, TRAE_CONNECT_VERSION, TRAE_LOGIN_PATH, TRAE_PROBE_FILENAME, TRAE_PROBE_PATH, TRAE_PROVIDER, TRAE_QUOTA_SETTINGS_NS, TRAE_SETTINGS_NS, TRAE_STATUS_PATH, TRAE_VARIANTS, type TraeAdapter, type TraeAuthStatus, TraeCatalog, TraeCatalogStore, type TraeChatResult, type TraeCredential, type TraeCredentialSource, TraeCredentialStore, type TraeEdition, type TraeHostHeartbeat, TraeLoginClient, type TraeModelInfo, type TraeProbeAction, type TraeProbeRecord, TraeProbeService, type TraeProbeStatus, TraeProbeStore, type TraeProbeValidation, type TraeRegion, type TraeShim, type TraeStorageCandidate, TraeUpstreamClient, type TraeVariant, type TraeWebCatalog, type TraeWebCreditAccount, type TraeWebCredits, type TraeWebLoginAction, type TraeWebLoginRequest, type TraeWebLoginResult, type TraeWebModelBadge, type TraeWebProbeModel, type TraeWebProbeSection, type TraeWebStatus, type UpstreamErrorKind, apply, classifyUpstreamError, clearHostHeartbeat, createLoginKey, createProbeKey, createTraeAdapter, createTraeShim, fallbackModelsFor, fingerprintModel, formatTraeModelDisplayName, getUtc8DateString, inject, isHeartbeatProcessAlive, mergeTraeModelSources, name, newestFirst, parseTraeAuth, parseTraeDocument, probeModel, readHostHeartbeat, refreshTraeCredential, traeHostHeartbeatPath, traeLoginHandler, traePluginDataDir, traeProbeHandler, traeStateDir, traeStatusHandler, traeStorageCandidates, variantFor, variantForRegion, writeHostHeartbeat };