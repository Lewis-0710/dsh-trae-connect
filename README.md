# DSH Trae Connect

[English](./README.en.md) | 中文

将字节跳动 **Trae**（国内版）与 **Trae Global**（国际版）的模型完整接入 DeepSeek Harness (DSH)，在对话窗口与工作流中直接畅享原生 AI 编码体验。

国内版 **Trae** 与国际版 **Trae Global** 深度支持双版本并存：两版各自独立登录、各自管理账号与额度，登录哪一版就出现哪一版的分组，两版都登录则两组并存。

**开箱即用，无需本地安装 Trae 桌面端**：直接在 DSH 设置面板发起浏览器官方授权登录，亦支持从本机已安装客户端一键导入凭证或直接导入 Token。

---

## 核心特性

- **直接登录授权与无感续期**：
  点击「登录 Trae」自动拉起系统默认浏览器进行官方 OAuth 授权，授权成功后自动换取访问令牌并自动在后台静默刷新，无需手动干预。支持从本地桌面端快速导入或直接传入 JSON 凭证。
- **国内版与国际版双版本并存**：
  - 国内版分组命名为 **Trae**，国际版分组命名为 **Trae Global**，两版账号、模型目录与额度池完全隔离。
  - 设置面板统一为单个卡片，顶部配备**分段切换器**与**实时登录状态指示灯**（绿灯在线 / 灰灯未登录），随心无缝切换。
  - 登录任一版本即激活对应模型组，退出登录即安全清除该版本分组与本地凭证。
- **16 + 17 全模型矩阵与倍率徽章展示**：
  - 完整接入国内版 **16 款模型** 与国际版 **17 款模型**（均包含 Auto 智能路由），支持全部最新旗舰与推理模型。
  - 对齐 WorkBuddy 命名规范，以 ` · ` 分隔呈现模型名称、积分消耗倍率与活动标签（例如：`GLM-5.3 · x0.78`、`DeepSeek-V4-Flash 正式版 · x0.16`、`Auto · 智能路由`、`Seed-Code · x0.06 · 限时免费`）。
- **最大上下文窗口智能管理**：
  - 国内版与国际版均支持「**使用上游声明的最大上下文窗口**」开关（默认开启）。
  - 开启后 DSH 将根据上游声明的最大可用上下文（如 200K / 272K Tokens）进行压缩调度与深度长文本处理，亦可在设置面板中一键回退到默认标准窗口，偏好设置自动持久化保存。
- **每日福利自动签到与日志持久化**：
  - 内置每日自动签到调度器，按指定时间（默认北京时间每日 10:00，`HH:MM UTC+8`）自动为已登录账号领取福利赠送额度。
  - 具备**开机防漏签补签机制（Catch-up）**与**防并发击穿锁**；面板常驻「签到日志」标签页，提供流水追溯、单飞「立即签到」与「清空日志」快捷管理。
- **侧边栏额度常驻与中心沉浸式看板**：
  - 开启侧栏展示后，在 DSH 侧边栏底部常驻渲染迷你环形进度条与剩余额度百分比。
  - 点击侧栏卡片即可在主工作区弹出中心沉浸式额度详情大看板，按权益包（免费额度、赠送额度、会员额度等）逐项列出剩余积分、总额与到期时间（已用尽未到期包亦可追溯），双向数据共享且支持智能防刷节流。
- **模型自由开关与多维检索**：
  - 设置面板提供「模型开关」专页，可按模型名或模型 ID 即时检索。
  - 支持单个模型独立启用/隐藏，以及一键「全选开启」与「全选关闭」，自定义配置按版本独立保存在本地。
- **推理档位探测与思维链展示（Reasoning Effort）**：
  - 完整提取深度思考模型的 `reasoning_content` 思维链，实时呈现思考过程。
  - 支持在对话输入区域调节推理努力程度（low / high / max），提供推理档位兼容性探测能力。
- **底层协议调优与语义化错误提示**：
  - 采用官方合规客户端指纹与通信通道（`solo_work_remote` / `solo_agent`），彻底杜绝由于缺少参数引发的 `4001 param is invalid` 错误。
  - 对 4120（需要 Pro 会员权限）、4008（额度超限/耗尽）、4003（凭证失效）、4029（上游并发受限）等官方状态码提供人性化中文错误引导。
