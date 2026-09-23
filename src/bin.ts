#!/usr/bin/env node
/**
 * Standalone status and diagnostics CLI for the dsh-trae-connect bundle.
 *
 * @module dsh-trae-connect/bin
 */

import { readFile } from 'node:fs/promises'
import { TraeCredentialStore } from './auth.ts'
import { isHeartbeatProcessAlive, readHostHeartbeat, traeHostHeartbeatPath } from './host-heartbeat.ts'
import { TraeLoginClient } from './login.ts'
import { traeStorageCandidates } from './paths.ts'
import { TraeUpstreamClient } from './upstream.ts'
import { CN_VARIANT, TRAE_VARIANTS, variantFor, type TraeVariant } from './variants.ts'
import { TRAE_CONNECT_VERSION } from './version.ts'

type Action = 'doctor' | 'import' | 'login' | 'logout' | 'status'

function printHelp(): void {
  process.stdout.write([
    'Usage: dsh-trae-connect <doctor|import|login|status|logout> [--provider <id>] [--json] [--file <path>]',
    '',
    '  doctor   环境与本地 Trae 探测诊断',
    '  import   导入已有的凭据文件或 Token（支持 --file）',
    '  login    通过浏览器进行网页授权登录（自动打开网页并等待回调）',
    '  status   查看登录状态与剩余额度/积分',
    '  logout   退出登录并清理本地保存的凭据',
    '',
    '  --provider  指定操作版本；默认为 trae',
    `              可选值: ${TRAE_VARIANTS.map(v => v.id).join(', ')}`,
    '  --json      输出机器可读的 JSON 格式（doctor/status 支持）',
    '  --file      凭据文件路径；"-" 表示从标准输入读取',
    '',
  ].join('\n'))
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function doctor(jsonOutput: boolean, variant: TraeVariant): Promise<number> {
  const store = new TraeCredentialStore({ variant })
  const authStatus = await store.status()
  const heartbeat = await readHostHeartbeat()
  const hostAlive = heartbeat !== undefined && isHeartbeatProcessAlive(heartbeat)
  const localCandidates = traeStorageCandidates().filter(c => c.region === variant.region)

  const report = {
    package: 'dsh-trae-connect',
    version: TRAE_CONNECT_VERSION,
    node: process.version,
    provider: variant.id,
    displayName: variant.displayName,
    region: variant.region,
    credentialFile: store.ownAuthPath(),
    status: authStatus.status,
    expiresAt: authStatus.expiresAtMs !== undefined && authStatus.expiresAtMs > 0
      ? new Date(authStatus.expiresAtMs).toISOString()
      : undefined,
    hostHeartbeat: {
      path: traeHostHeartbeatPath(),
      present: heartbeat !== undefined,
      alive: hostAlive,
      pid: heartbeat?.pid,
    },
    localInstallations: localCandidates.map(c => ({
      edition: c.edition,
      source: c.source,
      path: c.path,
    })),
  }

  if (jsonOutput) {
    printJson(report)
  } else {
    process.stdout.write(`=== DSH Trae Connect 诊断报告 (${variant.displayName}) ===\n`)
    process.stdout.write(`插件版本: ${TRAE_CONNECT_VERSION}\n`)
    process.stdout.write(`Node 版本: ${process.version}\n`)
    process.stdout.write(`凭据状态: ${authStatus.status}\n`)
    process.stdout.write(`凭据文件: ${store.ownAuthPath()}\n`)
    if (authStatus.expiresAtMs !== undefined && authStatus.expiresAtMs > 0) {
      process.stdout.write(`令牌到期: ${new Date(authStatus.expiresAtMs).toLocaleString()}\n`)
    }
    process.stdout.write(`宿主状态: ${hostAlive ? `运行中 (PID ${heartbeat?.pid})` : '未运行或心跳缺失'}\n`)
    process.stdout.write(`本地安装候选 (${localCandidates.length} 个):\n`)
    for (const c of localCandidates) {
      process.stdout.write(`  - [${c.edition}] ${c.path} (${c.source})\n`)
    }
  }
  return 0
}

async function status(jsonOutput: boolean, variant: TraeVariant): Promise<number> {
  const store = new TraeCredentialStore({ variant })
  const authStatus = await store.status()
  if (authStatus.status === 'unconfigured') {
    if (jsonOutput) {
      printJson({ status: 'unconfigured', provider: variant.id })
    } else {
      process.stdout.write(`未登录 ${variant.displayName}。运行 'login' 或在设置中完成导入。\n`)
    }
    return 1
  }

  const client = new TraeUpstreamClient({ variant, store })
  let credits
  try {
    credits = await client.fetchCredits(AbortSignal.timeout(10_000))
  } catch {}

  const result = {
    provider: variant.id,
    displayName: variant.displayName,
    status: authStatus.status,
    userId: authStatus.credential?.userId,
    accountName: authStatus.credential?.accountName,
    expiresAt: authStatus.expiresAtMs !== undefined ? new Date(authStatus.expiresAtMs).toISOString() : undefined,
    credits,
  }

  if (jsonOutput) {
    printJson(result)
  } else {
    process.stdout.write(`=== ${variant.displayName} 状态 ===\n`)
    process.stdout.write(`状态: ${authStatus.status}\n`)
    if (authStatus.credential?.accountName) process.stdout.write(`账号: ${authStatus.credential.accountName}\n`)
    if (authStatus.credential?.userId) process.stdout.write(`用户 ID: ${authStatus.credential.userId}\n`)
    if (credits !== undefined) {
      process.stdout.write(`可用额度/积分: ${credits.total}\n`)
      if (credits.accounts && credits.accounts.length > 0) {
        process.stdout.write(`资源包列表:\n`)
        for (const a of credits.accounts) {
          process.stdout.write(`  - ${a.packageName}: 剩余 ${a.remain} / 总量 ${a.size} (到期: ${a.packageEndTime ?? '永久'})\n`)
        }
      }
    }
  }
  return 0
}

async function login(variant: TraeVariant): Promise<number> {
  const store = new TraeCredentialStore({ variant })
  const loginClient = new TraeLoginClient(variant, store)

  try {
    const attempt = await loginClient.begin()
    process.stdout.write([
      `请在浏览器中打开以下链接完成 ${variant.displayName} 授权登录：`,
      '',
      `  ${attempt.authUrl}`,
      '',
      `正在等待授权完成（超时时间 5 分钟，完成后自动回写凭据）...`,
      '',
    ].join('\n'))

    // 尝试调用系统默认浏览器打开
    try {
      const { exec } = await import('node:child_process')
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
      exec(`${cmd} "${attempt.authUrl}"`)
    } catch {}

    const deadline = Date.now() + 5 * 60 * 1000
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      const outcome = await loginClient.poll(attempt.state)
      if (outcome.status === 'complete') {
        process.stdout.write(
          `✅ 登录成功！${outcome.accountName ? `账号: ${outcome.accountName}` : ''}${outcome.userId ? ` (用户 ID: ${outcome.userId})` : ''}\n` +
          `凭据已保存在: ${store.ownAuthPath()}\n`,
        )
        return 0
      }
      if (outcome.status === 'failed') {
        process.stderr.write(`❌ 登录失败: ${outcome.message ?? '未知错误'}\n`)
        return 1
      }
    }

    process.stderr.write('❌ 登录超时：在 5 分钟内未收到浏览器授权回调。\n')
    return 1
  } catch (err) {
    process.stderr.write(`❌ 启动登录授权失败: ${err instanceof Error ? err.message : String(err)}\n`)
    return 1
  }
}

