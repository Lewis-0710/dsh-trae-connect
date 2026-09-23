# DSH Trae Connect

English | [中文](./README.md)

Bring ByteDance **Trae** (China) and **Trae Global** models seamlessly into DeepSeek Harness (DSH) for a native AI coding and reasoning experience directly within your chat sessions and workflows.

Both domestic **Trae** and international **Trae Global** versions are fully supported side by side: each signs in independently, manages its own account credentials and quota balance, and registers its own model group when authenticated.

**Ready out of the box with zero app dependency**: Initiate official OAuth authorization directly in your browser from the DSH settings panel without needing the Trae desktop application installed locally. Credentials can also be imported from local installations or specified JSON tokens with a single click.

---

## Key Features

- **Direct In-Browser OAuth & Silent Token Refresh**:
  Clicking "Sign in to Trae" initiates the official OAuth web authorization flow. Once authenticated, access tokens are retrieved and silently refreshed in the background without user intervention.
- **Dual-Variant Concurrency (China & Global)**:
  - Domestic models are registered under the **Trae** group, while international models appear under **Trae Global**. Accounts, model catalogs, and quota pools remain strictly isolated.
  - A unified settings card with a top **segmented variant switcher** and **live status dots** (green for connected / grey for signed-out) provides smooth one-click toggling.
  - Signing into either version activates its respective models; signing out cleanly clears the model group and local credentials.
- **16 + 17 Full Model Matrix & Rate Badges**:
  - Full access to all **16 domestic models** and **17 international models** (both including the Auto smart router).
  - Matches WorkBuddy display specifications by formatting model names with ` · `, including credit multiplier rates and promotional badges (e.g., `GLM-5.3 · x0.78`, `DeepSeek-V4-Flash Official · x0.16`, `Auto · Smart Router`, `Seed-Code · x0.06 · Free Promo`).
- **Maximum Context Window Control**:
  - Both domestic and international variants provide a toggle for "**Use upstream declared maximum context window**" (enabled by default).
  - When enabled, DSH schedules compaction and context handling up to the upstream maximum capacity (e.g., 200K / 272K Tokens). It can be reverted to standard defaults anytime, with preferences persisted across restarts.
- **Daily Benefit Auto Check-in & History Logs**:
  - Integrated daily check-in scheduler runs at your configured time (defaults to 10:00 AM UTC+8) to automatically claim daily bonus quota.
  - Features **catch-up on launch** to prevent missed check-ins and **concurrency protection locks**. A persistent "Check-in Log" tab offers historical tracking, manual "Check in Now", and log clearing.
- **Sidebar Quota Badge & Central Dashboard**:
  - When enabled, a compact circular progress bar with quota remaining is permanently rendered at the bottom of the DSH sidebar.
  - Clicking the sidebar card opens a rich, full-detail quota dashboard in the central pane, listing every benefit pack (free quota, bonus credits, subscription packs) with remaining credits, total allocation, mini progress bars, and expiration dates.
- **Model Toggles & Multi-Dimensional Search**:
  - A dedicated "Models" tab allows instant filtering by model name or ID.
  - Freely toggle individual models on or off, or use "Enable All" / "Disable All" bulk controls. Settings persist per variant.
- **Reasoning Effort & Chain-of-Thought Streaming**:
  - Automatically extracts `reasoning_content` from reasoning models to render the complete thought process in real time.
  - Supports adjusting reasoning effort (low / high / max) adjacent to the prompt input and includes dynamic probe capabilities.
- **Protocol Optimization & Human-Readable Error Codes**:
  - Upstream communication channels (`solo_work_remote` / `solo_agent`) and production client fingerprints eliminate `4001 param is invalid` errors.
  - Status codes like 4120 (Pro membership required), 4008 (Quota exceeded), 4003 (Token expired), and 4029 (Concurrency limit) are translated into clear, actionable messages.
- **Multimodal Image Input**:
  - Supports direct drag-and-drop, pasting, or file uploads for vision-enabled models.

---

## Model Catalogs

### Domestic Trae (16 Models)

