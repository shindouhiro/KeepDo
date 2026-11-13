import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { planNativeAssets } from './lib/native-release.mjs'

const [input, output, tag] = process.argv.slice(2)
if (!input || !output || !tag) throw new Error('请提供构建产物目录、发布目录和标签')
const assets = planNativeAssets(input, tag)
mkdirSync(output, { recursive: true })
if (readdirSync(output).length) throw new Error('发布目录必须为空，避免混入其他版本产物')
const checksums = assets.map(({ source, name }) => {
  const target = join(output, name)
  copyFileSync(source, target)
  const digest = createHash('sha256').update(readFileSync(target)).digest('hex')
  console.log(`已收集 ${name}`)
  return `${digest}  ${name}`
})
writeFileSync(join(output, 'SHA256SUMS-native.txt'), `${checksums.join('\n')}\n`)
