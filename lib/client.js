window.__ModuleLoader__.load({
	id: "dsh-trae-connect",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
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
		//#region src/client/status-document.ts
		/**
		* 判断解析后的响应数据是否为合法的 TraeWebStatus 文档。
		*/
		function isTraeWebStatus(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const wrapped = value;
			const status = wrapped["status"];
			if (status === "signed-out" || status === "signed-in") return true;
			return status === "error" && typeof wrapped["message"] === "string";
		}
		//#endregion
		//#region src/client/quota-settings-store.ts
		let pollIntervalMs = 3e5;
		const toggles = {
			cn: false,
			ai: false
		};
		let togglesSnapshot = {
			cn: false,
			ai: false
		};
		const signIn = {
			cn: false,
			ai: false
		};
		let signInSnapshot = {
			cn: false,
			ai: false
		};
		let revision = 0;
		const listeners = /* @__PURE__ */ new Set();
		function bump() {
			revision += 1;
			for (const listener of listeners) listener();
		}
		/** 更新共享刷新轮询周期 */
		function setQuotaPollMs(ms) {
			if (Number.isFinite(ms) && ms >= 6e4 && pollIntervalMs !== ms) {
				pollIntervalMs = ms;
				bump();
			}
		}
		/** 读取当前配置的刷新间隔 */
		function quotaPollMs() {
			return pollIntervalMs;
		}
		/** 更新侧栏展示开关状态 */
		function setQuotaToggles(cn, ai) {
			if (toggles.cn !== cn || toggles.ai !== ai) {
				toggles.cn = cn;
				toggles.ai = ai;
				togglesSnapshot = { ...toggles };
				bump();
			}
		}
		/** 读取当前侧栏展示开关状态 */
		function quotaToggles() {
			return togglesSnapshot;
		}
		/** 记录指定版本的登录状态 */
		function noteQuotaSignIn(variantId, signedIn) {
			if (variantId === "trae" && signIn.cn !== signedIn) {
				signIn.cn = signedIn;
				signInSnapshot = { ...signIn };
				bump();
			} else if (variantId === "trae-ai" && signIn.ai !== signedIn) {
				signIn.ai = signedIn;
				signInSnapshot = { ...signIn };
				bump();
			}
		}
		/** 读取当前登录状态 */
		function quotaSignInState() {
			return signInSnapshot;
		}
		/** 订阅配置变更 */
		function onQuotaSettingsChange(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		/** 获取当前版本号 */
		function quotaSettingsRevision() {
			return revision;
		}
		/** 根据状态路由判断属于哪个产品版本 */
		function variantOfStatusPath(statusPath) {
			return statusPath.includes("/ai/") ? "trae-ai" : "trae";
		}
		const statusDocuments = {
			cn: void 0,
			ai: void 0
		};
		const statusFetchedAt = {
			cn: void 0,
			ai: void 0
		};
		/** 记录最新拉取到的状态文档并触发订阅通知 */
		function noteQuotaStatus(variantId, status) {
			if (variantId === "trae" && statusDocuments.cn !== status) {
				statusDocuments.cn = status;
				statusFetchedAt.cn = Date.now();
				bump();
			} else if (variantId === "trae-ai" && statusDocuments.ai !== status) {
				statusDocuments.ai = status;
				statusFetchedAt.ai = Date.now();
				bump();
			}
			noteQuotaSignIn(variantId, status.status === "signed-in");
		}
		/** 读取指定版本最新状态文档 */
		function quotaStatus(variantId) {
			return variantId === "trae" ? statusDocuments.cn : statusDocuments.ai;
		}
		/** 读取指定版本状态拉取时间戳 */
		function quotaStatusFetchedAt(variantId) {
			return variantId === "trae" ? statusFetchedAt.cn : statusFetchedAt.ai;
		}
		/** 检查缓存是否在有效期内 */
		function quotaStatusIsFresh(variantId, maxAgeMs) {
			const fetchedAt = variantId === "trae" ? statusFetchedAt.cn : statusFetchedAt.ai;
			const document = variantId === "trae" ? statusDocuments.cn : statusDocuments.ai;
			if (fetchedAt === void 0 || document === void 0) return false;
			return Date.now() - fetchedAt < maxAgeMs;
		}
		//#endregion
		//#region src/client/QuotaSettingsCard.tsx
		/**
		* Trae 侧边栏额度与自动签到全局配置组件。
		*
		* @module dsh-trae-connect/client/quota-settings
		*/
		const POLL_DEFAULT_MS = 3e5;
		const POLL_MIN_MS = 6e4;
		const CHECK_IN_MINUTE_DEFAULT = 600;
		function splitMinutes(minutes) {
			const safe = Number.isFinite(minutes) ? Math.trunc(minutes) : CHECK_IN_MINUTE_DEFAULT;
			const clamped = safe < 0 || safe > 1439 ? CHECK_IN_MINUTE_DEFAULT : safe;
			return {
				hours: Math.floor(clamped / 60),
				minutes: clamped % 60
			};
		}
		function project(scope) {
			if (scope === void 0) return {
				status: "unavailable",
				writable: false,
				values: {
					sidebarQuotaCN: false,
					sidebarQuotaAI: false,
					autoCheckInCN: false,
					autoCheckInAI: false,
					checkInMinuteCN: CHECK_IN_MINUTE_DEFAULT,
					checkInMinuteAI: CHECK_IN_MINUTE_DEFAULT,
					quotaPollMs: POLL_DEFAULT_MS
				}
			};
			const snapshot = scope.getSnapshot();
			const value = snapshot.value ?? {};
			return {
				status: snapshot.status,
				writable: snapshot.writable,
				values: {
					sidebarQuotaCN: value.sidebarQuotaCN === true,
					sidebarQuotaAI: value.sidebarQuotaAI === true,
					autoCheckInCN: value.autoCheckInCN === true,
					autoCheckInAI: value.autoCheckInAI === true,
					checkInMinuteCN: typeof value.checkInMinuteCN === "number" ? value.checkInMinuteCN : CHECK_IN_MINUTE_DEFAULT,
					checkInMinuteAI: typeof value.checkInMinuteAI === "number" ? value.checkInMinuteAI : CHECK_IN_MINUTE_DEFAULT,
					quotaPollMs: typeof value.quotaPollMs === "number" ? value.quotaPollMs : POLL_DEFAULT_MS
				}
			};
		}
		let cachedScope;
		let cachedProjection;
		const UNAVAILABLE = {
			status: "unavailable",
			writable: false,
			values: {
				sidebarQuotaCN: false,
				sidebarQuotaAI: false,
				autoCheckInCN: false,
				autoCheckInAI: false,
				checkInMinuteCN: CHECK_IN_MINUTE_DEFAULT,
				checkInMinuteAI: CHECK_IN_MINUTE_DEFAULT,
				quotaPollMs: POLL_DEFAULT_MS
			}
		};
		function stableProject(scope) {
			if (scope === void 0) return UNAVAILABLE;
			const next = project(scope);
			if (cachedProjection === void 0 || cachedScope !== scope || cachedProjection.status !== next.status || cachedProjection.writable !== next.writable || cachedProjection.values.sidebarQuotaCN !== next.values.sidebarQuotaCN || cachedProjection.values.sidebarQuotaAI !== next.values.sidebarQuotaAI || cachedProjection.values.autoCheckInCN !== next.values.autoCheckInCN || cachedProjection.values.autoCheckInAI !== next.values.autoCheckInAI || cachedProjection.values.checkInMinuteCN !== next.values.checkInMinuteCN || cachedProjection.values.checkInMinuteAI !== next.values.checkInMinuteAI || cachedProjection.values.quotaPollMs !== next.values.quotaPollMs) {
				cachedScope = scope;
				cachedProjection = next;
			}
			return cachedProjection;
		}
		function ToggleRow({ label, hint, checked, disabled, disabledHint, onToggle }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rowStyle$1,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: rowTextStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelStyle$1,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: hintStyle,
						children: disabled === true && disabledHint !== void 0 ? disabledHint : hint
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					role: "switch",
					"aria-checked": checked,
					disabled,
					"aria-label": label,
					onClick: () => {
						if (disabled) return;
						onToggle(!checked);
					},
					style: {
						...switchStyle,
						background: checked ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.2))",
						justifyContent: checked ? "flex-end" : "flex-start",
						opacity: disabled === true ? .45 : 1,
						cursor: disabled === true ? "not-allowed" : "pointer"
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: knobStyle })
				})]
			});
		}
		function TimeRow({ label, hint, value, disabled, onPick }) {
			const split = splitMinutes(value);
			const [hourDraft, setHourDraft] = (0, react.useState)(String(split.hours));
			const [minuteDraft, setMinuteDraft] = (0, react.useState)(String(split.minutes).padStart(2, "0"));
			(0, react.useEffect)(() => {
				const next = splitMinutes(value);
				setHourDraft(String(next.hours));
				setMinuteDraft(String(next.minutes).padStart(2, "0"));
			}, [value]);
			const commit = () => {
				const parsedHours = Number.parseInt(hourDraft, 10);
				const parsedMinutes = Number.parseInt(minuteDraft, 10);
				const hours = Number.isFinite(parsedHours) ? Math.min(23, Math.max(0, parsedHours)) : split.hours;
				const minutes = Number.isFinite(parsedMinutes) ? Math.min(59, Math.max(0, parsedMinutes)) : split.minutes;
				const next = hours * 60 + minutes;
				if (next === value) {
					setHourDraft(String(hours));
					setMinuteDraft(String(minutes).padStart(2, "0"));
					return;
				}
				onPick(next);
			};
			const onKeyDown = (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					commit();
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rowStyle$1,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: rowTextStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelStyle$1,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: hintStyle,
						children: hint
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: pollFieldStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 0,
							max: 23,
							value: hourDraft,
							disabled,
							"aria-label": `${label} — hour`,
							"data-checkin-part": "hour",
							onChange: (event) => {
								setHourDraft(event.target.value);
							},
							onBlur: commit,
							onKeyDown,
							style: {
								...timePartStyle,
								opacity: disabled === true ? .45 : 1
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: labelStyle$1,
							children: ":"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 0,
							max: 59,
							value: minuteDraft,
							disabled,
							"aria-label": `${label} — minute`,
							"data-checkin-part": "minute",
							onChange: (event) => {
								setMinuteDraft(event.target.value);
							},
							onBlur: commit,
							onKeyDown,
							style: {
								...timePartStyle,
								opacity: disabled === true ? .45 : 1
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: hintStyle,
							children: "UTC+8"
						})
					]
				})]
			});
		}
		function QuotaSettingsContent({ t = (key) => key, scope, signedIn }) {
			const subscribe = (0, react.useCallback)((onStoreChange) => {
				return scope?.subscribe(onStoreChange) ?? (() => {});
			}, [scope]);
			const projection = (0, react.useSyncExternalStore)(subscribe, () => stableProject(scope));
			const liveSignIn = (0, react.useSyncExternalStore)(onQuotaSettingsChange, quotaSignInState);
			const [probe, setProbe] = (0, react.useState)();
			(0, react.useEffect)(() => {
				let disposed = false;
				const probeOne = async (path) => {
					try {
						const body = await (await fetch(path, { headers: { accept: "application/json" } })).json();
						if (disposed || !isTraeWebStatus(body)) return void 0;
						noteQuotaSignIn(variantOfStatusPath(path), body.status === "signed-in");
						return body.status === "signed-in";
					} catch {
						return;
					}
				};
				(async () => {
					const [cn, ai] = await Promise.all([probeOne(TRAE_STATUS_PATH), probeOne(TRAE_AI_STATUS_PATH)]);
					if (!disposed) setProbe({
						cn: cn === true,
						ai: ai === true
					});
				})();
				return () => {
					disposed = true;
				};
			}, []);
			if (projection.status === "unavailable") return null;
			const reported = signedIn?.();
			const deriveSigned = (variant, variantId) => {
				if (reported !== void 0) return Boolean(reported[variant]);
				const currentStatus = quotaStatus(variantId);
				if (currentStatus?.status === "signed-out") return false;
				const live = liveSignIn[variant];
				if (probe !== void 0) {
					if (!probe[variant]) return Boolean(live && currentStatus?.status === "signed-in");
					return Boolean(live);
				}
				return Boolean(live && currentStatus?.status === "signed-in");
			};
			const signed = {
				cn: deriveSigned("cn", "trae"),
				ai: deriveSigned("ai", "trae-ai")
			};
			const write = (field, value) => {
				if (field === "sidebarQuotaCN" && value === true && !signed.cn) return;
				if (field === "sidebarQuotaAI" && value === true && !signed.ai) return;
				if (field === "autoCheckInCN" && value === true && !signed.cn) return;
				if (field === "autoCheckInAI" && value === true && !signed.ai) return;
				scope?.set(field, value);
			};
			const minutes = Math.max(POLL_MIN_MS / 6e4, Math.round(projection.values.quotaPollMs / 6e4));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 4
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
						label: t("quotaToggleCN"),
						hint: t("quotaToggleHint"),
						checked: projection.values.sidebarQuotaCN,
						disabled: !signed.cn,
						disabledHint: t("quotaSignInRequired"),
						onToggle: (next) => write("sidebarQuotaCN", next)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
						label: t("quotaToggleAI"),
						hint: t("quotaToggleHint"),
						checked: projection.values.sidebarQuotaAI,
						disabled: !signed.ai,
						disabledHint: t("quotaSignInRequired"),
						onToggle: (next) => write("sidebarQuotaAI", next)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
						label: t("autoCheckInCN"),
						hint: t("autoCheckInHintCN"),
						checked: projection.values.autoCheckInCN,
						disabled: !signed.cn,
						disabledHint: t("quotaSignInRequired"),
						onToggle: (next) => write("autoCheckInCN", next)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TimeRow, {
						label: t("checkInTimeCN"),
						hint: t("checkInTimeHint"),
						value: projection.values.checkInMinuteCN,
						disabled: !signed.cn,
						onPick: (next) => write("checkInMinuteCN", next)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToggleRow, {
						label: t("autoCheckInAI"),
						hint: t("autoCheckInHintAI"),
						checked: projection.values.autoCheckInAI,
						disabled: !signed.ai,
						disabledHint: t("quotaSignInRequired"),
						onToggle: (next) => write("autoCheckInAI", next)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TimeRow, {
						label: t("checkInTimeAI"),
						hint: t("checkInTimeHint"),
						value: projection.values.checkInMinuteAI,
						disabled: !signed.ai,
						onPick: (next) => write("checkInMinuteAI", next)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							...rowStyle$1,
							borderBottom: "none",
							paddingBottom: 0
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: rowTextStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: labelStyle$1,
								children: t("quotaPollLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: hintStyle,
								children: t("quotaPollHint")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: pollFieldStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "number",
								min: POLL_MIN_MS / 6e4,
								step: 1,
								value: minutes,
								"aria-label": t("quotaPollLabel"),
								onChange: (event) => {
									const mins = Number.parseInt(event.target.value, 10);
									if (Number.isFinite(mins) && mins > 0) write("quotaPollMs", Math.max(POLL_MIN_MS, mins * 6e4));
								},
								style: inputStyle
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: hintStyle,
								children: t("quotaPollUnit")
							})]
						})]
					}),
					projection.writable === false ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: hintStyle,
						children: t("quotaSettingsSaveFailed")
					}) : null
				]
			});
		}
		const rowStyle$1 = {
			display: "flex",
			alignItems: "center",
			gap: 12,
			borderBottom: ".5px solid var(--dsw-alias-border-l2)",
			paddingBottom: 10
		};
		const rowTextStyle = {
			display: "flex",
			flex: 1,
			minWidth: 0,
			flexDirection: "column",
			gap: 2
		};
		const labelStyle$1 = {
			fontSize: 13,
			fontWeight: 500,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-primary)"
		};
		const hintStyle = {
			fontSize: 12,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const switchStyle = {
			flex: "none",
			display: "flex",
			width: 36,
			height: 20,
			borderRadius: 10,
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--dsw-alias-border-l2)",
			padding: 1,
			cursor: "pointer",
			alignItems: "center",
			transition: "background .16s"
		};
		const knobStyle = {
			display: "block",
			width: 16,
			height: 16,
			borderRadius: "50%",
			background: "var(--dsw-alias-bg-layer-1, #fff)",
			boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
		};
		const pollFieldStyle = {
			display: "flex",
			alignItems: "center",
			gap: 6,
			flex: "none"
		};
		const timePartStyle = {
			boxSizing: "border-box",
			width: 56,
			padding: "5px 8px",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			textAlign: "center"
		};
		const inputStyle = {
			boxSizing: "border-box",
			width: 55,
			padding: "5px 8px",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-2)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 13,
			textAlign: "right"
		};
		//#endregion
		//#region src/client/TraePluginCard.tsx
		/**
		* Trae 插件主配置卡片组件，支持像素级对齐 dsh-workbuddy-connect 的全功能与布局。
		*
		* @module dsh-trae-connect/client/trae-plugin-card
		*/
		const CN_CARD_VARIANT = {
			id: "trae",
			titleKey: "title",
			introKey: "intro",
			signedOutKey: "signedOutHint",
			statusPath: TRAE_STATUS_PATH,
			probePath: TRAE_PROBE_PATH,
			loginPath: TRAE_LOGIN_PATH
		};
		const AI_CARD_VARIANT = {
			id: "trae-ai",
			titleKey: "titleAI",
			introKey: "introAI",
			signedOutKey: "signedOutHintAI",
			statusPath: TRAE_AI_STATUS_PATH,
			probePath: TRAE_AI_PROBE_PATH,
			loginPath: TRAE_AI_LOGIN_PATH
		};
		const CARD_VARIANTS = [CN_CARD_VARIANT, AI_CARD_VARIANT];
		const POLL_INTERVAL_MS = 6e4;
		const cardStyle = {
			listStyle: "none",
			borderWidth: "0.5px",
			borderStyle: "solid",
			borderColor: "var(--dsw-alias-border-l4)",
			borderRadius: 16,
			background: "var(--dsw-alias-bg-layer-3)",
			transition: "border-color .16s, background .16s"
		};
		const cardHoverStyle = { borderColor: "var(--dsw-alias-label-dimmed)" };
		const cardOpenStyle = {
			background: "var(--dsw-alias-bg-layer-2)",
			borderColor: "var(--dsw-alias-label-dimmed)"
		};
		const headerStyle = {
			boxSizing: "border-box",
			width: "100%",
			display: "flex",
			alignItems: "center",
			gap: 12,
			borderWidth: 0,
			borderStyle: "solid",
			borderColor: "transparent",
			borderRadius: 12,
			padding: "14px 16px",
			background: "transparent",
			color: "inherit",
			font: "inherit",
			textAlign: "left",
			cursor: "pointer",
			appearance: "none"
		};
		const headerFocusStyle = {
			outline: "2px solid var(--dsw-alias-brand-primary)",
			outlineOffset: -2
		};
		const headTextStyle = {
			display: "flex",
			flex: 1,
			minWidth: 0,
			flexDirection: "column",
			gap: 4
		};
		const nameStyle = {
			fontSize: 15,
			lineHeight: 1.4,
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const descriptionStyle = {
			fontSize: 13,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-tertiary)"
		};
		function ChevronDownIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 14 14",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
					fill: "currentColor"
				})
			});
		}
		const chevronStyle = {
			flex: "none",
			display: "flex",
			color: "var(--dsw-alias-label-tertiary)",
			transition: "transform .16s"
		};
		const cardBodyStyle = {
			borderTop: ".5px solid var(--dsw-alias-border-l2)",
			margin: "0 16px",
			padding: "12px 0 8px"
		};
		const bodyStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const rowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			flexWrap: "wrap",
			gap: 12
		};
		const statusStyle = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			fontSize: 13,
			fontWeight: 500,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-primary)"
		};
		const buttonStyle$1 = {
			boxSizing: "border-box",
			padding: "5px 14px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			fontSize: 13,
			lineHeight: 1.5,
			cursor: "pointer"
		};
		const errorStyle = {
			...bodyStyle,
			color: "var(--dsw-alias-state-error-primary)"
		};
		const quotaListStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 18,
			paddingTop: 2
		};
		const quotaGroupStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10
		};
		const quotaTitleStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: 1.5,
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const quotaLabelStyle = {
			display: "flex",
			justifyContent: "space-between",
			gap: 12,
			fontSize: 13,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-secondary)"
		};
		const modelBadgeStyle = {
			display: "flex",
			alignItems: "center",
			gap: 6,
			flexWrap: "wrap"
		};
		const modelOfferStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 2
		};
		const modelRateStyle = {
			fontSize: 12,
			lineHeight: 1.5,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const contextPreferenceStyle = {
			display: "flex",
			alignItems: "flex-start",
			gap: 9,
			padding: "10px 12px",
			border: ".5px solid var(--dsw-alias-border-l4)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-3)",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 13,
			lineHeight: 1.5
		};
		const contextPreferenceCopyStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 2
		};
		const contextPickerRowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 8,
			flexWrap: "wrap"
		};
		const modelBadgeChipStyle = {
			padding: "1px 8px",
			borderRadius: 999,
			fontSize: 11,
			lineHeight: "18px",
			background: "var(--dsw-alias-state-success-tertiary)",
			color: "var(--dsw-alias-state-success-primary)"
		};
		function modelBadgeLabel(badge, t) {
			if (badge === "限时免费") return t("badgeLimitedFree");
			if (badge === "夜间折扣") return t("badgeNightDiscount");
			if (badge === "Free now") return t("badgeFreeNow");
			return badge;
		}
		const progressTrackStyle = {
			height: 8,
			overflow: "hidden",
			borderRadius: 999,
			background: "var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.08))"
		};
		const confirmBoxStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			padding: "10px 12px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1)"
		};
		const confirmRowStyle$1 = {
			display: "flex",
			justifyContent: "flex-end",
			gap: 8
		};
		const probeRowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12
		};
		const probeRowEndStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 8,
			flex: "0 0 auto"
		};
		const tabBarStyle = {
			display: "flex",
			gap: 4,
			marginTop: 4,
			borderBottom: "1px solid var(--dsw-alias-border-l2)"
		};
		const tabStyle = {
			padding: "6px 12px",
			border: 0,
			borderBottom: "2px solid transparent",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			font: "inherit",
			fontSize: 13,
			lineHeight: "20px",
			cursor: "pointer"
		};
		const tabActiveStyle = {
			borderBottom: "2px solid var(--dsw-alias-brand-primary)",
			color: "var(--dsw-alias-label-primary)",
			fontWeight: 600
		};
		const tabPanelStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 18,
			paddingTop: 16
		};
		const segmentedContainerStyle = {
			display: "flex",
			alignItems: "center",
			background: "var(--dsw-alias-bg-layer-1, rgba(20, 20, 20, 0.6))",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.08))",
			borderRadius: 8,
			padding: 3,
			gap: 4,
			marginTop: 14,
			marginBottom: 16
		};
		function segmentedTabItemStyle(active) {
			return {
				flex: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				padding: "6px 12px",
				borderRadius: 6,
				borderWidth: "1px",
				borderStyle: "solid",
				borderColor: active ? "var(--dsw-alias-border-l4, rgba(255, 255, 255, 0.18))" : "transparent",
				background: active ? "var(--dsw-alias-bg-layer-3, rgba(255, 255, 255, 0.08))" : "transparent",
				color: active ? "var(--dsw-alias-label-primary, #fff)" : "var(--dsw-alias-label-tertiary, #8c8c8c)",
				fontWeight: active ? 500 : 400,
				fontSize: 13,
				lineHeight: "18px",
				cursor: "pointer",
				appearance: "none",
				outline: "none",
				transition: "all .16s ease"
			};
		}
		const primaryButtonStyle$1 = {
			...buttonStyle$1,
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--dsw-alias-button-primary-fill)",
			background: "var(--dsw-alias-button-primary-fill)",
			color: "var(--dsw-alias-label-primary-foreground)"
		};
		function progressFillStyle(percent) {
			return {
				width: `${Math.max(0, Math.min(100, percent))}%`,
				height: "100%",
				borderRadius: "inherit",
				background: "var(--dsw-alias-brand-primary, #1677ff)"
			};
		}
		function dotStyle(status) {
			return {
				width: 8,
				height: 8,
				borderRadius: "50%",
				flex: "0 0 auto",
				background: status === "signed-in" ? "var(--dsw-alias-state-success-primary, #22a06b)" : status === "error" ? "var(--dsw-alias-state-error-primary, #d92d20)" : "var(--dsw-alias-label-dimmed, #9aa0a6)"
			};
		}
		function formatNumber(value) {
			return new Intl.NumberFormat(void 0).format(value);
		}
		function formatTime(ms) {
			return new Intl.DateTimeFormat(void 0, {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(new Date(ms));
		}
		function formatCycleReset(time) {
			const parsed = Date.parse(time);
			if (!Number.isNaN(parsed)) return formatTime(parsed);
			return time;
		}
		function CreditBar({ label, remain, size, unlimited, t }) {
			if (unlimited === true) {
				const quotaText = t("unlimitedQuota");
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: quotaGroupStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: quotaLabelStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: quotaText })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: progressTrackStyle,
							role: "progressbar",
							"aria-label": label,
							"aria-valuetext": quotaText
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: bodyStyle,
							children: quotaText
						})
					]
				});
			}
			const sizeKnown = size > 0;
			const detail = sizeKnown ? t("exactRemaining", {
				remain: formatNumber(remain),
				size: formatNumber(size)
			}) : t("creditPackageUnknownSize", { remain: formatNumber(remain) });
			const percent = sizeKnown ? remain / size * 100 : void 0;
			const display = percent === void 0 ? t("percentUnknown") : t("percentRemaining", { percent: new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(percent) });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: quotaGroupStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: quotaLabelStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: display })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: progressTrackStyle,
						role: "progressbar",
						"aria-label": label,
						...percent === void 0 ? { "aria-valuetext": detail } : {
							"aria-valuemin": 0,
							"aria-valuemax": 100,
							"aria-valuenow": percent
						},
						children: percent === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: progressFillStyle(percent) })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: bodyStyle,
						children: detail
					})
				]
			});
		}
		function ModelOfferRow({ model, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: modelOfferStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: quotaLabelStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: model.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: modelBadgeStyle,
						children: [model.badges?.map((badge) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: modelBadgeChipStyle,
							children: modelBadgeLabel(badge, t)
						}, badge)), model.free === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: modelBadgeChipStyle,
							children: t("freeModel")
						}) : null]
					})]
				}), model.credits === void 0 ? model.rateUnknown === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: modelRateStyle,
					children: t("rateUnknown")
				}) : null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: modelRateStyle,
					children: t("rate", { rate: model.credits })
				})]
			});
		}
		function ContextTable({ models, t, useMaximumContextWindow, disabled, onUseMaximumContextWindow }) {
			const known = (models ?? []).filter((model) => model.contextWindow !== void 0).sort((a, b) => b.contextWindow - a.contextWindow);
			const showPreference = onUseMaximumContextWindow !== void 0;
			if (known.length === 0 && !showPreference) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: quotaListStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: quotaTitleStyle,
						children: t("contextHeading")
					}),
					showPreference && onUseMaximumContextWindow !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: contextPreferenceStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: useMaximumContextWindow === true,
							disabled,
							onChange: (event) => {
								onUseMaximumContextWindow(event.currentTarget.checked);
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: contextPreferenceCopyStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("useMaximumContextWindow") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: modelRateStyle,
								children: t("useMaximumContextWindowHint")
							})]
						})]
					}) : null,
					known.map((model) => {
						const capacity = model.contextWindow;
						const alternative = model.maxContextWindow !== void 0 && model.maxContextWindow > capacity ? model.maxContextWindow : void 0;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: quotaLabelStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: model.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: contextPickerRowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: formatTokens(capacity) }), alternative !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: modelRateStyle,
									children: t("contextUpTo", { size: formatTokens(alternative) })
								}) : model.defaultContextWindow !== void 0 && model.defaultContextWindow < capacity ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: modelRateStyle,
									children: t("contextDefault", { size: formatTokens(model.defaultContextWindow) })
								}) : null]
							})]
						}, model.id);
					})
				]
			});
		}
		function formatTokens(tokens) {
			if (tokens >= 1e6 && tokens % 1e6 === 0) return `${tokens / 1e6}M`;
			if (tokens >= 1e3 && tokens % 1e3 === 0) return `${tokens / 1e3}K`;
			return String(tokens);
		}
		function ModelTogglesSection({ models, disabledModels = [], t, disabled, onToggleModel, onSetDisabledModels }) {
			const [search, setSearch] = (0, react.useState)("");
			const disabledSet = new Set(disabledModels);
			const allModels = models ?? [];
			const query = search.trim().toLowerCase();
			const filtered = query === "" ? allModels : allModels.filter((m) => m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query));
			const enabledCount = allModels.filter((m) => !disabledSet.has(m.id)).length;
			const totalCount = allModels.length;
			const filteredEnabledCount = filtered.filter((m) => !disabledSet.has(m.id)).length;
			const allFilteredEnabled = filtered.length > 0 && filteredEnabledCount === filtered.length;
			const someFilteredEnabled = filteredEnabledCount > 0 && filteredEnabledCount < filtered.length;
			const handleSelectAllCheckbox = (checked) => {
				if (checked) {
					const filteredIds = new Set(filtered.map((m) => m.id));
					onSetDisabledModels(disabledModels.filter((id) => !filteredIds.has(id)));
				} else onSetDisabledModels(Array.from(/* @__PURE__ */ new Set([...disabledModels, ...filtered.map((m) => m.id)])));
			};
			const handleEnableAll = () => {
				const filteredIds = new Set(filtered.map((m) => m.id));
				onSetDisabledModels(disabledModels.filter((id) => !filteredIds.has(id)));
			};
			const handleDisableAll = () => {
				onSetDisabledModels(Array.from(/* @__PURE__ */ new Set([...disabledModels, ...filtered.map((m) => m.id)])));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: quotaListStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: rowStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: bodyStyle,
							children: t("modelsEnabledCount", {
								enabled: enabledCount,
								total: totalCount
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: 8,
								alignItems: "center"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: buttonStyle$1,
								disabled: disabled || filtered.length === 0,
								onClick: handleEnableAll,
								children: t("modelsEnableAll")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: buttonStyle$1,
								disabled: disabled || filtered.length === 0,
								onClick: handleDisableAll,
								children: t("modelsDisableAll")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							display: "flex",
							gap: 10,
							alignItems: "center"
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "text",
							value: search,
							onChange: (e) => {
								setSearch(e.target.value);
							},
							placeholder: t("modelsSearchPlaceholder"),
							style: {
								flex: 1,
								boxSizing: "border-box",
								padding: "6px 12px",
								border: "1px solid var(--dsw-alias-border-l2)",
								borderRadius: 8,
								background: "var(--dsw-alias-bg-layer-2)",
								color: "var(--dsw-alias-label-primary)",
								fontSize: 13,
								outline: "none"
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							padding: "4px 0",
							borderBottom: "1px solid var(--dsw-alias-border-l2)"
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 8,
								cursor: disabled || filtered.length === 0 ? "default" : "pointer",
								fontSize: 13,
								color: "var(--dsw-alias-label-secondary)"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								disabled: disabled || filtered.length === 0,
								checked: allFilteredEnabled,
								ref: (el) => {
									if (el) el.indeterminate = someFilteredEnabled;
								},
								onChange: (e) => {
									handleSelectAllCheckbox(e.currentTarget?.checked ?? e.target.checked);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("modelsSelectAll") })]
						})
					}),
					filtered.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: bodyStyle,
						children: t("modelsNoMatch")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: 8
						},
						children: filtered.map((model) => {
							const isEnabled = !disabledSet.has(model.id);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "8px 10px",
									borderRadius: 8,
									background: "var(--dsw-alias-bg-layer-2)",
									border: "1px solid var(--dsw-alias-border-l2)"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										flexDirection: "column",
										gap: 2,
										minWidth: 0,
										flex: 1
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											display: "flex",
											alignItems: "center",
											gap: 8,
											flexWrap: "wrap"
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													fontSize: 13,
													fontWeight: 500,
													color: "var(--dsw-alias-label-primary)"
												},
												children: model.name
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												style: {
													fontSize: 11,
													color: "var(--dsw-alias-label-tertiary)"
												},
												children: [
													"(",
													model.id,
													")"
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												style: modelBadgeStyle,
												children: [model.badges?.map((badge) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: modelBadgeChipStyle,
													children: modelBadgeLabel(badge, t)
												}, badge)), model.free === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: modelBadgeChipStyle,
													children: t("freeModel")
												}) : null]
											})
										]
									}), model.credits !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: modelRateStyle,
										children: t("rate", { rate: model.credits })
									}) : model.rateUnknown === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: modelRateStyle,
										children: t("rateUnknown")
									}) : null]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									style: {
										display: "flex",
										alignItems: "center",
										gap: 6,
										cursor: disabled ? "default" : "pointer",
										flexShrink: 0
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: isEnabled,
										disabled,
										onChange: (e) => {
											onToggleModel(model.id, e.currentTarget?.checked ?? e.target.checked);
										}
									})
								})]
							}, model.id);
						})
					})
				]
			});
		}
		function ProbeSection({ probe, t, onDetect, onClear, busy }) {
			const [pending, setPending] = (0, react.useState)();
			const [runningModel, setRunningModel] = (0, react.useState)();
			(0, react.useEffect)(() => {
				if (pending !== void 0 && !probe.candidates.includes(pending)) setPending(void 0);
			}, [pending, probe.candidates]);
			const runningArmed = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (runningModel === void 0) return;
				if (busy || probe.running) {
					runningArmed.current = true;
					return;
				}
				if (!runningArmed.current) return;
				runningArmed.current = false;
				setRunningModel(void 0);
			}, [
				runningModel,
				busy,
				probe.running
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: quotaListStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: quotaTitleStyle,
						children: t("probeHeading")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: bodyStyle,
						children: t("probeIntro")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: bodyStyle,
						children: t("probeConsentHint")
					}),
					probe.running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: bodyStyle,
						children: t("probeRunningGeneric")
					}) : null,
					probe.candidates.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: bodyStyle,
						children: t("probeResultEmpty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: quotaGroupStyle,
						children: probe.candidates.map((id) => {
							const result = probe.results.find((entry) => entry.id === id);
							const name = result?.name ?? id;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: modelOfferStyle,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: probeRowStyle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: name }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											style: probeRowEndStyle,
											children: [result === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: modelBadgeChipStyle,
												children: result.validation === "validating" && result.efforts.length > 0 ? result.efforts.join(" / ") : t(result.validation === "non-validating" ? "probeResultNotValidating" : "probeResultUnknown")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: buttonStyle$1,
												disabled: probe.running || busy,
												onClick: () => {
													setPending(id);
												},
												children: runningModel === id ? t("probeRunning", { model: id }) : t(result === void 0 ? "probeStart" : "probeRedetect")
											})]
										})]
									}),
									result === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: modelRateStyle,
										children: t("probeResultAt", { time: formatTime(result.probedAt) })
									}),
									pending === id ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: confirmBoxStyle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: bodyStyle,
											children: t("probeConfirmBody", { model: name })
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: confirmRowStyle$1,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: buttonStyle$1,
												onClick: () => {
													setPending(void 0);
												},
												children: t("cancel")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												style: primaryButtonStyle$1,
												disabled: probe.running || busy,
												onClick: () => {
													setRunningModel(id);
													setPending(void 0);
													onDetect(id);
												},
												children: t("probeConfirmAction")
											})]
										})]
									}) : null
								]
							}, id);
						})
					}),
					probe.results.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: buttonStyle$1,
						disabled: busy,
						onClick: () => {
							onClear();
						},
						children: t("probeClear")
					})
				]
			});
		}
		function CheckInLogTable({ logs = [], t, onCheckIn, onRefresh, onClear, busy, checkingIn, clearing, disabled, notice, nextRun }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: quotaListStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							flexWrap: "wrap",
							gap: 8
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							style: quotaTitleStyle,
							children: t("tabCheckIn")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 6
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle$1,
									disabled: disabled || busy || checkingIn,
									onClick: onCheckIn,
									children: checkingIn ? t("checkInChecking") : t("checkInNow")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle$1,
									disabled: busy || checkingIn,
									onClick: onRefresh,
									children: busy ? t("checkInRefreshing") : t("checkInRefresh")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle$1,
									disabled: busy || clearing || !logs || logs.length === 0,
									onClick: onClear,
									children: clearing ? t("checkInClearing") : t("checkInClear")
								})
							]
						})]
					}),
					notice === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							marginTop: 8,
							marginBottom: 8,
							padding: "8px 12px",
							borderRadius: 8,
							fontSize: 13,
							lineHeight: "18px",
							background: notice.includes("成功") || notice.includes("已完成") || notice.includes("已自动签到") ? "rgba(82, 196, 26, 0.12)" : notice.includes("无") || notice.includes("暂无") ? "rgba(127, 127, 127, 0.12)" : "rgba(255, 77, 79, 0.12)",
							border: "1px solid " + (notice.includes("成功") || notice.includes("已完成") || notice.includes("已自动签到") ? "rgba(82, 196, 26, 0.35)" : notice.includes("无") || notice.includes("暂无") ? "rgba(127, 127, 127, 0.35)" : "rgba(255, 77, 79, 0.35)"),
							color: notice.includes("成功") || notice.includes("已完成") || notice.includes("已自动签到") ? "var(--dsw-alias-status-success, #52c41a)" : notice.includes("无") || notice.includes("暂无") ? "var(--dsw-alias-label-secondary, #888)" : "var(--dsw-alias-status-error, #f5222d)"
						},
						children: notice
					}),
					nextRun === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: descriptionStyle,
						children: t("checkInNextRun", { time: formatTime(nextRun) })
					}),
					!logs || logs.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: descriptionStyle,
						children: t("checkInLogEmpty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: 6
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.15))",
								paddingBottom: 6,
								fontSize: 12,
								color: "var(--dsw-alias-label-tertiary)"
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { flex: 2 },
									children: t("checkInLogTime")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: { flex: 3 },
									children: t("checkInLogResult")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										flex: 1,
										textAlign: "right"
									},
									children: t("checkInLogAmount")
								})
							]
						}), logs.map((log) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								padding: "6px 0",
								fontSize: 13,
								borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.08))"
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										flex: 2,
										color: "var(--dsw-alias-label-secondary)"
									},
									children: formatTime(log.timestamp)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										flex: 3,
										display: "flex",
										alignItems: "center",
										gap: 6
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
										width: 6,
										height: 6,
										borderRadius: "50%",
										flexShrink: 0,
										background: log.status === "claimed" ? "var(--dsw-alias-status-success, #52c41a)" : log.status === "already-claimed" ? "var(--dsw-alias-status-info, #1890ff)" : log.status === "no-campaign" ? "var(--dsw-alias-label-tertiary, #999)" : "var(--dsw-alias-status-error, #f5222d)"
									} }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: log.status === "claimed" ? t("autoCheckInStatusClaimed", { amount: log.amount ?? 100 }) : log.status === "already-claimed" ? t("autoCheckInStatusAlready") : log.status === "no-campaign" ? t("autoCheckInStatusNoCampaign") : t("autoCheckInStatusError", { message: log.message ?? "" }) })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										flex: 1,
										textAlign: "right",
										fontWeight: 600,
										color: log.amount ? "var(--dsw-alias-brand-primary)" : "inherit"
									},
									children: log.amount ? `+${log.amount}` : "-"
								})
							]
						}, log.id))]
					})
				]
			});
		}
		function TraePluginCard(props) {
			const { t, scope, signedIn, variant, unified } = props;
			if (t === void 0) throw new Error("Trae plugin card requires its translation function");
			const isUnified = unified === true;
			const liveSignIn = (0, react.useSyncExternalStore)(onQuotaSettingsChange, quotaSignInState);
			const [activeVariantId, setActiveVariantId] = (0, react.useState)("trae");
			const currentVariant = isUnified ? activeVariantId === "trae" ? CN_CARD_VARIANT : AI_CARD_VARIANT : variant ?? CN_CARD_VARIANT;
			const [open, setOpen] = (0, react.useState)(false);
			const [hovered, setHovered] = (0, react.useState)(false);
			const [headerFocused, setHeaderFocused] = (0, react.useState)(false);
			const [status, setStatus] = (0, react.useState)();
			const [signedInState, setSignedInState] = (0, react.useState)();
			const [readFailure, setReadFailure] = (0, react.useState)();
			const [busy, setBusy] = (0, react.useState)(false);
			const [signIn, setSignIn] = (0, react.useState)();
			const [signInError, setSignInError] = (0, react.useState)();
			const [importNotice, setImportNotice] = (0, react.useState)();
			const importInput = (0, react.useRef)(null);
			const [tab, setTab] = (0, react.useState)("status");
			const [checkingIn, setCheckingIn] = (0, react.useState)(false);
			const [clearingLogs, setClearingLogs] = (0, react.useState)(false);
			const [checkInNotice, setCheckInNotice] = (0, react.useState)();
			const mounted = (0, react.useRef)(true);
			const readSeq = (0, react.useRef)(0);
			const manualControllers = (0, react.useRef)(/* @__PURE__ */ new Set());
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
					for (const controller of manualControllers.current) controller.abort();
					manualControllers.current.clear();
				};
			}, []);
			const trackController = (0, react.useCallback)(() => {
				const controller = new AbortController();
				manualControllers.current.add(controller);
				return controller;
			}, []);
			const actionKey = status === void 0 || status.status === "error" ? void 0 : status.loginKey;
			const refresh = (0, react.useCallback)(async (signal, force) => {
				const seq = ++readSeq.current;
				const current = () => mounted.current && signal?.aborted !== true && seq === readSeq.current;
				try {
					const url = force ? `${currentVariant.statusPath}?refresh=1` : currentVariant.statusPath;
					const response = await fetch(url, {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					if (!isTraeWebStatus(value)) throw new Error(t("statusResponseInvalid"));
					if (!current()) return false;
					setStatus(value);
					if (value.status === "signed-in") {
						setSignedInState(true);
						noteQuotaStatus(currentVariant.id, value);
					} else if (value.status === "signed-out") {
						setSignedInState(false);
						noteQuotaStatus(currentVariant.id, value);
					}
					setReadFailure(void 0);
					return true;
				} catch (error) {
					const message = error instanceof Error ? error.message : t("requestFailed");
					if (current()) {
						setReadFailure(message);
						setStatus((previous) => previous === void 0 ? {
							status: "error",
							message
						} : previous);
					}
					return false;
				}
			}, [
				currentVariant.statusPath,
				currentVariant.id,
				t
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				setStatus(void 0);
				setSignedInState(void 0);
				setReadFailure(void 0);
				setSignIn(void 0);
				setSignInError(void 0);
				setImportNotice(void 0);
				setCheckInNotice(void 0);
				setClearingLogs(false);
				const controller = new AbortController();
				refresh(controller.signal, true);
				return () => {
					controller.abort();
				};
			}, [
				open,
				currentVariant.statusPath,
				refresh
			]);
			(0, react.useEffect)(() => {
				if (!open || signedInState === false) return;
				const controller = new AbortController();
				const timer = window.setInterval(() => {
					refresh(controller.signal);
				}, POLL_INTERVAL_MS);
				return () => {
					window.clearInterval(timer);
					controller.abort();
				};
			}, [
				open,
				refresh,
				signedInState
			]);
			const manualRefresh = async () => {
				setBusy(true);
				const controller = trackController();
				try {
					await refresh(controller.signal, true);
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setBusy(false);
				}
			};
			const refreshModels = (0, react.useCallback)(async () => {
				const key = status?.status === "signed-in" ? status.probeKey : void 0;
				if (key === void 0) return;
				setBusy(true);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.probePath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Trae-Probe-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({ action: "refresh" })
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setReadFailure(error instanceof Error ? error.message : t("requestFailed"));
					manualControllers.current.delete(controller);
					return;
				} finally {
					if (mounted.current) setBusy(false);
				}
				try {
					await refresh(controller.signal);
				} finally {
					manualControllers.current.delete(controller);
				}
			}, [
				currentVariant.probePath,
				refresh,
				status,
				t,
				trackController
			]);
			const control = (0, react.useCallback)(async (action) => {
				const key = status?.status === "signed-in" ? status.probeKey : void 0;
				if (key === void 0) return;
				setBusy(true);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.probePath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Trae-Probe-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify(action)
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) {
						const message = typeof value === "object" && value !== null && "error" in value ? String(value["error"]) : `HTTP ${response.status}`;
						throw new Error(message);
					}
					if (action.action === "set-maximum-context-window") {
						const state = typeof value === "object" && value !== null ? value["state"] : void 0;
						if (state !== "updated" && state !== "saved") {
							const reason = typeof value === "object" && value !== null && "reason" in value ? String(value["reason"]) : typeof value === "object" && value !== null && "error" in value ? String(value["error"]) : t("requestFailed");
							throw new Error(reason);
						}
					}
					if (action.action === "set-disabled-models") {
						const state = typeof value === "object" && value !== null ? value["state"] : void 0;
						if (state !== "updated" && state !== "saved") {
							const reason = typeof value === "object" && value !== null && "reason" in value ? String(value["reason"]) : typeof value === "object" && value !== null && "error" in value ? String(value["error"]) : t("requestFailed");
							throw new Error(reason);
						}
					}
					await refresh(controller.signal, true);
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setReadFailure(error instanceof Error ? error.message : t("requestFailed"));
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setBusy(false);
				}
			}, [
				currentVariant.probePath,
				refresh,
				status,
				t,
				trackController
			]);
			const manualCheckIn = (0, react.useCallback)(async () => {
				const key = status?.status === "signed-in" ? status.probeKey : void 0;
				if (key === void 0) return;
				setCheckingIn(true);
				setCheckInNotice(void 0);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.probePath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Trae-Probe-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({ action: "checkin" })
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const result = await response.json();
					if (result.state === "claimed") setCheckInNotice(t("autoCheckInStatusClaimed", { amount: result.amount ?? 150 }));
					else if (result.state === "already-claimed") setCheckInNotice(t("autoCheckInStatusAlready"));
					else if (result.state === "no-campaign") setCheckInNotice(result.reason ?? t("autoCheckInStatusNoCampaign"));
					else if (result.reason) setCheckInNotice(t("autoCheckInStatusError", { message: result.reason }));
					else setCheckInNotice(t("autoCheckInStatusError", { message: "签到未成功" }));
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setCheckInNotice(error instanceof Error ? error.message : t("requestFailed"));
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setCheckingIn(false);
				}
				try {
					await refresh(controller.signal);
				} finally {
					manualControllers.current.delete(controller);
				}
			}, [
				currentVariant.probePath,
				refresh,
				status,
				t,
				trackController
			]);
			const clearCheckInLogs = (0, react.useCallback)(async () => {
				const key = status?.status === "signed-in" ? status.probeKey : void 0;
				if (key === void 0) return;
				setClearingLogs(true);
				setCheckInNotice(void 0);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.probePath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Trae-Probe-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({ action: "clear-checkin-logs" })
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					setCheckInNotice(t("checkInClearSuccess"));
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setCheckInNotice(error instanceof Error ? error.message : t("requestFailed"));
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setClearingLogs(false);
				}
				try {
					await refresh(controller.signal, true);
				} finally {
					manualControllers.current.delete(controller);
				}
			}, [
				currentVariant.probePath,
				refresh,
				status,
				t,
				trackController
			]);
			const confirmDetect = (0, react.useCallback)((modelId) => {
				control({
					action: "probe",
					model: modelId
				});
			}, [control]);
			const startAttempt = (0, react.useCallback)(async (key) => {
				setSignInError(void 0);
				setBusy(true);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.loginPath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Trae-Login-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({ action: "begin" })
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const record = typeof value === "object" && value !== null ? value : {};
					const state = typeof record["state"] === "string" ? record["state"] : "";
					const url = typeof record["url"] === "string" ? record["url"] : "";
					if (state === "" || url === "") throw new Error(t("requestFailed"));
					setSignIn({
						state,
						url
					});
					window.open(url, "_blank", "noopener,noreferrer");
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setSignInError(error instanceof Error ? error.message : t("requestFailed"));
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setBusy(false);
				}
			}, [
				currentVariant.loginPath,
				t,
				trackController
			]);
			const beginSignIn = (0, react.useCallback)(async () => {
				const key = actionKey;
				if (key === void 0) return;
				await startAttempt(key);
			}, [actionKey, startAttempt]);
			const signOut = (0, react.useCallback)(async () => {
				if (status?.status !== "signed-in" || status.loginKey === void 0) return;
				const key = status.loginKey;
				setBusy(true);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.loginPath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Trae-Login-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({ action: "logout" })
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					setSignIn(void 0);
					const signedOutDoc = {
						status: "signed-out",
						loginKey: key
					};
					setStatus(signedOutDoc);
					setSignedInState(false);
					noteQuotaStatus(currentVariant.id, signedOutDoc);
					noteQuotaSignIn(currentVariant.id, false);
					await refresh(controller.signal);
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setReadFailure(error instanceof Error ? error.message : t("requestFailed"));
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setBusy(false);
				}
			}, [
				currentVariant.id,
				currentVariant.loginPath,
				refresh,
				status,
				t,
				trackController
			]);
			const switchAccount = (0, react.useCallback)(async () => {
				const key = actionKey;
				if (key === void 0) return;
				setBusy(true);
				setImportNotice(void 0);
				setSignInError(void 0);
				const controller = trackController();
				try {
					const response = await fetch(currentVariant.loginPath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Trae-Login-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({ action: "logout" })
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					setSignIn(void 0);
					const signedOutDoc = {
						status: "signed-out",
						loginKey: key
					};
					setStatus(signedOutDoc);
					setSignedInState(false);
					noteQuotaStatus(currentVariant.id, signedOutDoc);
					noteQuotaSignIn(currentVariant.id, false);
					await refresh(controller.signal);
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setReadFailure(error instanceof Error ? error.message : t("requestFailed"));
					return;
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setBusy(false);
				}
				await startAttempt(key);
			}, [
				actionKey,
				currentVariant.id,
				currentVariant.loginPath,
				refresh,
				startAttempt,
				t,
				trackController
			]);
			(0, react.useEffect)(() => {
				if (signIn === void 0) return;
				let cancelled = false;
				const timer = setInterval(() => {
					(async () => {
						const key = actionKey;
						if (key === void 0) return;
						try {
							const value = await (await fetch(currentVariant.loginPath, {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
									"X-Trae-Login-Key": key
								},
								credentials: "same-origin",
								body: JSON.stringify({
									action: "poll",
									state: signIn.state
								})
							})).json().catch(() => void 0);
							if (cancelled || !mounted.current) return;
							const record = typeof value === "object" && value !== null ? value : {};
							const outcome = record["status"];
							if (outcome === "complete") {
								setSignIn(void 0);
								setSignInError(void 0);
								noteQuotaSignIn(currentVariant.id, true);
								await refresh();
								return;
							}
							if (outcome === "failed") {
								setSignIn(void 0);
								setSignInError(typeof record["message"] === "string" ? record["message"] : t("requestFailed"));
							}
						} catch {}
					})();
				}, 2e3);
				return () => {
					cancelled = true;
					clearInterval(timer);
				};
			}, [
				actionKey,
				currentVariant.id,
				currentVariant.loginPath,
				signIn,
				refresh,
				t
			]);
			const importCredential = (0, react.useCallback)(async (file) => {
				if (status?.status !== "signed-out" || status.loginKey === void 0) return;
				const key = status.loginKey;
				setImportNotice(void 0);
				setBusy(true);
				const controller = trackController();
				try {
					const document = await file.text();
					const response = await fetch(currentVariant.loginPath, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Trae-Login-Key": key
						},
						credentials: "same-origin",
						signal: controller.signal,
						body: JSON.stringify({
							action: "import",
							document
						})
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const record = typeof value === "object" && value !== null ? value : {};
					if (record["status"] === "imported") {
						const account = typeof record["nickname"] === "string" && record["nickname"] !== "" ? record["nickname"] : typeof record["accountName"] === "string" && record["accountName"] !== "" ? record["accountName"] : typeof record["uid"] === "string" && record["uid"] !== "" ? record["uid"] : "";
						setImportNotice({
							kind: "done",
							text: t("importDone", { account: account === "" ? "—" : account })
						});
						noteQuotaSignIn(currentVariant.id, true);
						await refresh(controller.signal);
						return;
					}
					setImportNotice({
						kind: "failed",
						text: t("importFailed", { message: typeof record["message"] === "string" ? record["message"] : t("requestFailed") })
					});
				} catch (error) {
					if (mounted.current && controller.signal.aborted !== true) setImportNotice({
						kind: "failed",
						text: t("importFailed", { message: error instanceof Error ? error.message : t("requestFailed") })
					});
				} finally {
					manualControllers.current.delete(controller);
					if (mounted.current) setBusy(false);
				}
			}, [
				currentVariant.id,
				currentVariant.loginPath,
				refresh,
				status,
				t,
				trackController
			]);
			const cardTitle = isUnified ? t("unifiedTitle") : t(currentVariant.titleKey);
			const cardIntro = isUnified ? t("unifiedIntro") : t(currentVariant.introKey);
			const displayName = status?.status === "signed-in" ? status.nickname ?? status.accountName : void 0;
			const label = status === void 0 ? t("loading") : status.status === "signed-in" ? displayName === void 0 ? t("signedInAs", { nickname: "" }).trimEnd().replace(/[:：]$/, "") : t("signedInAs", { nickname: displayName }) : status.status === "error" ? t("requestFailed") : t("signedOut");
			const reported = signedIn?.();
			const cnSignedIn = reported !== void 0 ? reported.cn : liveSignIn.cn;
			const aiSignedIn = reported !== void 0 ? reported.ai : liveSignIn.ai;
			const cnDotStatus = isUnified && activeVariantId === "trae" ? status === void 0 ? "loading" : status.status : cnSignedIn ? "signed-in" : "signed-out";
			const aiDotStatus = isUnified && activeVariantId === "trae-ai" ? status === void 0 ? "loading" : status.status : aiSignedIn ? "signed-in" : "signed-out";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: {
					...cardStyle,
					...hovered ? cardHoverStyle : {},
					...open ? cardOpenStyle : {}
				},
				onMouseEnter: () => {
					setHovered(true);
				},
				onMouseLeave: () => {
					setHovered(false);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					style: {
						...headerStyle,
						...headerFocused ? headerFocusStyle : {}
					},
					"aria-expanded": open,
					"aria-label": `${t(open ? "collapse" : "expand")}: ${cardTitle}`,
					onClick: () => {
						setOpen(!open);
					},
					onFocus: (event) => {
						let keyboard = true;
						try {
							keyboard = event.currentTarget.matches(":focus-visible");
						} catch {
							keyboard = true;
						}
						if (keyboard) setHeaderFocused(true);
					},
					onBlur: () => {
						setHeaderFocused(false);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: headTextStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: nameStyle,
							children: cardTitle
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: descriptionStyle,
							children: cardIntro
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							...chevronStyle,
							transform: open ? "rotate(180deg)" : "none"
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChevronDownIcon, {})
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: cardBodyStyle,
					children: [
						isUnified ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaSettingsContent, {
							t,
							scope,
							signedIn
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: segmentedContainerStyle,
							role: "tablist",
							"aria-label": "Trae Version Selection",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "tab",
								"aria-selected": activeVariantId === "trae",
								style: segmentedTabItemStyle(activeVariantId === "trae"),
								onClick: () => setActiveVariantId("trae"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: dotStyle(cnDotStatus),
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("variantTabCN") })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "tab",
								"aria-selected": activeVariantId === "trae-ai",
								style: segmentedTabItemStyle(activeVariantId === "trae-ai"),
								onClick: () => setActiveVariantId("trae-ai"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: dotStyle(aiDotStatus),
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("variantTabAI") })]
							})]
						})] }) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							style: quotaTitleStyle,
							children: t("accountHeading")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: rowStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: statusStyle,
									role: "status",
									"aria-busy": status === void 0,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										style: dotStyle(status === void 0 ? "loading" : status.status)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle$1,
									disabled: busy,
									onClick: () => {
										manualRefresh();
									},
									children: busy ? t("refreshing") : t("refresh")
								}),
								status?.status !== "signed-in" || status.loginKey === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle$1,
									disabled: busy,
									onClick: () => {
										switchAccount();
									},
									children: busy ? t("switchingAccount") : t("switchAccount")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle$1,
									disabled: busy,
									onClick: () => {
										signOut();
									},
									children: busy ? t("signingOut") : t("signOut")
								})] })
							]
						}),
						readFailure === void 0 || signedInState === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle,
							children: t("statusRefreshFailed", { message: readFailure })
						}),
						status?.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							status.expiresAt === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: bodyStyle,
								children: t("accessTokenExpires", { time: formatTime(status.expiresAt) })
							}),
							status.catalog === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: rowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: bodyStyle,
									children: [status.catalog.source === "live" && status.catalog.fetchedAt !== void 0 ? t("catalogLive", { time: formatTime(status.catalog.fetchedAt) }) : status.catalog.source === "saved" && status.catalog.fetchedAt !== void 0 ? t("catalogSaved", { time: formatTime(status.catalog.fetchedAt) }) : t("catalogFallback"), status.catalog.appVersion === void 0 ? "" : ` · ${t("catalogAppVersion", { version: status.catalog.appVersion })}`]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle$1,
									disabled: busy,
									onClick: () => {
										refreshModels();
									},
									children: busy ? t("refreshingModels") : t("refreshModels")
								})]
							}),
							status.catalog?.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: errorStyle,
								children: t("catalogError", { message: status.catalog.error })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								role: "tablist",
								style: tabBarStyle,
								children: [
									"status",
									"context",
									"models",
									"details",
									"checkin"
								].map((id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									"aria-selected": tab === id,
									onClick: () => {
										setTab(id);
									},
									style: {
										...tabStyle,
										...tab === id ? tabActiveStyle : {}
									},
									children: t(id === "status" ? "tabStatus" : id === "context" ? "tabContext" : id === "models" ? "tabModels" : id === "details" ? "tabDetails" : "tabCheckIn")
								}, id))
							}),
							tab === "status" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: tabPanelStyle,
								children: [
									status.credits === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: quotaListStyle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: rowStyle,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
												style: quotaTitleStyle,
												children: t("creditsHeading")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: bodyStyle,
												children: status.credits.unlimited === true ? t("creditsTotalUnlimited") : t("creditsTotal", { total: formatNumber(status.credits.total) })
											})]
										}), status.credits.cycleResetTime === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: descriptionStyle,
											children: t("cycleResetAt", { time: formatCycleReset(status.credits.cycleResetTime) })
										})]
									}),
									status.creditsError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										style: errorStyle,
										children: t("creditsError", { message: status.creditsError })
									}),
									status.probe === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProbeSection, {
										probe: status.probe,
										t,
										busy,
										onDetect: confirmDetect,
										onClear: () => {
											control({ action: "clear" });
										}
									})
								]
							}) : tab === "context" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: tabPanelStyle,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextTable, {
									models: status.models,
									t,
									disabled: busy,
									...status.useMaximumContextWindow === void 0 ? {} : { useMaximumContextWindow: status.useMaximumContextWindow },
									onUseMaximumContextWindow: (enabled) => {
										control({
											action: "set-maximum-context-window",
											enabled
										});
									}
								})
							}) : tab === "models" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: tabPanelStyle,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelTogglesSection, {
									models: status.models,
									disabledModels: status.disabledModels,
									t,
									disabled: busy,
									onToggleModel: (modelId, enabled) => {
										const currentDisabled = status.disabledModels ?? [];
										const nextDisabled = enabled ? currentDisabled.filter((id) => id !== modelId) : [...currentDisabled.filter((id) => id !== modelId), modelId];
										control({
											action: "set-disabled-models",
											disabledModels: nextDisabled
										});
									},
									onSetDisabledModels: (disabledIds) => {
										control({
											action: "set-disabled-models",
											disabledModels: disabledIds
										});
									}
								})
							}) : tab === "details" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: tabPanelStyle,
								children: [status.credits === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: quotaListStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
										style: quotaTitleStyle,
										children: t("creditsDetailHeading")
									}), status.credits.accounts.filter((account) => account.packageName === "enterprise" || account.remain > 0 || account.unlimited === true).map((account, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CreditBar, {
										label: account.packageName === "enterprise" ? t("packageEnterprise") : account.packageName,
										remain: account.remain,
										size: account.size,
										unlimited: account.unlimited,
										t
									}, `${account.packageName}-${String(index)}`))]
								}), status.models === void 0 || status.models.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: quotaListStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
										style: quotaTitleStyle,
										children: t("modelsHeading")
									}), status.models.filter((model) => model.free === true || (model.badges?.length ?? 0) > 0).map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelOfferRow, {
										model,
										t
									}, model.id))]
								})]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: tabPanelStyle,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CheckInLogTable, {
									logs: status.checkIn?.logs,
									t,
									disabled: busy,
									busy,
									checkingIn,
									clearing: clearingLogs,
									...checkInNotice === void 0 ? {} : { notice: checkInNotice },
									...status.checkIn?.nextRunAt === void 0 ? {} : { nextRun: status.checkIn.nextRunAt },
									onCheckIn: () => {
										manualCheckIn();
									},
									onRefresh: () => {
										refresh();
									},
									onClear: () => {
										clearCheckInLogs();
									}
								})
							})
						] }) : null,
						status?.status === "signed-out" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: status.reason === void 0 ? bodyStyle : errorStyle,
								children: status.reason ?? t(currentVariant.signedOutKey)
							}),
							status.loginKey === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: rowStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle$1,
									disabled: busy || signIn !== void 0,
									onClick: () => {
										beginSignIn();
									},
									children: signIn === void 0 ? t("signIn") : t("signingIn")
								}), signIn === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									href: signIn.url,
									target: "_blank",
									rel: "noopener noreferrer",
									style: bodyStyle,
									children: t("signInOpenAgain")
								})]
							}),
							signIn === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: bodyStyle,
								children: t("signInWaiting")
							}),
							signInError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: errorStyle,
								children: t("signInFailed", { message: signInError })
							}),
							status.loginKey === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: rowStyle,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: bodyStyle,
										children: t("importHeading")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle$1,
										disabled: busy || signIn !== void 0,
										onClick: () => {
											importInput.current?.click();
										},
										children: busy ? t("importing") : t("importAction")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										ref: importInput,
										type: "file",
										accept: ".json,application/json",
										style: { display: "none" },
										onChange: (event) => {
											const file = event.target.files?.[0];
											event.target.value = "";
											if (file !== void 0) importCredential(file);
										}
									})
								]
							}),
							status.loginKey === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: bodyStyle,
								children: t("importHint")
							}),
							importNotice === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: importNotice.kind === "failed" ? errorStyle : bodyStyle,
								children: importNotice.text
							})
						] }) : null,
						status?.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle,
							children: status.message
						}) : null
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/TraeProbeControl.tsx
		/**
		* 模型选择器旁的推理档位探测交互控件。
		*
		* @module dsh-trae-connect/client/probe-control
		*/
		function cardVariantFor(provider) {
			return CARD_VARIANTS.find((card) => card.id === provider);
		}
		const RECONCILE_MS = 6e4;
		const wrapperStyle = {
			display: "inline-flex",
			position: "relative",
			alignItems: "center",
			transform: "translateY(2px)",
			marginRight: -8
		};
		const buttonStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			gap: 2,
			height: 30,
			padding: "0 6px",
			border: 0,
			borderRadius: 8,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			whiteSpace: "nowrap",
			cursor: "pointer"
		};
		const labelStyle = {
			fontSize: 11,
			lineHeight: "16px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const tooltipStyle = {
			position: "absolute",
			left: "50%",
			bottom: "calc(100% + 8px)",
			zIndex: 1e3,
			transform: "translateX(-50%)",
			padding: "4px 8px",
			borderRadius: 6,
			background: "var(--dsw-specific-tip, #1f2329)",
			boxShadow: "var(--dsw-shadow-lv2)",
			color: "var(--dsw-alias-label-primary, #fff)",
			fontSize: 12,
			lineHeight: "18px",
			whiteSpace: "nowrap",
			pointerEvents: "none"
		};
		const confirmStyle = {
			position: "absolute",
			right: 0,
			bottom: "calc(100% + 8px)",
			zIndex: 1001,
			display: "flex",
			flexDirection: "column",
			gap: 8,
			width: 260,
			padding: "10px 12px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1, #fff)",
			boxShadow: "var(--dsw-shadow-lv2)",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			lineHeight: "18px"
		};
		const confirmRowStyle = {
			display: "flex",
			justifyContent: "flex-end",
			gap: 8
		};
		const confirmButtonStyle = {
			padding: "3px 10px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 6,
			background: "transparent",
			color: "inherit",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer"
		};
		const primaryButtonStyle = {
			...confirmButtonStyle,
			border: "1px solid var(--dsw-alias-button-primary-fill)",
			background: "var(--dsw-alias-button-primary-fill)",
			color: "var(--dsw-alias-label-primary-foreground)"
		};
		const noteStyle = {
			position: "absolute",
			right: 0,
			bottom: "calc(100% + 8px)",
			zIndex: 1001,
			display: "flex",
			alignItems: "center",
			gap: 12,
			padding: "6px 10px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1)",
			boxShadow: "var(--dsw-shadow-lv2)",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 12,
			lineHeight: "18px",
			whiteSpace: "nowrap"
		};
		const noteDismissStyle = {
			padding: "2px 8px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 6,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			fontSize: 12,
			lineHeight: "18px",
			cursor: "pointer"
		};
		function useLabel(t) {
			return t("probeLabel");
		}
		function resultFor(status, model) {
			if (status.status !== "signed-in") return void 0;
			return status.probe?.results.find((result) => result.id === model);
		}
		function tooltipText(t, model, state) {
			if (state.busy) return t("probeRunning", { model });
			const result = state.result;
			if (result !== void 0) {
				if (result.validation === "validating" && result.efforts.length > 0) return t("probeTooltipVerified", { levels: result.efforts.join(" / ") });
				if (result.validation === "non-validating") return t("probeTooltipNotValidating");
				return t("probeTooltipRetry");
			}
			if (state.failed) return t("probeTooltipRetry");
			return t("probeTooltipIdle", { model });
		}
		function TraeProbeControl({ directory, t }) {
			const subscribe = (0, react.useCallback)((listener) => directory.subscribe(listener), [directory]);
			const snapshot = (0, react.useCallback)(() => directory.getSnapshot(), [directory]);
			const selection = (0, react.useSyncExternalStore)(subscribe, snapshot, snapshot).current;
			const card = selection == null ? void 0 : cardVariantFor(selection.provider);
			const key = card === void 0 || selection == null ? void 0 : `${card.id}:${selection.model}`;
			return card === void 0 || selection == null || key === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelProbe, {
				model: selection.model,
				card,
				label: useLabel(t),
				t
			}, key);
		}
		function ModelProbe({ model, card, label, t }) {
			const [status, setStatus] = (0, react.useState)();
			const [busy, setBusy] = (0, react.useState)(false);
			const [confirming, setConfirming] = (0, react.useState)(false);
			const [tooltipVisible, setTooltipVisible] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)(false);
			const [note, setNote] = (0, react.useState)();
			const inFlight = (0, react.useRef)(false);
			const mounted = (0, react.useRef)(false);
			const readSeq = (0, react.useRef)(0);
			const tooltipId = (0, react.useId)();
			const refresh = (0, react.useCallback)(async (signal) => {
				const seq = ++readSeq.current;
				const response = await fetch(card.statusPath, {
					credentials: "same-origin",
					headers: { accept: "application/json" },
					...signal === void 0 ? {} : { signal }
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const value = await response.json().catch(() => void 0);
				if (!isTraeWebStatus(value)) throw new Error(t("statusResponseInvalid"));
				if (mounted.current && !signal?.aborted && seq === readSeq.current) setStatus(value);
			}, [card.statusPath, t]);
			(0, react.useEffect)(() => {
				mounted.current = true;
				const controller = new AbortController();
				const load = () => {
					refresh(controller.signal).catch(() => {});
				};
				load();
				const timer = window.setInterval(load, RECONCILE_MS);
				window.addEventListener("focus", load);
				return () => {
					mounted.current = false;
					controller.abort();
					window.clearInterval(timer);
					window.removeEventListener("focus", load);
				};
			}, [refresh]);
			const probe = status?.status === "signed-in" ? status.probe : void 0;
			const key = status?.status === "signed-in" ? status.probeKey : void 0;
			const result = status === void 0 ? void 0 : resultFor(status, model);
			const visible = probe?.candidates.includes(model) === true || result !== void 0;
			(0, react.useEffect)(() => {
				if (result !== void 0) setFailed(false);
			}, [result]);
			(0, react.useEffect)(() => {
				setConfirming(false);
				setNote(void 0);
			}, [model]);
			const detect = async () => {
				if (key === void 0 || inFlight.current || probe?.running === true) return;
				inFlight.current = true;
				setNote(void 0);
				setConfirming(false);
				setBusy(true);
				setFailed(false);
				try {
					const response = await fetch(card.probePath, {
						method: "POST",
						credentials: "same-origin",
						headers: {
							"Content-Type": "application/json",
							"X-Trae-Probe-Key": key
						},
						body: JSON.stringify({
							action: "probe",
							model
						})
					});
					const body = await response.json();
					if (!response.ok || body.state !== "ok" || body.validation !== "validating" && body.validation !== "non-validating" || !Array.isArray(body.efforts) || !body.efforts.every((effort) => typeof effort === "string")) throw new Error("probe failed");
					if (mounted.current) {
						const completed = {
							id: model,
							name: model,
							validation: body.validation,
							efforts: body.efforts,
							probedAt: Date.now()
						};
						setNote(completed);
					}
					refresh().catch(() => {});
				} catch {
					if (mounted.current) setFailed(true);
				} finally {
					inFlight.current = false;
					if (mounted.current) setBusy(false);
				}
			};
			if (!visible) return null;
			const text = tooltipText(t, model, {
				busy,
				result,
				failed
			});
			const disabled = busy || probe?.running === true || key === void 0;
			const showTooltip = tooltipVisible && !confirming && note === void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				style: wrapperStyle,
				onMouseEnter: () => {
					setTooltipVisible(true);
				},
				onMouseLeave: () => {
					setTooltipVisible(false);
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-label": text,
						"aria-describedby": showTooltip ? tooltipId : void 0,
						"aria-busy": busy,
						"aria-expanded": confirming,
						disabled,
						onClick: () => {
							setConfirming(true);
						},
						onFocus: () => {
							setTooltipVisible(true);
						},
						onBlur: () => {
							setTooltipVisible(false);
						},
						style: {
							...buttonStyle,
							opacity: disabled && !confirming ? .6 : 1,
							cursor: disabled ? "default" : "pointer"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							width: "16",
							height: "16",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.6",
							"aria-hidden": "true",
							focusable: "false",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: "12",
									cy: "12",
									r: "9"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: "12",
									cy: "12",
									r: "4"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 12 20 4" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: "12",
									cy: "12",
									r: "1"
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: labelStyle,
							children: label
						})]
					}),
					showTooltip && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						id: tooltipId,
						role: "tooltip",
						style: tooltipStyle,
						children: text
					}),
					confirming && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: confirmStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("probeBubbleBody") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: confirmRowStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: confirmButtonStyle,
								onClick: () => {
									setConfirming(false);
								},
								children: t("cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: primaryButtonStyle,
								onClick: () => {
									detect();
								},
								children: t("probeConfirmAction")
							})]
						})]
					}),
					note === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						role: "status",
						"aria-live": "polite",
						style: noteStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: noteText(t, note) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: noteDismissStyle,
							onClick: () => {
								setNote(void 0);
							},
							children: t("probeNoteDismiss")
						})]
					})
				]
			});
		}
		function noteText(t, result) {
			if (result.validation === "validating" && result.efforts.length > 0) return t("probeNoteVerified", { levels: result.efforts.join(" / ") });
			if (result.validation === "non-validating") return t("probeNoteNotValidating");
			return t("probeNoteUnknown");
		}
		//#endregion
		//#region src/client/quota-merge.ts
		/**
		* 根据包名对资源包进行汇总合并，保留最早到期时间。
		*/
		function mergeCreditAccounts(accounts) {
			const groups = /* @__PURE__ */ new Map();
			for (const account of accounts) {
				const key = account.packageName;
				const existing = groups.get(key);
				if (existing === void 0) {
					groups.set(key, {
						packageName: account.packageName,
						packageEndTime: account.packageEndTime,
						remain: account.remain,
						size: account.size,
						unlimited: account.unlimited === true
					});
					continue;
				}
				existing.remain += account.remain;
				existing.size += account.size;
				existing.unlimited = existing.unlimited || account.unlimited === true;
				if (existing.packageEndTime !== void 0 && account.packageEndTime !== void 0) {
					const a = Date.parse(existing.packageEndTime);
					const b = Date.parse(account.packageEndTime);
					if (!Number.isNaN(a) && !Number.isNaN(b) && b < a) existing.packageEndTime = account.packageEndTime;
				} else existing.packageEndTime = existing.packageEndTime ?? account.packageEndTime;
			}
			return [...groups.values()];
		}
		/**
		* 计算剩余百分比并限制在 0 - 100 之间。
		*/
		function clampPercent(remain, size) {
			if (!(size > 0)) return void 0;
			const percent = remain / size * 100;
			if (!Number.isFinite(percent)) return void 0;
			return Math.min(100, Math.max(0, percent));
		}
		/** 解析到期时间 */
		function parseExpiry(value) {
			if (value === void 0) return void 0;
			const parsed = Date.parse(value);
			return Number.isNaN(parsed) ? void 0 : parsed;
		}
		/** 是否已用尽 */
		function isSpent(group) {
			return !group.unlimited && group.remain <= 0;
		}
		/** 是否已过期 */
		function isExpired(group, now) {
			if (!isSpent(group)) return false;
			const expiry = parseExpiry(group.packageEndTime);
			return expiry !== void 0 && expiry < now;
		}
		/**
		* 过滤出侧边栏卡片应显示的额度组。
		*/
		function visibleQuotaGroups(groups, now = Date.now()) {
			const hasCredit = groups.some((group) => group.unlimited || group.remain > 0);
			return groups.filter((group) => {
				if (group.unlimited || group.remain > 0) return true;
				return !hasCredit && !isExpired(group, now);
			});
		}
		/**
		* 排序资源包列表（有效包排在前面，已用尽排在后面，过期包自动剔除）。
		*/
		function sortPackageRows(rows, now = Date.now()) {
			const live = [];
			const spent = [];
			for (const row of rows) {
				const unlimited = row.unlimited === true;
				const expiry = parseExpiry(row.packageEndTime);
				if (!unlimited && row.remain <= 0 && expiry !== void 0 && expiry < now) continue;
				if (unlimited || row.remain > 0) live.push(row);
				else spent.push(row);
			}
			return [...live, ...spent];
		}
		//#endregion
		//#region src/client/SidebarQuotaCard.tsx
		/**
		* 侧栏底部额度卡片与中心面板详细额度看板组件。
		*
		* @module dsh-trae-connect/client/sidebar-quota
		*/
		const fallbackT = (key) => key;
		function buildBars(accounts) {
			const groups = visibleQuotaGroups(mergeCreditAccounts(accounts));
			const bars = [];
			for (const group of groups) {
				const percent = group.unlimited ? void 0 : clampPercent(group.remain, group.size);
				const detail = group.unlimited ? "∞" : percent === void 0 ? `${group.remain.toLocaleString()} · ?` : `${group.remain.toLocaleString()} / ${group.size.toLocaleString()}`;
				bars.push({
					label: group.packageName,
					detail,
					percent: percent === void 0 ? void 0 : `${Math.round(percent)}%`,
					barPercent: percent === void 0 ? 0 : Math.max(2, percent),
					warn: !group.unlimited && percent !== void 0 && percent < 20,
					packageEndTime: group.packageEndTime
				});
			}
			return bars;
		}
		function Ring({ percent, warn, size }) {
			const clamped = Math.min(100, Math.max(0, percent));
			const circumference = 45.55;
			const dashoffset = Math.round(circumference * (1 - clamped / 100) * 1e3) / 1e3;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "trp-glyph",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 20 20",
					width: size,
					height: size,
					focusable: "false",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "10",
						cy: "10",
						r: "7.25",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "1.5",
						opacity: "0.4"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "10",
						cy: "10",
						r: "7.25",
						fill: "none",
						stroke: warn ? "var(--dsw-alias-state-error-primary)" : "currentColor",
						strokeWidth: "2.5",
						strokeLinecap: "round",
						strokeDasharray: String(circumference),
						strokeDashoffset: String(dashoffset),
						transform: "rotate(-90 10 10)"
					})]
				})
			});
		}
		function buildPackageRows(accounts) {
			return sortPackageRows(accounts).map((account) => {
				const percent = account.unlimited === true ? void 0 : clampPercent(account.remain, account.size);
				return {
					name: account.packageName,
					remain: account.remain,
					size: account.size,
					percent,
					warn: account.unlimited !== true && percent !== void 0 && percent < 20,
					packageEndTime: account.packageEndTime
				};
			});
		}
		function timeText(ms) {
			return new Date(ms).toLocaleTimeString(void 0, {
				hour: "2-digit",
				minute: "2-digit"
			});
		}
		function SidebarQuotaCard(props) {
			const { t = fallbackT, statusPath, open } = props;
			const variantId = statusPath !== void 0 ? variantOfStatusPath(statusPath) : "trae";
			const nameKey = variantId === "trae-ai" ? "quotaCardAI" : "quotaCardCN";
			const wide = props.wide !== false;
			const [failed, setFailed] = (0, react.useState)(false);
			(0, react.useSyncExternalStore)(onQuotaSettingsChange, quotaSettingsRevision);
			const enabled = variantId === "trae" ? quotaToggles().cn : quotaToggles().ai;
			const status = quotaStatus(variantId);
			const signedIn = status?.status === "signed-in";
			(0, react.useEffect)(() => {
				if (statusPath === void 0 || !enabled) return void 0;
				let disposed = false;
				let timer;
				const controller = new AbortController();
				const refresh = async () => {
					try {
						const response = await fetch(statusPath, {
							signal: controller.signal,
							headers: { accept: "application/json" }
						});
						const body = await response.json();
						if (disposed) return;
						if (!response.ok || !isTraeWebStatus(body)) {
							setFailed(true);
							return;
						}
						setFailed(false);
						noteQuotaStatus(variantId, body);
					} catch {
						if (!disposed) setFailed(true);
					}
				};
				const isHidden = () => typeof document !== "undefined" && document.hidden;
				const loop = () => {
					if (isHidden()) return;
					refresh();
				};
				timer = window.setInterval(loop, Math.max(6e4, quotaPollMs()));
				refresh();
				const onVisible = () => {
					if (!isHidden()) loop();
				};
				if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
				return () => {
					disposed = true;
					controller.abort();
					if (timer !== void 0) window.clearInterval(timer);
					if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
				};
			}, [
				statusPath,
				enabled,
				variantId
			]);
			if (enabled === false) return null;
			const credits = status !== void 0 && "credits" in status ? status.credits : void 0;
			const bars = credits === void 0 ? [] : buildBars(credits.accounts ?? []);
			const lowest = bars.reduce((acc, bar) => {
				if (bar.percent === void 0) return acc;
				const value = Number.parseFloat(bar.percent);
				if (!Number.isFinite(value)) return acc;
				return acc === void 0 ? value : Math.min(acc, value);
			}, void 0);
			const ringPercent = failed || status === void 0 ? 0 : credits?.unlimited === true ? 100 : lowest ?? 0;
			const ringWarn = failed || lowest !== void 0 && lowest < 20;
			const fetchedAt = quotaStatusFetchedAt(variantId);
			const title = [
				t(nameKey),
				...bars.map((bar) => `${bar.label} ${bar.detail}${bar.percent === void 0 ? "" : ` (${bar.percent})`}`),
				fetchedAt !== void 0 ? `${t("quotaUpdated")} ${timeText(fetchedAt)}` : ""
			].filter((part) => part !== "").join(" · ");
			if (!wide) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "trp-railButton",
				"aria-label": title,
				title,
				disabled: !signedIn,
				onClick: () => {
					if (!signedIn) return;
					open?.();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
					percent: ringPercent,
					warn: ringWarn,
					size: 18
				})
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "trp-foot",
				"aria-label": title,
				title,
				disabled: !signedIn,
				onClick: () => {
					if (!signedIn) return;
					open?.();
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "trp-footTop",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Ring, {
							percent: ringPercent,
							warn: ringWarn,
							size: 16
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "trp-footName",
							children: t(nameKey)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { flex: 1 } }),
						fetchedAt !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "trp-updated",
							children: [
								t("quotaUpdated"),
								" ",
								timeText(fetchedAt)
							]
						}) : null
					]
				}), failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "trp-footRow",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "trp-footLabel",
						children: t("quotaError")
					})
				}) : bars.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "trp-footRow",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "trp-footLabel",
						children: status === void 0 ? "…" : !("credits" in status) ? t("quotaNotSignedIn") : status.creditsError ?? t("quotaError")
					})
				}) : bars.map((bar, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "trp-footRow",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "trp-footHead",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "trp-footLabel",
								title: bar.packageEndTime !== void 0 ? `${t("quotaExpires")} ${bar.packageEndTime}` : t("quotaNoExpiry"),
								children: bar.label
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "trp-footAmount",
								children: bar.detail
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "trp-footPct",
								children: bar.percent ?? ""
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "trp-footBar",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: bar.warn ? "trp-footFill trp-footFillWarn" : "trp-footFill",
							style: { width: `${bar.barPercent}%` }
						})
					})]
				}, `${index}\u0000${bar.label}\u0000${bar.packageEndTime ?? ""}`))]
			});
		}
		function QuotaDashboard(props) {
			const { t = fallbackT, statusPaths, refresh, close, useQuotaDashboard, onVariantPicked } = props;
			(0, react.useSyncExternalStore)(onQuotaSettingsChange, quotaSettingsRevision);
			const state = useQuotaDashboard((s) => s);
			const followedPath = state.activePath;
			const [userPicked, setUserPicked] = (0, react.useState)(void 0);
			const activePathResolved = userPicked ?? followedPath;
			const activeVariant = variantOfStatusPath(activePathResolved);
			const status = quotaStatus(activeVariant);
			const loading = state.loading;
			const fetchedAt = state.fetchedAt;
			const credits = status !== void 0 && "credits" in status ? status.credits : void 0;
			const rows = credits === void 0 ? [] : buildPackageRows(credits.accounts ?? []);
			const nameKey = activeVariant === "trae-ai" ? "quotaCardAI" : "quotaCardCN";
			const signedIn = status?.status === "signed-in";
			const totalRemain = credits?.total ?? 0;
			const totalSize = credits?.totalSize ?? credits?.accounts.reduce((sum, account) => sum + account.size, 0) ?? 0;
			const totalPercent = clampPercent(totalRemain, totalSize);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "trp-main",
				role: "region",
				"aria-label": t("quotaDashboardTitle"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "trp-mainInner",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: "trp-header",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "trp-headerText",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
										className: "trp-title",
										children: t("quotaDashboardTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "trp-subtitle",
										children: t("quotaDashboardSubtitle")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "trp-spacer" }),
								fetchedAt !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "trp-meta",
									children: [
										t("quotaUpdated"),
										" ",
										timeText(fetchedAt)
									]
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "trp-refresh",
									disabled: loading,
									onClick: () => refresh(),
									children: loading ? t("quotaRefreshing") : t("quotaRefresh")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "trp-close",
									"aria-label": t("quotaClose"),
									title: t("quotaClose"),
									onClick: () => close(),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										children: "×"
									})
								})
							]
						}),
						statusPaths.length > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "trp-tabs",
							role: "tablist",
							"aria-label": t("quotaDashboardTitle"),
							children: statusPaths.map((path) => {
								const key = variantOfStatusPath(path) === "trae-ai" ? "quotaCardAI" : "quotaCardCN";
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									"aria-selected": path === activePathResolved,
									className: path === activePathResolved ? "trp-tab trp-tabActive" : "trp-tab",
									onClick: () => {
										setUserPicked(path);
										onVariantPicked(path);
									},
									children: t(key)
								}, path);
							})
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "trp-card",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "trp-cardHead",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "trp-avatar",
										children: activeVariant === "trae-ai" ? "AI" : "CN"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "trp-cardIdentity",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "trp-cardTitle",
											children: t(nameKey)
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "trp-cardOwner",
											children: signedIn ? status.nickname ?? "" : t("quotaNotSignedIn")
										})]
									}),
									credits?.unlimited === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "trp-badge",
										children: t("quotaUnlimited")
									}) : null
								]
							}), !signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "trp-notice",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "trp-noticeTitle",
									children: t("quotaNotSignedIn")
								})
							}) : credits === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "trp-notice trp-noticeError",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "trp-noticeTitle",
									children: t("quotaError")
								})
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: "trp-totalLine",
									children: [
										t("quotaTotalRemain"),
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
											className: "trp-totalValue",
											children: totalRemain.toLocaleString()
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "trp-totalSub",
									children: t("quotaTotalShare", {
										percent: totalPercent === void 0 ? t("quotaUnknownTotal") : `${totalPercent.toFixed(2)}%`,
										remain: totalRemain.toLocaleString(),
										size: totalSize.toLocaleString()
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "trp-bar",
									role: "progressbar",
									"aria-label": t("quotaTotal"),
									...totalPercent === void 0 ? { "aria-valuetext": t("quotaUnknownTotal") } : {
										"aria-valuemin": 0,
										"aria-valuemax": 100,
										"aria-valuenow": Math.round(totalPercent)
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: totalPercent !== void 0 && totalPercent < 20 ? "trp-barFill trp-barFillWarn" : "trp-barFill",
										style: {
											width: totalPercent === void 0 ? "100%" : `${Math.max(2, totalPercent)}%`,
											opacity: totalPercent === void 0 ? .25 : 1
										}
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "trp-blockTitle",
									children: t("quotaByPackage")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
									className: "trp-table",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("quotaColPackage") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("quotaColRemain") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: t("quotaColExpiry") })
									] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: rows.map((row, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: row.name }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
											className: "trp-num",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "trp-numText",
												children: [
													row.remain.toLocaleString(),
													" / ",
													row.size.toLocaleString()
												]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "trp-miniBar",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: row.warn ? "trp-footFill trp-footFillWarn" : "trp-footFill",
													style: {
														display: "block",
														height: "100%",
														borderRadius: 999,
														width: row.percent === void 0 ? "100%" : `${Math.max(2, row.percent)}%`,
														opacity: row.percent === void 0 ? .25 : 1
													}
												})
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
											className: "trp-expiry",
											children: row.packageEndTime ?? t("quotaNoExpiry")
										})
									] }, `${index}\u0000${row.name}\u0000${row.packageEndTime ?? ""}`)) })]
								}),
								credits.cycleResetTime !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: "trp-windowReset",
									children: [
										t("quotaExpires"),
										" ",
										credits.cycleResetTime
									]
								}) : null
							] })]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/quota-styles.ts
		/**
		* Trae 侧边栏额度卡片与详情看板样式表。
		*
		* @module dsh-trae-connect/client/quota-styles
		*/
		/** 样式表唯一标识 */
		const QUOTA_CSS_ID = "dsh-trae-connect/QuotaPanel.module.css";
		/** 动态注入全局样式 */
		function injectQuotaCss() {
			if (typeof document === "undefined") return () => {};
			if (document.querySelector(`style[data-plugin-css="dsh-trae-connect/QuotaPanel.module.css"]`) !== null) return () => {};
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-trae-connect";
			tag.dataset.pluginCss = QUOTA_CSS_ID;
			tag.textContent = QUOTA_CSS;
			document.head.appendChild(tag);
			return () => {
				tag.remove();
			};
		}
		/** 额度面板与侧栏卡片 CSS 样式规则 */
		const QUOTA_CSS = `
/* ------------------------------------------------- 侧边栏底部额度卡片 */
[class*="_footArea"] [class*="_footerActions"]{flex-direction:column}
.trp-foot{box-sizing:border-box;flex:0 0 auto;width:100%;min-width:0;font:inherit;color:var(--dsw-alias-label-secondary);text-align:left;cursor:pointer;background:0 0;border:1px solid transparent;border-radius:10px;flex-direction:column;gap:6px;margin:0 0 4px;padding:8px;display:flex}
.trp-foot:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}
.trp-foot:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.trp-foot:disabled{opacity:.5;cursor:default}
.trp-foot:disabled:hover{color:var(--dsw-alias-label-secondary);background:0 0;border-color:transparent}
.trp-railButton:disabled{opacity:.5;cursor:default}
.trp-railButton:disabled:hover{color:var(--dsw-alias-label-secondary);background:0 0}
.trp-footTop{align-items:center;gap:8px;min-width:0;display:flex}
.trp-footName{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;font-size:13px;font-weight:500;line-height:20px}
.trp-updated{flex:none;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px;font-variant-numeric:tabular-nums;white-space:nowrap}
.trp-footRow{flex-direction:column;gap:4px;min-width:0;display:flex}
.trp-footHead{align-items:baseline;gap:8px;min-width:0;display:flex}
.trp-footLabel{flex:1;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trp-footAmount{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;white-space:nowrap}
.trp-footBar{display:block;background:var(--dsw-alias-bg-layer-2);border-radius:999px;height:5px;overflow:hidden}
.trp-footFill{display:block;background:var(--dsw-alias-brand-primary);border-radius:999px;height:100%;transition:width .3s ease}
.trp-footFillWarn{background:var(--dsw-alias-state-error-primary)}
.trp-footPct{flex:none;width:34px;color:var(--dsw-alias-label-secondary);text-align:right;font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}

.trp-railButton{box-sizing:border-box;width:36px;height:36px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:1px solid transparent;border-radius:8px;flex:none;justify-content:center;align-items:center;margin:0 0 4px;padding:0;display:inline-flex}
.trp-railButton:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.trp-railButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}

.trp-glyph{flex:none;justify-content:center;align-items:center;display:inline-flex;color:var(--dsw-alias-brand-primary)}
.trp-ringWarn{color:var(--dsw-alias-state-error-primary)}

/* ------------------------------------------------------------ 额度看板面板 */
.trp-main{background:var(--dsw-alias-bg-layer-1);width:100%;height:100%;overflow:auto;display:block}
.trp-mainInner{max-width:760px;margin:0 auto;padding:24px 20px 40px;flex-direction:column;gap:14px;display:flex;color:var(--dsw-alias-label-primary)}
.trp-header{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.trp-headerText{flex-direction:column;gap:2px;display:flex;min-width:0}
.trp-title{margin:0;font-size:18px;font-weight:600;line-height:1.4}
.trp-subtitle{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.trp-spacer{flex:1}
.trp-meta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5;font-variant-numeric:tabular-nums}
.trp-close{min-width:28px;justify-content:center;padding-left:0;padding-right:0;box-sizing:border-box;align-items:center;cursor:pointer;font:inherit;color:var(--dsw-alias-label-secondary);background:0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;height:28px;display:inline-flex}
.trp-close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.trp-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.trp-close span{font-size:16px;line-height:1}
.trp-refresh{box-sizing:border-box;align-items:center;cursor:pointer;font:inherit;color:var(--dsw-alias-label-secondary);background:0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:4px 12px;display:inline-flex;gap:6px;font-size:12px;line-height:18px}
.trp-refresh:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.trp-refresh:disabled{opacity:.5;cursor:default}
.trp-refresh:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}

.trp-notice{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:12px 14px;flex-direction:column;gap:4px;display:flex}
.trp-noticeError{border-color:var(--dsw-alias-state-error-primary)}
.trp-noticeTitle{margin:0;font-size:13px;font-weight:600;line-height:1.5}
.trp-noticeHint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.55}

.trp-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:14px;padding:16px 18px;flex-direction:column;gap:16px;display:flex}
.trp-cardHead{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.trp-avatar{flex:none;width:28px;height:28px;color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-module-platform);border-radius:50%;justify-content:center;align-items:center;font-size:12px;font-weight:600;line-height:1;display:inline-flex}
.trp-cardIdentity{flex-direction:column;gap:1px;min-width:0;display:flex}
.trp-cardTitle{font-size:13px;font-weight:600;line-height:1.4}
.trp-cardOwner{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}

.trp-windows{flex-direction:column;gap:14px;display:flex}
.trp-window{flex-direction:column;gap:6px;display:flex}
.trp-windowHead{align-items:baseline;gap:8px;display:flex}
.trp-windowLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:1.5}
.trp-windowValue{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums;white-space:nowrap}
.trp-windowPct{color:var(--dsw-alias-label-primary);min-width:38px;text-align:right;font-size:12px;font-weight:600;line-height:1.5;font-variant-numeric:tabular-nums}
.trp-bar{overflow:hidden;background:var(--dsw-alias-bg-layer-1);border-radius:999px;height:8px}
.trp-barFill{background:var(--dsw-alias-brand-primary);border-radius:999px;height:100%;transition:width .3s ease}
.trp-barFillWarn{background:var(--dsw-alias-state-error-primary)}
.trp-windowReset{color:var(--dsw-alias-label-tertiary);margin:0;font-size:11px;line-height:1.5}

.trp-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-brand-primary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600;line-height:17px}
.trp-badgeError{background:transparent;color:var(--dsw-alias-state-error-primary)}
.trp-badgeMuted{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px;max-width:220px;overflow:hidden;text-overflow:ellipsis}

.trp-totalLine{margin:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.trp-totalValue{font-size:22px;font-weight:600;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;margin-left:6px}
.trp-totalSub{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums}

.trp-table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.trp-table th{text-align:left;color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:600;line-height:1.5;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--dsw-alias-border-l2);padding:4px 8px}
.trp-table td{padding:7px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);vertical-align:top}
.trp-table tr:last-child td{border-bottom:0}
.trp-num{min-width:150px}
.trp-numText{display:block;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin-bottom:3px}
.trp-miniBar{display:block;height:4px;border-radius:999px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.trp-expiry{white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}

.trp-tabs{flex-wrap:wrap;gap:6px;display:flex}
.trp-tab{align-items:center;font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 10px;font-size:12px;line-height:18px;display:inline-flex;gap:6px}
.trp-tab:hover:not(.trp-tabActive){color:var(--dsw-alias-label-primary)}
.trp-tabActive{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}

@media (prefers-reduced-motion:reduce){.trp-footFill,.trp-barFill{transition:none}}
`;
		//#endregion
		//#region src/client/locales.ts
		/**
		* Trae 插件卡片与侧栏额度的多语言本地化词条。
		*
		* @module dsh-trae-connect/client/locales
		*/
		const en = {
			title: "Trae",
			intro: "Use the models from Trae directly in DSH — zero configuration, ready out of the box.",
			titleAI: "Trae Global",
			introAI: "Use the models from Trae Global directly in DSH — zero configuration, ready out of the box.",
			unifiedTitle: "Trae",
			unifiedIntro: "Manage Trae (China) and Trae Global (international) models, credentials, and sidebar quota displays.",
			variantTabCN: "China",
			variantTabAI: "International",
			expand: "Expand",
			collapse: "Collapse",
			loading: "Loading account…",
			signedOut: "Not signed in",
			signedOutHint: "Sign in to Trae to use its models in DSH.",
			signedOutHintAI: "Sign in to Trae Global to use its international models in DSH.",
			signIn: "Sign in",
			signInWaiting: "Waiting for you to finish signing in the browser…",
			signInOpenAgain: "Open the sign-in page again",
			signingIn: "Signing in…",
			signInFailed: "Sign-in failed: {message}",
			signInCancelled: "Sign-in cancelled",
			signOut: "Sign out",
			signingOut: "Signing out…",
			importHeading: "Or use a credential file",
			importHint: "Choose a trae.json you already have. It is validated and stored for this product only.",
			importAction: "Choose file…",
			importing: "Importing…",
			importFailed: "Import failed: {message}",
			importDone: "Imported {account}",
			switchAccount: "Switch account",
			switchingAccount: "Switching…",
			signedInAs: "Signed in as {nickname}",
			accessTokenExpires: "Access token expires {time} (refresh is automatic)",
			creditsHeading: "Remaining credit",
			tabStatus: "Status",
			tabContext: "Context window",
			tabModels: "Model Toggles",
			tabDetails: "Credit details",
			tabCheckIn: "Check-in log",
			checkInLogTime: "Check-in time",
			checkInLogResult: "Result",
			checkInLogAmount: "Credits",
			checkInLogEmpty: "No check-in logs recorded yet.",
			checkInNow: "Check in now",
			checkInChecking: "Checking in…",
			checkInRefresh: "Refresh",
			checkInRefreshing: "Refreshing…",
			checkInClear: "Clear logs",
			checkInClearing: "Clearing…",
			checkInClearSuccess: "Logs cleared",
			checkInNextRun: "Next automatic check-in: {time}",
			creditsDetailHeading: "By package",
			creditsTotal: "Total: {total}",
			creditsTotalUnlimited: "Total: Unlimited",
			unlimitedQuota: "Unlimited",
			packageEnterprise: "Enterprise quota",
			cycleResetAt: "Resets {time}",
			percentRemaining: "{percent}% remaining",
			percentUnknown: "Remaining share unknown",
			exactRemaining: "{remain} / {size} remaining",
			creditPackageUnknownSize: "{remain} remaining",
			creditsError: "Credit unavailable: {message}",
			refresh: "Refresh",
			refreshing: "Refreshing…",
			refreshModels: "Refresh model list",
			refreshingModels: "Refreshing models…",
			catalogLive: "Model list updated {time}",
			catalogSaved: "Showing the saved model list from {time}",
			catalogFallback: "Showing the built-in model list (not yet updated from Trae)",
			catalogError: "Last update failed: {message}",
			catalogAppVersion: "App version {version}",
			requestFailed: "Request failed",
			statusRefreshFailed: "Refresh failed: {message} — showing the last known state",
			statusResponseInvalid: "Trae returned an unreadable status reply",
			accountHeading: "Account",
			modelsHeading: "Model offers",
			contextHeading: "Context window",
			contextUpTo: "up to {size}",
			contextDefault: "default {size}",
			useMaximumContextWindow: "Use the largest declared context window",
			useMaximumContextWindowHint: "Applies to Trae Global models that offer a larger window.",
			freeModel: "Free",
			badgeLimitedFree: "Limited-time free",
			badgeNightDiscount: "Night discount",
			badgeFreeNow: "Free now",
			rate: "{rate} credits per message",
			rateUnknown: "Price unavailable — refresh to update",
			modelsSearchPlaceholder: "Search models…",
			modelsSelectAll: "Select all",
			modelsEnableAll: "Enable all",
			modelsDisableAll: "Disable all",
			modelsEnabledCount: "{enabled} / {total} models enabled",
			modelsNoMatch: "No matching models found",
			probeLabel: "Reasoning levels",
			probeTooltipIdle: "Detect the reasoning levels {model} accepts",
			probeTooltipVerified: "Accepted levels: {levels} · click to detect again",
			probeTooltipNotValidating: "This model does not check the effort parameter",
			probeTooltipRetry: "Detection did not complete · click to retry",
			probeBubbleBody: "Send test requests to confirm the available reasoning levels. May consume a small amount of credit.",
			probeConfirmAction: "Confirm",
			probeNoteVerified: "Detected: {levels}",
			probeNoteNotValidating: "This model does not check the effort parameter",
			probeNoteUnknown: "Detection did not complete",
			probeNoteDismiss: "Got it",
			probeHeading: "Reasoning effort detection",
			probeResultNoLevels: "No tested levels were accepted.",
			probeIntro: "Some models reason but declare no selectable effort levels. Detecting which levels a model accepts sends a few real requests that may consume credit.",
			probeConsentHint: "Each detection sends test requests to one model to confirm its available reasoning levels, and may consume a small amount of credit.",
			probeStart: "Detect",
			probeRedetect: "Detect again",
			probeRunning: "Detecting {model}…",
			probeRunningGeneric: "Detecting…",
			probeClear: "Clear detected results",
			probeCandidates: "Detectable models: {count}",
			probeConfirmBody: "Send test requests to {model} to confirm its available reasoning levels. May consume a small amount of credit.",
			cancel: "Cancel",
			probeResultVerified: "Verified levels: {levels}",
			probeResultNotValidating: "This model does not check the effort parameter",
			probeResultUnknown: "Detection did not complete",
			probeResultAt: "Detected {time}",
			probeResultEmpty: "No detectable models right now.",
			probeFailed: "Detection failed: {message}",
			quotaSettingsTitle: "Trae sidebar display",
			quotaSettingsIntro: "Show remaining credit beside the sidebar Settings seat. Each toggle needs its variant signed in.",
			quotaToggleCN: "Show CN credit card",
			quotaToggleAI: "Show international credit card",
			quotaToggleHint: "Show this account’s remaining credit in the sidebar footer.",
			autoCheckInCN: "Trae (China) daily auto check-in",
			autoCheckInAI: "Trae Global (International) daily auto check-in",
			autoCheckInHintCN: "Automatically check in daily to claim benefits for the China account.",
			autoCheckInHintAI: "Automatically check in daily to claim available perks for the International account.",
			checkInTimeCN: "Check-in time (China)",
			checkInTimeAI: "Check-in time (International)",
			checkInTimeHint: "The moment the automatic check-in runs each day, in UTC+8.",
			autoCheckInStatusClaimed: "Checked in today (+{amount} Credits)",
			autoCheckInStatusAlready: "Already checked in today",
			autoCheckInStatusNoCampaign: "No active benefit campaign today",
			autoCheckInStatusError: "Auto check-in error: {message}",
			quotaSignInRequired: "Sign in first to enable this card.",
			quotaPollLabel: "Refresh interval",
			quotaPollHint: "Applies to both quota cards. Longer is kinder to the billing endpoint.",
			quotaPollUnit: "min",
			quotaSettingsSave: "Save",
			quotaSettingsSaving: "Saving…",
			quotaSettingsDiscard: "Discard",
			quotaSettingsDirty: "Unsaved changes",
			quotaSettingsInvalid: "A value is invalid — fix it before saving",
			quotaSettingsSaveFailed: "Save did not land — retry",
			quotaSettingsSavedHint: "Saved",
			quotaCardCN: "Trae credit",
			quotaCardAI: "Trae Global credit",
			quotaUnknownTotal: "total unknown",
			quotaUnlimited: "Unlimited",
			quotaExpires: "Expires",
			quotaNoExpiry: "No expiry",
			quotaError: "Credit unavailable",
			quotaNotSignedIn: "Sign in to see the remaining credit",
			quotaUpdated: "Updated",
			quotaDashboardTitle: "Trae quota",
			quotaDashboardSubtitle: "Remaining credit by package, per product",
			quotaRefresh: "Refresh",
			quotaRefreshing: "Refreshing…",
			quotaClose: "Close",
			quotaByPackage: "By package",
			quotaTotal: "Total",
			quotaTotalRemain: "Remaining",
			quotaTotalShare: "{percent} of this cycle’s granted total ({remain} / {size})",
			quotaColPackage: "Package",
			quotaColRemain: "Remaining / Total",
			quotaColExpiry: "Expires"
		};
		const zh = {
			title: "Trae（国内版）",
			intro: "统一管理 Trae（国内版）模型、凭据及侧栏额度展示。",
			titleAI: "Trae Global（国际版）",
			introAI: "统一管理 Trae Global（国际版）模型、凭据及侧栏额度展示。",
			unifiedTitle: "Trae",
			unifiedIntro: "统一管理 Trae（国内版）与 Trae Global（国际版）模型、凭据及侧栏额度展示。",
			variantTabCN: "国内版",
			variantTabAI: "国际版",
			expand: "展开",
			collapse: "收起",
			loading: "正在读取账号…",
			signedOut: "未登录",
			signedOutHint: "登录 Trae 后即可在 DSH 中使用它的模型。",
			signedOutHintAI: "登录 Trae Global 国际版后即可在 DSH 中使用它的模型。",
			signIn: "登录",
			signInWaiting: "请在浏览器中完成登录…",
			signInOpenAgain: "重新打开登录页面",
			signingIn: "正在登录…",
			signInFailed: "登录失败：{message}",
			signInCancelled: "已取消登录",
			signOut: "退出登录",
			signingOut: "正在退出…",
			switchAccount: "切换账号",
			switchingAccount: "正在切换…",
			importHeading: "或使用凭据文件",
			importHint: "选择你已有的 trae.json。插件会校验并只保存到本产品名下。",
			importAction: "选择文件…",
			importing: "正在导入…",
			importFailed: "导入失败：{message}",
			importDone: "已导入 {account}",
			signedInAs: "已登录：{nickname}",
			accessTokenExpires: "访问令牌 {time} 过期（自动续期）",
			creditsHeading: "剩余积分",
			tabStatus: "状态",
			tabContext: "上下文窗口",
			tabModels: "模型开关",
			tabDetails: "积分详情",
			tabCheckIn: "签到日志",
			checkInLogTime: "签到时间",
			checkInLogResult: "签到结果",
			checkInLogAmount: "获得额度",
			checkInLogEmpty: "暂无签到日志记录。",
			checkInNow: "立即签到",
			checkInChecking: "正在签到…",
			checkInRefresh: "刷新",
			checkInRefreshing: "正在刷新…",
			checkInClear: "清空日志",
			checkInClearing: "正在清空…",
			checkInClearSuccess: "日志已清空",
			checkInNextRun: "下次自动签到：{time}",
			creditsDetailHeading: "按套餐",
			creditsTotal: "合计：{total}",
			creditsTotalUnlimited: "合计：不限额",
			unlimitedQuota: "不限额",
			packageEnterprise: "企业额度",
			cycleResetAt: "重置时间：{time}",
			percentRemaining: "剩余 {percent}%",
			percentUnknown: "剩余占比未知",
			exactRemaining: "剩余 {remain} / {size}",
			creditPackageUnknownSize: "剩余 {remain}",
			creditsError: "积分查询失败：{message}",
			refresh: "刷新",
			refreshing: "正在刷新…",
			refreshModels: "刷新模型列表",
			refreshingModels: "正在刷新模型…",
			catalogLive: "模型列表更新于 {time}",
			catalogSaved: "当前显示已保存的模型列表，更新于 {time}",
			catalogFallback: "当前显示内置模型列表（尚未从 Trae 更新）",
			catalogError: "上次更新失败：{message}",
			catalogAppVersion: "App 版本 {version}",
			requestFailed: "请求失败",
			statusRefreshFailed: "刷新失败：{message} — 当前显示的是上次成功获取的状态",
			statusResponseInvalid: "Trae 返回的状态数据无法识别",
			accountHeading: "账号",
			modelsHeading: "模型优惠",
			contextHeading: "上下文窗口",
			contextUpTo: "最高 {size}",
			contextDefault: "默认 {size}",
			useMaximumContextWindow: "使用上游声明的最大上下文窗口",
			useMaximumContextWindowHint: "仅作用于 Trae Global 中声明了更大窗口的模型。",
			freeModel: "免费",
			badgeLimitedFree: "限时免费",
			badgeNightDiscount: "夜间折扣",
			badgeFreeNow: "限时免费",
			rate: "{rate} 积分/次",
			rateUnknown: "价格未知 — 刷新后更新",
			modelsSearchPlaceholder: "搜索模型…",
			modelsSelectAll: "全选",
			modelsEnableAll: "批量开启",
			modelsDisableAll: "批量关闭",
			modelsEnabledCount: "已开启 {enabled} / {total} 个模型",
			modelsNoMatch: "未找到匹配的模型",
			probeLabel: "推理等级",
			probeTooltipIdle: "检测 {model} 可用的推理档位",
			probeTooltipVerified: "已接受：{levels} · 点击可重新检测",
			probeTooltipNotValidating: "该模型不校验该参数",
			probeTooltipRetry: "检测未完成 · 点击重试",
			probeBubbleBody: "发送探测请求以确认可用推理档位。可能消耗少量积分。",
			probeConfirmAction: "确认检测",
			probeNoteVerified: "已检测：{levels}",
			probeNoteNotValidating: "该模型不校验该参数",
			probeNoteUnknown: "检测未完成",
			probeNoteDismiss: "知道了",
			probeHeading: "推理档位检测",
			probeResultNoLevels: "本次测试的档位均未被接受。",
			probeIntro: "部分模型具备思考能力，但没有声明可选档位。检测会发送少量真实请求，可能消耗积分。",
			probeConsentHint: "每次检测会向该模型发送探测请求，以确认可用推理档位，可能消耗少量积分。",
			probeStart: "开始检测",
			probeRedetect: "重新检测",
			probeRunning: "正在检测 {model}…",
			probeRunningGeneric: "正在检测…",
			probeClear: "清除已探测结果",
			probeCandidates: "可检测模型：{count} 个",
			probeConfirmBody: "向 {model} 发送探测请求，以确认可用推理档位。可能消耗少量积分。",
			cancel: "取消",
			probeResultVerified: "已验证接受的档位：{levels}",
			probeResultNotValidating: "该模型不校验该参数",
			probeResultUnknown: "检测未完成",
			probeResultAt: "检测于 {time}",
			probeResultEmpty: "当前没有可检测的模型。",
			probeFailed: "检测失败：{message}",
			quotaSettingsTitle: "Trae 侧栏展示",
			quotaSettingsIntro: "在侧栏设置项旁展示剩余积分。开关需要对应账号已登录。",
			quotaToggleCN: "展示国内版额度",
			quotaToggleAI: "展示国际版额度",
			quotaToggleHint: "在侧栏底部展示该账号的剩余积分。",
			autoCheckInCN: "Trae（国内版）每日自动签到",
			autoCheckInAI: "Trae Global（国际版）每日自动签到",
			autoCheckInHintCN: "每天自动签到，为国内版账号领取可用积分福利。",
			autoCheckInHintAI: "每天自动签到，为国际版账号领取可用福利额度。",
			checkInTimeCN: "签到时间（国内版）",
			checkInTimeAI: "签到时间（国际版）",
			checkInTimeHint: "每天执行自动签到的时刻，按北京时间（UTC+8）。",
			autoCheckInStatusClaimed: "今日已自动签到（+{amount} 积分）",
			autoCheckInStatusAlready: "今日已完成签到",
			autoCheckInStatusNoCampaign: "今日无可用签到福利活动",
			autoCheckInStatusError: "自动签到出错：{message}",
			quotaSignInRequired: "请先登录后再开启。",
			quotaPollLabel: "刷新间隔",
			quotaPollHint: "对两张额度卡片同时生效。间隔越长对计费接口越友好。",
			quotaPollUnit: "分钟",
			quotaSettingsSave: "保存",
			quotaSettingsSaving: "保存中…",
			quotaSettingsDiscard: "放弃更改",
			quotaSettingsDirty: "有未保存的更改",
			quotaSettingsInvalid: "有数值不合法，请修正后再保存",
			quotaSettingsSaveFailed: "保存未生效，请重试",
			quotaSettingsSavedHint: "已保存",
			quotaCardCN: "Trae 积分",
			quotaCardAI: "Trae Global 积分",
			quotaUnknownTotal: "总量未知",
			quotaUnlimited: "不限量",
			quotaExpires: "到期",
			quotaNoExpiry: "无到期时间",
			quotaError: "积分信息不可用",
			quotaNotSignedIn: "登录后显示剩余积分",
			quotaUpdated: "更新于",
			quotaDashboardTitle: "Trae 额度",
			quotaDashboardSubtitle: "按套餐展示各产品的剩余积分",
			quotaRefresh: "刷新",
			quotaRefreshing: "刷新中…",
			quotaClose: "关闭",
			quotaByPackage: "按套餐",
			quotaTotal: "合计",
			quotaTotalRemain: "剩余积分",
			quotaTotalShare: "占本轮总额度 {percent}（{remain} / {size}）",
			quotaColPackage: "资源包",
			quotaColRemain: "剩余 / 总量",
			quotaColExpiry: "到期时间"
		};
		//#endregion
		//#region src/client/index.tsx
		/**
		* 浏览器端入口：Trae 账号状态、额度卡片与插件配置贡献。
		*
		* @module dsh-trae-connect/client
		*/
		/** 浏览器端插件标识名 */
		const name = "dsh-trae-connect-client";
		/** 插件配置贡献所依赖的客户端服务清单 */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.session",
			"settingsScope"
		];
		/** 各版本卡片所对应的后端状态端点路径映射 */
		const VARIANT_STATUS = {
			trae: TRAE_STATUS_PATH,
			"trae-ai": TRAE_AI_STATUS_PATH
		};
		/**
		* 注册卡片文案、统一 Trae 配置卡片以及侧边栏额度卡片。
		*
		* 整个函数体由 try/catch 包裹，确保即便 DSH 宿主环境的 Slot API 发生变动，
		* 也仅在控制台输出警告，而不会抛出异常破坏 DSH 的插件加载机制。
		*/
		function apply(ctx) {
			try {
				const namespace = "settings.trae";
				ctx.effect(() => ctx.locale.register(namespace, {
					zh,
					en
				}), "dsh-trae-connect: settings copy");
				const t = ctx.locale.bind(namespace);
				let quotaScope;
				try {
					const scope = ctx.settingsScope.bind({ namespace: "trae-quota" });
					quotaScope = scope;
					const applySnapshot = () => {
						const value = scope.getSnapshot().value;
						setQuotaToggles(value?.sidebarQuotaCN === true, value?.sidebarQuotaAI === true);
						if (typeof value?.quotaPollMs === "number") setQuotaPollMs(value.quotaPollMs);
					};
					applySnapshot();
					scope.subscribe(applySnapshot);
				} catch (error) {
					console.error("[dsh-trae-connect] 额度设置作用域不可用（侧栏额度卡片将隐藏）:", error);
				}
				ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
					name: "settings.plugin.item",
					key: "trae",
					priority: 10,
					inject: () => ({
						t,
						scope: quotaScope,
						signedIn: () => quotaSignInState(),
						unified: true
					})
				}, TraePluginCard));
				const QUOTA_PANEL_ID = "trae-quota-panel";
				const CONVERSATION_PANEL_ID = "conversation";
				const dashboardDocuments = {
					cn: void 0,
					ai: void 0
				};
				let dashboardFetchedAt;
				let dashboardLoading = false;
				let dashboardRequestedPath = TRAE_STATUS_PATH;
				/** 记录看板当前是否在中心面板展示 */
				let quotaPanelOpen = false;
				const dashboardListeners = /* @__PURE__ */ new Set();
				let dashboardSnap = {
					documents: [void 0, void 0],
					fetchedAt: void 0,
					loading: false,
					activePath: TRAE_STATUS_PATH
				};
				const rebuildSnapshot = () => {
					const next = {
						documents: [dashboardDocuments.cn, dashboardDocuments.ai],
						fetchedAt: dashboardFetchedAt,
						loading: dashboardLoading,
						activePath: dashboardRequestedPath
					};
					if (JSON.stringify(next) !== JSON.stringify(dashboardSnap)) {
						dashboardSnap = next;
						for (const listener of dashboardListeners) listener();
					}
				};
				const dashboardSource = {
					getSnapshot: () => dashboardSnap,
					subscribe: (listener) => {
						dashboardListeners.add(listener);
						return () => {
							dashboardListeners.delete(listener);
						};
					}
				};
				const notifyDashboard = () => {
					rebuildSnapshot();
				};
				/**
				* 刷新当前所选版本的额度状态数据
				*/
				const refreshDashboard = async (options = {}) => {
					if (dashboardLoading) return;
					const variantId = variantOfStatusPath(dashboardRequestedPath);
					if (options.force !== true && quotaStatusIsFresh(variantId, quotaPollMs())) return;
					dashboardLoading = true;
					rebuildSnapshot();
					try {
						const result = await (variantId === "trae" ? fetchStatusDocument(TRAE_STATUS_PATH) : fetchStatusDocument(TRAE_AI_STATUS_PATH));
						if (result !== void 0) {
							if (variantId === "trae") dashboardDocuments.cn = result;
							else dashboardDocuments.ai = result;
							noteQuotaStatus(variantId, result);
						}
						dashboardFetchedAt = Date.now();
					} finally {
						dashboardLoading = false;
						rebuildSnapshot();
					}
				};
				let dashboardTimer;
				const startDashboardPoll = () => {
					if (dashboardTimer !== void 0) return;
					refreshDashboard();
					dashboardTimer = window.setInterval(() => {
						if (document.hidden) return;
						refreshDashboard();
					}, Math.max(6e4, quotaPollMs()));
				};
				const stopDashboardPoll = () => {
					if (dashboardTimer === void 0) return;
					window.clearInterval(dashboardTimer);
					dashboardTimer = void 0;
				};
				async function fetchStatusDocument(path) {
					try {
						const response = await fetch(path, { headers: { accept: "application/json" } });
						const body = await response.json();
						return response.ok && isTraeWebStatus(body) ? body : void 0;
					} catch {
						return;
					}
				}
				function QuotaDashboardWithLifecycle(props) {
					(0, react.useEffect)(() => {
						quotaPanelOpen = true;
						startDashboardPoll();
						return () => {
							quotaPanelOpen = false;
							stopDashboardPoll();
						};
					}, []);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuotaDashboard, { ...props });
				}
				const panelFace = () => ({
					hooks: { quotaDashboard: dashboardSource },
					t,
					statusPaths: [TRAE_STATUS_PATH, TRAE_AI_STATUS_PATH],
					refresh: () => {
						refreshDashboard({ force: true });
					},
					onVariantPicked: (path) => {
						dashboardRequestedPath = path;
						notifyDashboard();
						refreshDashboard();
					},
					close: () => {
						const layout = ctx.get("layout");
						if (typeof layout?.selectPanel !== "function") return;
						try {
							layout.selectPanel(null);
						} catch {
							try {
								layout.selectPanel(CONVERSATION_PANEL_ID);
							} catch (error) {
								console.error("[dsh-trae-connect] 关闭额度看板失败:", error);
							}
						}
					}
				});
				ctx.effect(() => injectQuotaCss(), "dsh-trae-connect: quota styles");
				try {
					ctx.slots.inject("main", () => ctx.slots.register({
						name: "main",
						key: QUOTA_PANEL_ID,
						locale: "panel.trae-quota",
						inject: panelFace
					}, QuotaDashboardWithLifecycle));
				} catch (error) {
					console.error("[dsh-trae-connect] 注册额度中心看板失败:", error);
				}
				ctx.inject(["layout"], (layoutCtx) => {
					if (typeof layoutCtx.get("layout")?.selectPanel !== "function") return;
					try {
						for (const variant of CARD_VARIANTS) {
							const statusPath = VARIANT_STATUS[variant.id];
							if (statusPath === void 0) continue;
							const injected = {
								t,
								statusPath,
								open: () => {
									const current = layoutCtx.get("layout");
									if (typeof current?.selectPanel !== "function") return;
									if (quotaPanelOpen && dashboardRequestedPath === statusPath) {
										current.selectPanel(null);
										return;
									}
									dashboardRequestedPath = statusPath;
									notifyDashboard();
									refreshDashboard();
									current.selectPanel(QUOTA_PANEL_ID);
								}
							};
							layoutCtx.slots.inject("sidebar.footer.action", () => layoutCtx.slots.register({
								name: "sidebar.footer.action",
								id: variant.id === "trae" ? "trae-quota" : "trae-quota-ai",
								order: variant.id === "trae" ? 20 : 21,
								locale: "panel.trae-quota",
								inject: () => injected
							}, SidebarQuotaCard));
						}
					} catch (error) {
						console.error("[dsh-trae-connect] 注册侧边栏额度卡片失败:", error);
					}
				});
				ctx.inject(["modelDirectories"], (scope) => {
					scope.slots.inject("conversation.input.right", () => scope.slots.register({
						name: "conversation.input.right",
						id: "trae-probe",
						order: 10,
						inject: (sessionId) => ({
							directory: scope.modelDirectories.directoryFor(sessionId).store,
							t
						})
					}, TraeProbeControl));
				});
			} catch (error) {
				console.error("[dsh-trae-connect] 客户端卡片加载失败（后端模型服务不受影响）:", error);
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