| Model ID | Display Name | Multiplier | Default Context | Channel Type |
|---|---|---|---|---|
| `auto` | Auto · Smart Router | — | 200,000 | Dynamic Router |
| `Doubao-Seed-Evolving` | Seed-Evolving · x0.80 | x0.80 | 200,000 | solo_work_remote |
| `Doubao-Seed-2.1-Pro` | Seed-2.1-Pro-0915 · x0.80 | x0.80 | 200,000 | solo_work_remote |
| `Doubao-Seed-2.1-Turbo` | Seed-2.1-Turbo · x0.20 | x0.20 | 200,000 | solo_work_remote |
| `Doubao-Seed-Code` | Seed-Code · x0.06 | x0.06 | 200,000 | solo_agent_remote |
| `step-5-preview` | Step-5-Preview · x0.48 | x0.48 | 200,000 | solo_work_remote |
| `glm-5.3` | GLM-5.3 · x0.78 | x0.78 | 200,000 | solo_work_remote |
| `glm-5.2` | GLM-5.2 · x0.78 | x0.78 | 200,000 | solo_work_remote |
| `DeepSeek-V4-Flash-Official` | DeepSeek-V4-Flash Official · x0.16 | x0.16 | 200,000 | solo_work_remote |
| `DeepSeek-V4-Pro-Official` | DeepSeek-V4-Pro Official · x0.72 | x0.72 | 200,000 | solo_work_remote |
| `kimi-k3` | Kimi-K3 · x1.83 | x1.83 | 200,000 | solo_work_remote |
| `kimi-k2.7-code` | Kimi-K2.7-Code · x0.83 | x0.83 | 200,000 | solo_work_remote |
| `kimi-k2.6` | Kimi-K2.6 · x0.75 | x0.75 | 200,000 | solo_work_remote |
| `minimax-m3` | MiniMax-M3 · x0.26 | x0.26 | 200,000 | solo_work_remote |
| `qwen3.8-max` | Qwen3.8-Max · x1.50 | x1.50 | 200,000 | solo_work_remote |
| `qwen-3.7-plus` | Qwen3.7-Plus · x0.25 | x0.25 | 200,000 | solo_work_remote |

### International Trae Global (17 Models)

| Model ID | Display Name | Multiplier | Default Context | Channel Type |
|---|---|---|---|---|
| `auto` | Auto · Smart Router | — | 200,000 | Dynamic Router |
| `Dola-Seed-2.0-Code` | Seed-2.1-Turbo | — | 200,000 | solo_agent |
| `gpt-6-astra` | GPT-6-Astra | — | 272,000 | solo_agent |
| `gpt-5.6-sol` | GPT-5.6-Sol | — | 272,000 | solo_agent |
| `gpt-5.6-terra` | GPT-5.6-Terra | — | 272,000 | solo_agent |
| `gpt-5.6-luna` | GPT-5.6-Luna | — | 272,000 | solo_agent |
| `gpt-5.5` | GPT-5.5 | — | 272,000 | solo_agent |
| `gpt-5.4` | GPT-5.4 | — | 272,000 | solo_agent |
| `gpt-5.2` | GPT-5.2 | — | 272,000 | solo_agent |
| `glm-5.2` | GLM-5.2 | — | 200,000 | solo_agent |
| `deepseek-v4-flash-0731` | DeepSeek-V4-Flash | — | 200,000 | solo_agent |
| `kimi-k2.7-code` | Kimi-K2.7-Code | — | 200,000 | solo_agent |
| `kimi-k2.5` | Kimi-K2.5 | — | 200,000 | solo_agent |
| `gemini-3.1-pro` | Gemini-3.1-Pro-Preview | — | 200,000 | solo_agent |
| `gemini-3-flash-solo` | Gemini-3-Flash-Preview | — | 200,000 | solo_agent |
| `minimax-m3` | MiniMax-M3 | — | 200,000 | solo_agent |
| `minimax-m2.7` | MiniMax-M2.7 | — | 200,000 | solo_agent |

---

## Settings Card & Tabs

Inside DSH under **Settings → Plugins → Trae**:
1. **Global Header Controls**:
   - Sidebar quota display toggles (independently configurable for China / Global).
   - Daily automatic check-in scheduler and trigger time (`HH:MM UTC+8`).
   - Quota refresh interval (defaults to 5 minutes, configurable from 1 to 60 minutes).
2. **Segmented Version Switcher**:
   - Switch between "国内版 (Trae)" and "国际版 (Trae Global)" with live session indicator dots.
3. **Account Status Bar**:
   - Displays avatar, nickname, UID, and token expiration with actions to "Refresh Status", "Switch Account", "Sign Out", and "Refresh Models".
