import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const nativePackages = [
  { artifact: 'keepdo-macos-arm64-unsigned', extension: '.dmg', suffix: 'macos_arm64.dmg' },
  { artifact: 'keepdo-macos-x64-unsigned', extension: '.dmg', suffix: 'macos_x64.dmg' },
  { artifact: 'keepdo-windows-x64-unsigned', extension: '.exe', suffix: 'windows_x64_setup.exe' },
  { artifact: 'keepdo-linux-x64-unsigned', extension: '.AppImage', suffix: 'linux_x64.AppImage' },
  { artifact: 'keepdo-linux-x64-unsigned', extension: '.deb', suffix: 'linux_amd64.deb' },
  { artifact: 'keepdo-android-arm64-debug', extension: '.apk', suffix: 'android_arm64_debug.apk' },
  { artifact: 'keepdo-ios-simulator-unsigned', extension: '.zip', suffix: 'ios_arm64_simulator.zip' },
]

export function releaseVersion(tag) {
  const match = /^(?:native-)?v(\d+\.\d+\.\d+)$/.exec(tag)
  if (!match) throw new Error('发布标签必须为 vX.Y.Z 或 native-vX.Y.Z')
  return match[1]
}

export function validateNativeRun(run, tag, repository) {
  releaseVersion(tag)
  if (run.repository?.full_name !== repository || run.head_repository?.full_name !== repository) {
    throw new Error('只允许发布当前仓库构建的原生安装包')
  }
  if (run.path !== '.github/workflows/native.yml' || run.event !== 'push' || run.head_branch !== tag) {
    throw new Error('构建必须来自指定标签的原生工作流')
  }
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    throw new Error('原生构建尚未全部成功，禁止发布')
  }
}

function findPackages(directory, extension) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    // 仅提取最终安装包，不遍历 app/AppDir，也不跟随符号链接。
    if (entry.isDirectory() && !/\.(?:app|AppDir)$/.test(entry.name)) return findPackages(path, extension)
    return entry.isFile() && entry.name.endsWith(extension) ? [path] : []
  })
}

export function planNativeAssets(directory, tag) {
  const version = releaseVersion(tag)
  return nativePackages.map(({ artifact, extension, suffix }) => {
    const matches = findPackages(join(directory, artifact), extension)
    if (matches.length !== 1 || statSync(matches[0]).size === 0) {
      throw new Error(`${artifact} 必须包含且仅包含一个非空 ${extension} 安装包`)
    }
    return { source: matches[0], name: `KeepDo_${version}_${suffix}` }
  })
}