- **多模态图像输入**：
  - 对支持图像输入的多模态模型，支持直接在对话窗口中拖拽、粘贴或上传图片进行视觉问答与代码分析。

---

## 模型矩阵一览

### 国内版 Trae（共 16 款模型）

| 模型标识 (ID) | 展示名称 | 积分倍率 | 默认上下文 | 通道类型 |
|---|---|---|---|---|
| `auto` | Auto · 智能路由 | — | 200,000 | 动态智能路由 |
| `Doubao-Seed-Evolving` | Seed-Evolving · x0.80 | x0.80 | 200,000 | solo_work_remote |
| `Doubao-Seed-2.1-Pro` | Seed-2.1-Pro-0915 · x0.80 | x0.80 | 200,000 | solo_work_remote |
| `Doubao-Seed-2.1-Turbo` | Seed-2.1-Turbo · x0.20 | x0.20 | 200,000 | solo_work_remote |
| `Doubao-Seed-Code` | Seed-Code · x0.06 | x0.06 | 200,000 | solo_agent_remote |
| `step-5-preview` | Step-5-Preview · x0.48 | x0.48 | 200,000 | solo_work_remote |
| `glm-5.3` | GLM-5.3 · x0.78 | x0.78 | 200,000 | solo_work_remote |
| `glm-5.2` | GLM-5.2 · x0.78 | x0.78 | 200,000 | solo_work_remote |
| `DeepSeek-V4-Flash-Official` | DeepSeek-V4-Flash 正式版 · x0.16 | x0.16 | 200,000 | solo_work_remote |
| `DeepSeek-V4-Pro-Official` | DeepSeek-V4-Pro 正式版 · x0.72 | x0.72 | 200,000 | solo_work_remote |
| `kimi-k3` | Kimi-K3 · x1.83 | x1.83 | 200,000 | solo_work_remote |
| `kimi-k2.7-code` | Kimi-K2.7-Code · x0.83 | x0.83 | 200,000 | solo_work_remote |
| `kimi-k2.6` | Kimi-K2.6 · x0.75 | x0.75 | 200,000 | solo_work_remote |
| `minimax-m3` | MiniMax-M3 · x0.26 | x0.26 | 200,000 | solo_work_remote |
| `qwen3.8-max` | Qwen3.8-Max · x1.50 | x1.50 | 200,000 | solo_work_remote |
| `qwen-3.7-plus` | Qwen3.7-Plus · x0.25 | x0.25 | 200,000 | solo_work_remote |

### 国际版 Trae Global（共 17 款模型）

| 模型标识 (ID) | 展示名称 | 积分倍率 | 默认上下文 | 通道类型 |
|---|---|---|---|---|
| `auto` | Auto · 智能路由 | — | 200,000 | 动态智能路由 |
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

*注：模型列表与倍率在启动或点击「刷新模型列表」时会自动从 Trae 服务端同步最新状态。*

---

## 设置面板五大 Tab

在 DSH 的「设置 → 插件 → Trae」卡片中：
1. **顶部全局控制**：
   - 额度侧栏展示开关（国内版 / 国际版独立控制）
   - 每日自动签到开关及签到时刻设定（`HH:MM UTC+8`）
   - 额度自动刷新间隔（默认 5 分钟，支持 1~60 分钟自定义）
2. **版本分段切换**：
   - 单击「国内版 (Trae)」或「国际版 (Trae Global)」即时切换，状态指示灯直观反馈当前登录态。
3. **账号卡片**：
   - 展示当前用户头像/昵称、UID、Token 有效期。提供「刷新状态」、「切换账号」、「退出登录」与「刷新模型列表」。
4. **五大核心 Tab 标签页**：
   - **状态 (Status)**：查看当前使用的模型目录来源（实时上游 / 已保存缓存 / 内置兜底）、更新时间、总积分概览与推理档位状态。
   - **上下文 (Context)**：展示各模型的上下文窗口容量，并可切换「使用上游声明的最大上下文窗口」（国内版与国际版均原生支持）。
   - **模型 (Models)**：支持模型搜索与批量启用/禁用，随心精简模型列表。
   - **明细 (Credits)**：以列表形式逐条展现各权益包剩余量、总额度、进度条与到期时间。
   - **签到 (Check-in)**：查看自动签到流水日志，提供「立即签到」与「清空日志」管理操作。

---