async function importDoc(filePath: string | undefined, variant: TraeVariant): Promise<number> {
  if (filePath === undefined) {
    process.stderr.write('错误: 缺少 --file 参数\n')
    return 1
  }
  let content: string
  try {
    content = filePath === '-' ? await readAllStdin() : await readFile(filePath, 'utf8')
  } catch (err) {
    process.stderr.write(`读取文件失败: ${err instanceof Error ? err.message : String(err)}\n`)
    return 1
  }

  const store = new TraeCredentialStore({ variant })
  const loginClient = new TraeLoginClient(variant, store)
  try {
    const cred = await loginClient.importDocument(content)
    process.stdout.write(`✅ 成功导入 ${variant.displayName} 凭据！\n`)
    if (cred.accountName) process.stdout.write(`账号: ${cred.accountName}\n`)
    if (cred.userId) process.stdout.write(`用户 ID: ${cred.userId}\n`)
    return 0
  } catch (err) {
    process.stderr.write(`导入失败: ${err instanceof Error ? err.message : String(err)}\n`)
    return 1
  }
}

async function logout(variant: TraeVariant): Promise<number> {
  const store = new TraeCredentialStore({ variant })
  await store.remove()
  process.stdout.write(`已清除 ${variant.displayName} 本地保存的凭据。\n`)
  return 0
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp()
    return
  }

  const action = args[0] as Action
  let providerId = CN_VARIANT.id
  let jsonOutput = false
  let filePath: string | undefined

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--provider' && i + 1 < args.length) {
      providerId = args[++i]!
    } else if (arg === '--json') {
      jsonOutput = true
    } else if (arg === '--file' && i + 1 < args.length) {
      filePath = args[++i]!
    }
  }

  const variant = variantFor(providerId) ?? CN_VARIANT

  let exitCode = 0
  if (action === 'doctor') {
    exitCode = await doctor(jsonOutput, variant)
  } else if (action === 'status') {
    exitCode = await status(jsonOutput, variant)
  } else if (action === 'login') {
    exitCode = await login(variant)
  } else if (action === 'import') {
    exitCode = await importDoc(filePath, variant)
  } else if (action === 'logout') {
    exitCode = await logout(variant)
  } else {
    process.stderr.write(`未知命令: ${action}\n\n`)
    printHelp()
    exitCode = 1
  }

  process.exit(exitCode)
}

void main()
