import { spawnSync } from 'node:child_process'
import { delimiter, dirname } from 'node:path'

const [command, ...args] = process.argv.slice(2)
if (!['tauri', 'cargo'].includes(command)) throw new Error('只支持 Tauri 与 Cargo 原生开发命令')
const env = { ...process.env }
// 优先使用 rustup 选择的工具链，避免 Homebrew 的旧 cargo/rustc 抢占 PATH。
const selected = spawnSync('rustup', ['which', 'cargo'], { encoding: 'utf8', env })
if (selected.status === 0) {
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH'
  env[pathKey] = `${dirname(selected.stdout.trim())}${delimiter}${env[pathKey] || ''}`
}
let result
if (command === 'tauri') {
  if (!env.npm_execpath) throw new Error('请通过 pnpm tauri 或项目原生脚本执行')
  result = spawnSync(process.execPath, [env.npm_execpath, 'exec', 'tauri', ...args], { env, stdio: 'inherit' })
} else {
  result = spawnSync('cargo', args, { env, stdio: 'inherit' })
}
if (result.error) throw new Error(`原生命令启动失败：${result.error.message}`)
if (result.signal) process.kill(process.pid, result.signal)
else process.exitCode = result.status ?? 1