## 数据文件布局

所有本地数据按 DSH Profile 严格物理隔离，默认保存在 `$DSH_HOME/profiles/<profile>/.dsh-trae-connect/` 下（例如 `~/.dsh/profiles/desktop/.dsh-trae-connect/`）：

```text
$DSH_HOME/profiles/<profile>/.dsh-trae-connect/
├── .trae-auth.json                  # 国内版身份凭据（Token / 密钥）
├── .trae-ai-auth.json               # 国际版身份凭据
└── state/
    ├── .trae-catalog.json           # 国内版已保存模型目录
    ├── .trae-ai-catalog.json        # 国际版已保存模型目录
    ├── .trae-probe.json             # 国内版推理档位探测持久化
    ├── .trae-ai-probe.json          # 国际版推理档位探测持久化
    ├── checkin-status.json          # 每日自动签到状态与历史日志
    └── .trae-host-heartbeat.json    # 宿主心跳数据
```

- **分层安全存储**：身份凭据位于根目录，可重建的缓存与状态数据存放于 `state/` 子目录；清理缓存绝不破坏用户登录凭据。
- **原子写保护**：所有持久化文件均使用“临时文件 + 独占重命名”原子写入，彻底避免文件写入中断或锁竞争。
- **自定义路径**：可通过环境变量 `DSH_TRAE_DATA_DIR` 显式重定向数据目录。

---

## 命令行工具（CLI）

插件自带完整的 CLI 终端管理指令，适用于无头服务器、TUI 环境或快捷维护：

```sh
# 1. 登录授权（自动拉起浏览器，支持终端打印授权链接）
dsh plugin --profile web exec dsh-trae-connect login
# 国际版登录：
dsh plugin --profile web exec dsh-trae-connect login --provider trae-global

# 2. 查询状态与额度信息（加 --json 可供脚本解析）
dsh plugin --profile web exec dsh-trae-connect status
dsh plugin --profile web exec dsh-trae-connect status --provider trae-global --json

# 3. 运行环境诊断与网络检查
dsh plugin --profile web exec dsh-trae-connect doctor
dsh plugin --profile web exec dsh-trae-connect doctor --provider trae-global

# 4. 导入外部凭证文件
dsh plugin --profile web exec dsh-trae-connect import --file ./trae-credentials.json
dsh plugin --profile web exec dsh-trae-connect import --provider trae-global --file ./trae-ai.json

# 5. 退出登录并清除本地对应凭据
dsh plugin --profile web exec dsh-trae-connect logout
dsh plugin --profile web exec dsh-trae-connect logout --provider trae-global
```

---

## 安装方法

本插件全面支持在 DSH 的三种工作模式下运行：**Web**、**Desktop**、**TUI**。

```sh
# Web 模式（推荐）
dsh plugin --profile web add github:masknull/dsh-trae-connect
dsh web

# Desktop 模式（DSH Desktop 桌面端）
dsh plugin --profile desktop add github:masknull/dsh-trae-connect
dsh --profile desktop

# TUI 模式（终端纯字符界面）
dsh plugin --profile dsh-tui add github:masknull/dsh-trae-connect
dsh --profile dsh-tui
```

> **版本要求说明**：
> - 要求的 DSH 核心版本：`0.1.5-rc.1` 及以上。
> - Node.js 环境：`^22.19.0 || >=24.0.0`。
> - 本仓库包含已编译完成的 `lib/` 目录，安装过程开箱即用，无需本地配置复杂编译链。

---

## 本地开发与质量保证

若需在本机进行二次开发与调试，请执行以下命令：

```sh
# 依赖安装
pnpm install

# 类型检查
pnpm run typecheck

# 单元测试（包含 10 个测试套件，33 项自动化单测）
pnpm run test

# 生产环境打包构建
pnpm run build

# 全流程质量检查流水线
pnpm run check
```

---

## 免责声明

- 本项目**仅供个人学习与技术研究使用**，仅驱动使用者自己的 Trae 账号在本机调用，严禁用于任何商业用途或违反服务条款的场景。
- 使用者需严格遵守字节跳动及 Trae 的相关服务条款；因个人使用本项目产生的任何后果由使用者自行承担。
- 本项目与字节跳动、Trae、DeepSeek 均无官方关联。文中所引用的商标与产品名称均归其各自所有者所有。

---

## 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。