4. **Five Core Tabs**:
   - **Status**: View catalog source (Live upstream / Cached / Fallback), last updated timestamp, total balance, and reasoning effort probe status.
   - **Context**: View context window capacities and toggle the upstream maximum context window switch.
   - **Models**: Filter models by query and toggle them individually or in bulk.
   - **Credits**: Itemized breakdown of all active resource packages with remaining amounts, total allotments, progress bars, and expiration dates.
   - **Check-in**: Audit trail of daily check-ins with quick actions to "Check in Now" and "Clear Logs".

---

## Data Storage Layout

Data is strictly isolated per DSH profile under `$DSH_HOME/profiles/<profile>/.dsh-trae-connect/` (e.g., `~/.dsh/profiles/desktop/.dsh-trae-connect/`):

```text
$DSH_HOME/profiles/<profile>/.dsh-trae-connect/
├── .trae-auth.json                  # Domestic auth credentials
├── .trae-ai-auth.json               # International auth credentials
└── state/
    ├── .trae-catalog.json           # Cached domestic model catalog
    ├── .trae-ai-catalog.json        # Cached international model catalog
    ├── .trae-probe.json             # Domestic reasoning effort probe cache
    ├── .trae-ai-probe.json          # International reasoning effort probe cache
    ├── checkin-status.json          # Daily check-in status and history logs
    └── .trae-host-heartbeat.json    # Host process heartbeat
```

- **Tiered Safe Storage**: Authentication secrets live at the data root, while rebuildable caches live under `state/`. Clearing caches never invalidates user login sessions.
- **Atomic File Operations**: All state writes use temporary files with atomic rename operations to prevent partial writes and file locks.
- **Custom Location**: Override the default location by setting the `DSH_TRAE_DATA_DIR` environment variable.

---

## CLI Reference

A comprehensive CLI is included for headless servers, TUI sessions, or automation scripts:

```sh
# 1. Login flow (opens default browser or prints authorization URL)
dsh plugin --profile web exec dsh-trae-connect login
# For Trae Global:
dsh plugin --profile web exec dsh-trae-connect login --provider trae-global

# 2. Inspect status and quota balance (--json for machine parsing)
dsh plugin --profile web exec dsh-trae-connect status
dsh plugin --profile web exec dsh-trae-connect status --provider trae-global --json

# 3. Environment diagnostics and connectivity checks
dsh plugin --profile web exec dsh-trae-connect doctor
dsh plugin --profile web exec dsh-trae-connect doctor --provider trae-global

# 4. Import existing credentials file
dsh plugin --profile web exec dsh-trae-connect import --file ./trae-credentials.json
dsh plugin --profile web exec dsh-trae-connect import --provider trae-global --file ./trae-ai.json

# 5. Sign out and purge local credentials
dsh plugin --profile web exec dsh-trae-connect logout
dsh plugin --profile web exec dsh-trae-connect logout --provider trae-global
```

---

## Installation

Works seamlessly across all three DSH environments: **Web**, **Desktop**, and **TUI**.

```sh
# Web Profile (Recommended)
dsh plugin --profile web add github:masknull/dsh-trae-connect
dsh web

# Desktop Profile (DSH Desktop)
dsh plugin --profile desktop add github:masknull/dsh-trae-connect
dsh --profile desktop

# TUI Profile (Terminal Interface)
dsh plugin --profile dsh-tui add github:masknull/dsh-trae-connect
dsh --profile dsh-tui
```

> **Requirements**:
> - DSH Core: `0.1.5-rc.1` or higher.
> - Node.js: `^22.19.0 || >=24.0.0`.
> - Pre-built `lib/` artifacts are included in the repository for an immediate, build-free installation.

---

## Local Development & Testing

```sh
# Install dependencies
pnpm install

# TypeScript type checks
pnpm run typecheck

# Automated unit tests (10 test suites, 33 unit tests)
pnpm run test

# Production build
pnpm run build

# Comprehensive verification pipeline
pnpm run check
```

---

## Disclaimer

- This project is provided for **personal learning and research purposes only**, driving the user's own Trae account on the local machine. Commercial use or actions violating upstream terms of service are strictly prohibited.
- Users must comply with the terms of service of ByteDance and Trae. Any consequences arising from the use of this plugin are solely the user's responsibility.
- This project is not affiliated with, endorsed by, or connected to ByteDance, Trae, or DeepSeek. All trademarks belong to their respective owners.

---

## License

This project is licensed under the [MIT License](./LICENSE).
