import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) {
  throw new Error('项目版本必须符合语义化版本格式')
}

// 仅同步 KeepDo 自身版本，保留全部 Rust 依赖版本和锁定信息。
const files = [
  ['src-tauri/Cargo.toml', /(\[package\]\s+name = "keepdo"\s+version = ")[^"]+(")/],
  ['src-tauri/Cargo.lock', /(\[\[package\]\]\s+name = "keepdo"\s+version = ")[^"]+(")/],
]
const updates = files.map(([path, pattern]) => {
  const url = new URL(path, root)
  const content = readFileSync(url, 'utf8')
  if (!pattern.test(content)) throw new Error(`${path} 中未找到 KeepDo 版本字段`)
  return [url, content, content.replace(pattern, (_, prefix, suffix) => `${prefix}${version}${suffix}`)]
})
for (const [url, previous, updated] of updates) {
  if (previous !== updated) writeFileSync(url, updated)
}
console.log(`Rust 工程版本已同步为 ${version}`)
