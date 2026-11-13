import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const rootDir = fileURLToPath(new URL('../', import.meta.url))
const extensionSrcDir = resolve(rootDir, 'extension')
const outputDir = resolve(rootDir, 'dist-extension')
const zipFile = resolve(rootDir, 'dist-extension.zip')

console.log('正在构建 KeepDo Chrome 扩展…')
// 扩展只打包连接外壳，业务页面由线上站点提供，避免请求扩展自身不存在的 /api。
execFileSync('pnpm', ['exec', 'vite', 'build', '--config', 'vite.extension.config.ts'], {
  cwd: rootDir,
  stdio: 'inherit',
})

for (const name of ['manifest.json', 'background.js', 'icons']) {
  cpSync(resolve(extensionSrcDir, name), resolve(outputDir, name), { recursive: true })
}

if (existsSync(zipFile)) rmSync(zipFile)
try {
  execFileSync('zip', ['-r', '-q', zipFile, '.'], { cwd: outputDir, stdio: 'inherit' })
  console.log(`扩展压缩包已生成：${zipFile}`)
} catch {
  console.warn('压缩失败，请确认系统已安装 zip；仍可加载下方扩展目录。')
}

console.log(`扩展目录：${outputDir}`)
console.log('在 chrome://extensions/ 中加载此目录；已安装时点击 KeepDo 卡片上的重新加载。')
